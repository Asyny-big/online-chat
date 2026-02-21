const mongoose = require('mongoose');
const Feed = require('../../models/Feed');
const Post = require('../../models/Post');
const Relationship = require('../../models/Relationship');
const Reaction = require('../../models/Reaction');
const { enqueueFeedRebuildAll } = require('./queueService');
const {
  decodeCursor,
  encodeCursor,
  normalizeLimit
} = require('../utils/cursor');
const { canUserViewPost } = require('./accessService');

function toObjectIdOrNull(value) {
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function normalizeRankBoost(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.trunc(parsed);
}

function computeImmutableFeedScore({ createdAt, rankBoost = 0 }) {
  const createdAtMs = Number(new Date(createdAt || Date.now()).getTime());
  return createdAtMs + normalizeRankBoost(rankBoost);
}

async function resolveFanOutRecipients({ authorId, visibility }) {
  const baseQuery = {
    fromUserId: authorId,
    status: 'accepted',
    type: visibility === 'friends' ? 'friend' : { $in: ['friend', 'follow'] }
  };

  const relatedUserIds = await Relationship.distinct('toUserId', baseQuery);
  const recipients = new Set(relatedUserIds.map((id) => String(id)));
  recipients.add(String(authorId));
  return Array.from(recipients);
}

async function fanOutPostOnWrite(post) {
  if (!post?._id || !post?.authorId) return { inserted: 0 };

  const recipients = await resolveFanOutRecipients({
    authorId: post.authorId,
    visibility: post.visibility
  });
  if (!recipients.length) return { inserted: 0 };

  const createdAt = post.createdAt ? new Date(post.createdAt) : new Date();
  const score = computeImmutableFeedScore({
    createdAt,
    rankBoost: post.rankBoost || 0
  });

  const ops = recipients.map((recipientId) => ({
    updateOne: {
      filter: {
        userId: new mongoose.Types.ObjectId(String(recipientId)),
        postId: new mongoose.Types.ObjectId(String(post._id))
      },
      update: {
        $setOnInsert: {
          score,
          createdAt
        }
      },
      upsert: true
    }
  }));

  for (let i = 0; i < ops.length; i += 500) {
    // Chunked unordered writes keep fan-out bounded under high follower counts.
    // eslint-disable-next-line no-await-in-loop
    await Feed.bulkWrite(ops.slice(i, i + 500), { ordered: false });
  }

  return { inserted: recipients.length };
}

async function fanOutPostById(postId) {
  if (!mongoose.Types.ObjectId.isValid(postId)) return { inserted: 0 };

  const post = await Post.findById(postId)
    .select('_id authorId visibility createdAt rankBoost')
    .lean();
  if (!post) return { inserted: 0 };

  return fanOutPostOnWrite(post);
}

async function removePostFromFeed(postId) {
  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) return { deletedCount: 0 };
  return Feed.deleteMany({ postId: new mongoose.Types.ObjectId(String(postId)) });
}

async function rebuildPostFeedById(postId) {
  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) return { success: false };

  const objectId = new mongoose.Types.ObjectId(String(postId));
  const post = await Post.findById(objectId)
    .select('_id authorId visibility createdAt rankBoost')
    .lean();

  if (!post) {
    await removePostFromFeed(objectId);
    return { success: false, reason: 'post_not_found' };
  }

  await removePostFromFeed(objectId);
  await fanOutPostOnWrite(post);
  return { success: true };
}

async function rebuildFeedInBatches({ batchSize = 200 } = {}) {
  const limit = Math.max(1, Math.min(Number(batchSize) || 200, 1000));
  let lastId = null;
  let processed = 0;

  // Rebuild is isolated to worker and runs in bounded batches.
  await Feed.deleteMany({});

  while (true) {
    const query = {};
    if (lastId) {
      query._id = { $gt: lastId };
    }

    // eslint-disable-next-line no-await-in-loop
    const posts = await Post.find(query)
      .select('_id authorId visibility createdAt rankBoost')
      .sort({ _id: 1 })
      .limit(limit)
      .lean();

    if (!posts.length) break;

    for (const post of posts) {
      // eslint-disable-next-line no-await-in-loop
      await fanOutPostOnWrite(post);
      processed += 1;
    }

    lastId = posts[posts.length - 1]._id;
    // Yield to event loop between batches.
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setImmediate(resolve));
  }

  return { processed };
}

function scheduleFeedRebuildAll({ batchSize = 200 } = {}) {
  enqueueFeedRebuildAll({ batchSize }).catch((error) => {
    console.error('[Social][Feed] enqueue full rebuild failed:', error?.message || error);
  });
  return { queued: true, batchSize };
}

function normalizeFeedMode(value) {
  const normalized = String(value || 'subscriptions').trim().toLowerCase();
  if (normalized === 'popular') return 'popular';
  if (normalized === 'subscriptions') return 'subscriptions';
  if (normalized === 'following' || normalized === 'friends') return 'subscriptions';
  return 'subscriptions';
}

async function getSubscriptionsFeedPage({ userId, userObjectId, cursor, normalizedLimit }) {
  const cursorPayload = decodeCursor(cursor);
  const query = { userId: userObjectId };

  const cursorScore = Number.isFinite(Number(cursorPayload?.score))
    ? Number(cursorPayload.score)
    : null;
  const cursorId = toObjectIdOrNull(cursorPayload?.id);

  if (cursorScore !== null && cursorId) {
    query.$or = [
      { score: { $lt: cursorScore } },
      { score: cursorScore, _id: { $lt: cursorId } }
    ];
  }

  const rows = await Feed.find(query)
    .sort({ score: -1, _id: -1 })
    .limit(normalizedLimit + 1)
    .lean();

  const hasMore = rows.length > normalizedLimit;
  const pageRows = hasMore ? rows.slice(0, normalizedLimit) : rows;

  const postIds = pageRows.map((row) => row.postId);
  const posts = await Post.find({ _id: { $in: postIds } })
    .populate('authorId', '_id name avatarUrl')
    .populate('media')
    .lean();

  const postMap = new Map(posts.map((post) => [String(post._id), post]));
  const resultItems = [];
  for (const row of pageRows) {
    const post = postMap.get(String(row.postId));
    if (!post) continue;

    // eslint-disable-next-line no-await-in-loop
    const canView = await canUserViewPost(post, userId);
    if (!canView) continue;

    resultItems.push({
      _id: row._id,
      score: row.score,
      createdAt: row.createdAt,
      post
    });
  }

  // Fallback for sparse social graph:
  // fill from public feed in reverse chronology, without popularity reshuffling.
  if (!cursor && resultItems.length < normalizedLimit) {
    const excludedPostIds = new Set(resultItems.map((entry) => String(entry.post?._id || '')));
    const fallbackPosts = await Post.find({
      visibility: 'public',
      _id: { $nin: Array.from(excludedPostIds).filter(Boolean) }
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(Math.max(0, normalizedLimit - resultItems.length))
      .populate('authorId', '_id name avatarUrl')
      .populate('media')
      .lean();

    for (const post of fallbackPosts) {
      // eslint-disable-next-line no-await-in-loop
      const canView = await canUserViewPost(post, userId);
      if (!canView) continue;

      resultItems.push({
        _id: `public-${post._id}`,
        score: computeImmutableFeedScore({ createdAt: post.createdAt }),
        createdAt: post.createdAt,
        post
      });

      if (resultItems.length >= normalizedLimit) break;
    }
  }

  const nextCursor = hasMore && pageRows.length
    ? encodeCursor({ score: pageRows[pageRows.length - 1].score, id: String(pageRows[pageRows.length - 1]._id) })
    : null;

  return { items: resultItems, nextCursor };
}

async function getPopularFeedPage({ userId, cursor, normalizedLimit }) {
  const cursorPayload = decodeCursor(cursor);
  const cursorScore = Number.isFinite(Number(cursorPayload?.score))
    ? Number(cursorPayload.score)
    : null;
  const cursorId = toObjectIdOrNull(cursorPayload?.id);
  const now = new Date();

  const pipeline = [
    { $match: { visibility: 'public' } },
    {
      $addFields: {
        likesCount: { $ifNull: ['$stats.likes', 0] },
        commentsCount: { $ifNull: ['$stats.comments', 0] },
        repostsCount: { $ifNull: ['$stats.reposts', 0] },
        viewsCount: { $ifNull: ['$stats.views', 0] },
        ageHours: {
          $max: [
            0,
            {
              $divide: [
                { $subtract: [now, '$createdAt'] },
                3600000
              ]
            }
          ]
        }
      }
    },
    {
      $addFields: {
        rankScore: {
          $add: [
            {
              $divide: [
                {
                  $add: [
                    '$likesCount',
                    { $multiply: ['$commentsCount', 2] },
                    { $multiply: ['$repostsCount', 3] },
                    { $min: [{ $multiply: ['$viewsCount', 0.05] }, 20] }
                  ]
                },
                { $pow: [{ $add: ['$ageHours', 2] }, 1.3] }
              ]
            },
            {
              $divide: [1, { $add: ['$ageHours', 2] }]
            }
          ]
        }
      }
    },
    {
      $addFields: {
        scoreInt: {
          $toLong: {
            $floor: {
              $multiply: ['$rankScore', 1000000]
            }
          }
        }
      }
    }
  ];

  if (cursorScore !== null && cursorId) {
    pipeline.push({
      $match: {
        $or: [
          { scoreInt: { $lt: cursorScore } },
          { scoreInt: cursorScore, _id: { $lt: cursorId } }
        ]
      }
    });
  }

  pipeline.push(
    { $sort: { scoreInt: -1, _id: -1 } },
    { $limit: normalizedLimit + 1 },
    {
      $project: {
        _id: 1,
        createdAt: 1,
        score: '$scoreInt'
      }
    }
  );

  const rows = await Post.aggregate(pipeline);
  const hasMore = rows.length > normalizedLimit;
  const pageRows = hasMore ? rows.slice(0, normalizedLimit) : rows;
  const postIds = pageRows.map((row) => row._id);

  const posts = await Post.find({ _id: { $in: postIds } })
    .populate('authorId', '_id name avatarUrl')
    .populate('media')
    .lean();

  const postMap = new Map(posts.map((post) => [String(post._id), post]));
  const resultItems = [];
  for (const row of pageRows) {
    const post = postMap.get(String(row._id));
    if (!post) continue;

    // eslint-disable-next-line no-await-in-loop
    const canView = await canUserViewPost(post, userId);
    if (!canView) continue;

    resultItems.push({
      _id: `popular-${post._id}`,
      score: row.score,
      createdAt: row.createdAt,
      post
    });
  }

  const nextCursor = hasMore && pageRows.length
    ? encodeCursor({ score: pageRows[pageRows.length - 1].score, id: String(pageRows[pageRows.length - 1]._id) })
    : null;

  return { items: resultItems, nextCursor };
}

async function appendLikedByMe({ items, userObjectId }) {
  const resultPostIds = items
    .map((entry) => entry?.post?._id)
    .filter(Boolean);

  if (!resultPostIds.length) return items;

  const reactions = await Reaction.find({
    targetType: 'post',
    userId: userObjectId,
    targetId: { $in: resultPostIds }
  })
    .select('targetId reaction')
    .lean();

  const likedIds = new Set(
    reactions
      .filter((row) => String(row?.reaction || '').toLowerCase() === 'like')
      .map((row) => String(row.targetId))
  );

  for (const entry of items) {
    if (!entry?.post?._id) continue;
    entry.post = {
      ...entry.post,
      likedByMe: likedIds.has(String(entry.post._id))
    };
  }

  return items;
}

async function getUserFeedPage({ userId, cursor, limit, mode }) {
  const normalizedLimit = normalizeLimit(limit, 20, 50);
  const userObjectId = toObjectIdOrNull(userId);
  if (!userObjectId) {
    return { items: [], nextCursor: null };
  }

  const normalizedMode = normalizeFeedMode(mode);
  const result = normalizedMode === 'popular'
    ? await getPopularFeedPage({ userId, cursor, normalizedLimit })
    : await getSubscriptionsFeedPage({ userId, userObjectId, cursor, normalizedLimit });

  await appendLikedByMe({ items: result.items, userObjectId });

  return {
    items: result.items,
    nextCursor: result.nextCursor
  };
}

module.exports = {
  computeImmutableFeedScore,
  fanOutPostOnWrite,
  fanOutPostById,
  removePostFromFeed,
  rebuildPostFeedById,
  rebuildFeedInBatches,
  scheduleFeedRebuildAll,
  getUserFeedPage
};
