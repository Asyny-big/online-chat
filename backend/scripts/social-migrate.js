const mongoose = require('mongoose');
const config = require('../config.local');
const { ensureSocialIndexes } = require('../social/indexes');

async function aggregateCounts(collection, pipeline) {
  const rows = await collection.aggregate(pipeline).toArray();
  const map = new Map();
  rows.forEach((row) => {
    map.set(String(row._id), Number(row.count || 0));
  });
  return map;
}

async function migrateSocial() {
  await mongoose.connect(config.MONGODB_URI);
  const db = mongoose.connection.db;
  console.log('[Social migrate] connected');

  await ensureSocialIndexes(db);
  console.log('[Social migrate] indexes ensured');

  const users = db.collection('users');
  const relationships = db.collection('relationships');
  const posts = db.collection('posts');
  const feeds = db.collection('feeds');

  await users.updateMany(
    {},
    {
      $set: {
        followers: 0,
        following: 0,
        friends: 0,
        posts: 0
      }
    }
  );
  console.log('[Social migrate] user counters reset');

  const followersByUser = await aggregateCounts(relationships, [
    { $match: { type: 'follow', status: 'accepted' } },
    { $group: { _id: '$toUserId', count: { $sum: 1 } } }
  ]);
  const followingByUser = await aggregateCounts(relationships, [
    { $match: { type: 'follow', status: 'accepted' } },
    { $group: { _id: '$fromUserId', count: { $sum: 1 } } }
  ]);
  const friendsByUser = await aggregateCounts(relationships, [
    { $match: { type: 'friend', status: 'accepted' } },
    { $group: { _id: '$fromUserId', count: { $sum: 1 } } }
  ]);
  const postsByUser = await aggregateCounts(posts, [
    { $group: { _id: '$authorId', count: { $sum: 1 } } }
  ]);

  const allUserIds = new Set([
    ...followersByUser.keys(),
    ...followingByUser.keys(),
    ...friendsByUser.keys(),
    ...postsByUser.keys()
  ]);

  const bulkOps = [];
  allUserIds.forEach((userId) => {
    bulkOps.push({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(userId) },
        update: {
          $set: {
            followers: followersByUser.get(userId) || 0,
            following: followingByUser.get(userId) || 0,
            friends: friendsByUser.get(userId) || 0,
            posts: postsByUser.get(userId) || 0
          }
        }
      }
    });
  });

  if (bulkOps.length) {
    await users.bulkWrite(bulkOps, { ordered: false });
  }

  console.log(`[Social migrate] counters backfilled for ${bulkOps.length} users`);

  await feeds.deleteMany({});
  console.log('[Social migrate] feed cache cleared');

  const cursor = posts.find(
    {},
    { projection: { _id: 1, authorId: 1, visibility: 1, createdAt: 1 } }
  );

  const feedOps = [];
  let postCount = 0;

  // Build feed strictly from cached fan-out entries.
  while (await cursor.hasNext()) {
    const post = await cursor.next();
    if (!post?._id || !post?.authorId) continue;

    const relationQuery = {
      fromUserId: post.authorId,
      status: 'accepted',
      type: post.visibility === 'friends' ? 'friend' : { $in: ['friend', 'follow'] }
    };
    const relatedUsers = await relationships.distinct('toUserId', relationQuery);
    const recipients = new Set(relatedUsers.map((id) => String(id)));
    recipients.add(String(post.authorId));

    const score = Number(new Date(post.createdAt || new Date()).getTime());
    const createdAt = post.createdAt || new Date();

    recipients.forEach((recipientId) => {
      feedOps.push({
        updateOne: {
          filter: {
            userId: new mongoose.Types.ObjectId(recipientId),
            postId: post._id
          },
          update: {
            $set: {
              score,
              createdAt
            }
          },
          upsert: true
        }
      });
    });

    postCount += 1;
    if (feedOps.length >= 1000) {
      // eslint-disable-next-line no-await-in-loop
      await feeds.bulkWrite(feedOps.splice(0, feedOps.length), { ordered: false });
    }
  }

  if (feedOps.length) {
    await feeds.bulkWrite(feedOps, { ordered: false });
  }

  console.log(`[Social migrate] feed cache rebuilt for ${postCount} posts`);
  await mongoose.disconnect();
  console.log('[Social migrate] done');
}

migrateSocial().catch((error) => {
  console.error('[Social migrate] failed:', error);
  process.exit(1);
});
