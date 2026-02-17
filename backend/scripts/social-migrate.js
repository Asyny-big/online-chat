const mongoose = require('mongoose');
const config = require('../config.local');
const { ensureSocialIndexes } = require('../social/indexes');
const { toObjectIdSafe } = require('./helpers/toObjectIdSafe');

function createStats() {
  return {
    skippedInvalidIds: 0,
    processed: 0,
    created: 0,
    updated: 0
  };
}

function objectIdKey(oid) {
  return String(oid);
}

function parseCount(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.trunc(parsed);
}

function trackBulkWriteResult(stats, result) {
  if (!result) return;
  stats.created += Number(result.upsertedCount || 0);
  stats.updated += Number(result.modifiedCount || 0);
}

async function aggregateCounts(collection, pipeline, stats, label) {
  const rows = await collection.aggregate(pipeline).toArray();
  const map = new Map();

  rows.forEach((row) => {
    stats.processed += 1;

    const oid = toObjectIdSafe(row?._id);
    if (!oid) {
      stats.skippedInvalidIds += 1;
      return;
    }

    map.set(objectIdKey(oid), parseCount(row.count));
  });

  console.log(`[Social migrate] aggregated ${label}: rows=${rows.length}, valid=${map.size}`);
  return map;
}

async function migrateSocial() {
  const stats = createStats();

  try {
    await mongoose.connect(config.MONGODB_URI);
    const db = mongoose.connection.db;
    console.log('[Social migrate] connected');

    await ensureSocialIndexes(db);
    console.log('[Social migrate] indexes ensured');

    const users = db.collection('users');
    const relationships = db.collection('relationships');
    const posts = db.collection('posts');
    const feeds = db.collection('feeds');

    const followersByUser = await aggregateCounts(relationships, [
      { $match: { type: 'follow', status: 'accepted' } },
      { $group: { _id: '$toUserId', count: { $sum: 1 } } }
    ], stats, 'followers');

    const followingByUser = await aggregateCounts(relationships, [
      { $match: { type: 'follow', status: 'accepted' } },
      { $group: { _id: '$fromUserId', count: { $sum: 1 } } }
    ], stats, 'following');

    const friendsByUser = await aggregateCounts(relationships, [
      { $match: { type: 'friend', status: 'accepted' } },
      { $group: { _id: '$fromUserId', count: { $sum: 1 } } }
    ], stats, 'friends');

    const postsByUser = await aggregateCounts(posts, [
      { $group: { _id: '$authorId', count: { $sum: 1 } } }
    ], stats, 'posts');

    const userCursor = users.find({}, { projection: { _id: 1 } });
    const userOps = [];
    const USER_BATCH_SIZE = 1000;

    while (await userCursor.hasNext()) {
      const user = await userCursor.next();
      stats.processed += 1;

      const userId = toObjectIdSafe(user?._id);
      if (!userId) {
        stats.skippedInvalidIds += 1;
        continue;
      }

      const userKey = objectIdKey(userId);

      userOps.push({
        updateOne: {
          filter: { _id: userId },
          update: {
            $set: {
              followers: followersByUser.get(userKey) || 0,
              following: followingByUser.get(userKey) || 0,
              friends: friendsByUser.get(userKey) || 0,
              posts: postsByUser.get(userKey) || 0
            }
          }
        }
      });

      if (userOps.length >= USER_BATCH_SIZE) {
        // eslint-disable-next-line no-await-in-loop
        const result = await users.bulkWrite(userOps.splice(0, userOps.length), { ordered: false });
        trackBulkWriteResult(stats, result);
      }
    }

    if (userOps.length) {
      const result = await users.bulkWrite(userOps, { ordered: false });
      trackBulkWriteResult(stats, result);
    }

    console.log('[Social migrate] counters synchronized');

    const postCursor = posts.find(
      {},
      { projection: { _id: 1, authorId: 1, visibility: 1, createdAt: 1, rankBoost: 1 } }
    );

    const feedOps = [];
    const FEED_BATCH_SIZE = 1000;

    while (await postCursor.hasNext()) {
      const post = await postCursor.next();
      stats.processed += 1;

      const postId = toObjectIdSafe(post?._id);
      const authorId = toObjectIdSafe(post?.authorId);
      if (!postId || !authorId) {
        stats.skippedInvalidIds += 1;
        continue;
      }

      const relationQuery = {
        fromUserId: authorId,
        status: 'accepted',
        type: post.visibility === 'friends' ? 'friend' : { $in: ['friend', 'follow'] }
      };

      // eslint-disable-next-line no-await-in-loop
      const relatedUsers = await relationships.distinct('toUserId', relationQuery);
      const recipients = new Set();
      recipients.add(objectIdKey(authorId));

      relatedUsers.forEach((rawId) => {
        const recipientId = toObjectIdSafe(rawId);
        if (!recipientId) {
          stats.skippedInvalidIds += 1;
          return;
        }
        recipients.add(objectIdKey(recipientId));
      });

      const rankBoost = Number(post.rankBoost || 0);
      const safeRankBoost = Number.isFinite(rankBoost) ? Math.trunc(rankBoost) : 0;
      const createdAt = post.createdAt ? new Date(post.createdAt) : new Date();
      const score = Number(createdAt.getTime()) + safeRankBoost;

      recipients.forEach((recipientKey) => {
        const recipientId = toObjectIdSafe(recipientKey);
        if (!recipientId) {
          stats.skippedInvalidIds += 1;
          return;
        }

        feedOps.push({
          updateOne: {
            filter: {
              userId: recipientId,
              postId
            },
            update: {
              $setOnInsert: {
                score,
                createdAt
              }
            },
            upsert: true
          }
        });
      });

      if (feedOps.length >= FEED_BATCH_SIZE) {
        // eslint-disable-next-line no-await-in-loop
        const result = await feeds.bulkWrite(feedOps.splice(0, feedOps.length), { ordered: false });
        trackBulkWriteResult(stats, result);
      }
    }

    if (feedOps.length) {
      const result = await feeds.bulkWrite(feedOps, { ordered: false });
      trackBulkWriteResult(stats, result);
    }

    console.log('[Social migrate] feed synchronized (upsert-only)');
    console.log(
      `[Social migrate] stats: processed=${stats.processed}, created=${stats.created}, updated=${stats.updated}, skippedInvalidIds=${stats.skippedInvalidIds}`
    );
    console.log('[Social migrate] done');
  } finally {
    await mongoose.disconnect();
  }
}

migrateSocial().catch((error) => {
  console.error('[Social migrate] failed:', error);
  process.exit(1);
});
