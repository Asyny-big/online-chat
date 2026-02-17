const mongoose = require('mongoose');
const Relationship = require('../../models/Relationship');
const User = require('../../models/User');
const { createNotification } = require('./notificationService');
const { emitToUsers } = require('./socketService');
const { incrementManyCounters } = require('./userCounterService');
const {
  decodeCursor,
  normalizeLimit,
  buildObjectIdCursor,
  applyObjectIdCursorFilter
} = require('../utils/cursor');
const { httpError } = require('../utils/errors');

function toObjectIdOrFail(value, fieldName) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw httpError(400, `Invalid ${fieldName}`);
  }
  return new mongoose.Types.ObjectId(value);
}

async function ensureTargetUser(targetUserId) {
  const exists = await User.exists({ _id: targetUserId });
  if (!exists) {
    throw httpError(404, 'User not found');
  }
}

function assertNotSelf(fromUserId, toUserId) {
  if (String(fromUserId) === String(toUserId)) {
    throw httpError(400, 'Operation on self is not allowed');
  }
}

async function assertNotBlocked(userIdA, userIdB) {
  const blocked = await Relationship.exists({
    type: 'block',
    status: 'accepted',
    $or: [
      { fromUserId: userIdA, toUserId: userIdB },
      { fromUserId: userIdB, toUserId: userIdA }
    ]
  });

  if (blocked) {
    throw httpError(403, 'Operation is blocked');
  }
}

async function sendFriendRequest({ app, fromUserId, toUserId }) {
  const fromId = toObjectIdOrFail(fromUserId, 'fromUserId');
  const toId = toObjectIdOrFail(toUserId, 'toUserId');

  assertNotSelf(fromId, toId);
  await ensureTargetUser(toId);
  await assertNotBlocked(fromId, toId);

  const alreadyFriend = await Relationship.exists({
    fromUserId: fromId,
    toUserId: toId,
    type: 'friend',
    status: 'accepted'
  });
  if (alreadyFriend) {
    throw httpError(409, 'Users are already friends');
  }

  const incomingPending = await Relationship.exists({
    fromUserId: toId,
    toUserId: fromId,
    type: 'request',
    status: 'pending'
  });
  if (incomingPending) {
    throw httpError(409, 'Incoming friend request already exists');
  }

  const request = await Relationship.findOneAndUpdate(
    { fromUserId: fromId, toUserId: toId, type: 'request' },
    {
      $set: {
        fromUserId: fromId,
        toUserId: toId,
        type: 'request',
        status: 'pending',
        createdAt: new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  await createNotification({
    app,
    userId: toId,
    type: 'friend_request',
    actorId: fromId,
    targetId: request._id,
    meta: { action: 'request_created' }
  });

  emitToUsers(app, [String(fromId), String(toId)], 'social:relationship', {
    action: 'friend_request_created',
    fromUserId: String(fromId),
    toUserId: String(toId),
    requestId: String(request._id),
    status: request.status
  });

  return request;
}

async function acceptFriendRequest({ app, userId, fromUserId }) {
  const currentUserId = toObjectIdOrFail(userId, 'userId');
  const fromId = toObjectIdOrFail(fromUserId, 'fromUserId');
  assertNotSelf(currentUserId, fromId);

  const request = await Relationship.findOneAndUpdate(
    {
      fromUserId: fromId,
      toUserId: currentUserId,
      type: 'request',
      status: 'pending'
    },
    { $set: { status: 'accepted' } },
    { new: true }
  ).lean();

  if (!request) {
    throw httpError(404, 'Pending friend request not found');
  }

  const alreadyFriend = await Relationship.exists({
    fromUserId: fromId,
    toUserId: currentUserId,
    type: 'friend',
    status: 'accepted'
  });

  await Relationship.bulkWrite(
    [
      {
        updateOne: {
          filter: { fromUserId: fromId, toUserId: currentUserId, type: 'friend' },
          update: {
            $set: {
              status: 'accepted',
              createdAt: request.createdAt || new Date()
            }
          },
          upsert: true
        }
      },
      {
        updateOne: {
          filter: { fromUserId: currentUserId, toUserId: fromId, type: 'friend' },
          update: {
            $set: {
              status: 'accepted',
              createdAt: request.createdAt || new Date()
            }
          },
          upsert: true
        }
      }
    ],
    { ordered: true }
  );

  if (!alreadyFriend) {
    await incrementManyCounters([
      { userId: fromId, delta: { friends: 1 } },
      { userId: currentUserId, delta: { friends: 1 } }
    ]);
  }

  await createNotification({
    app,
    userId: fromId,
    type: 'friend_request',
    actorId: currentUserId,
    targetId: request._id,
    meta: { action: 'request_accepted' }
  });

  emitToUsers(app, [String(currentUserId), String(fromId)], 'social:relationship', {
    action: 'friend_request_accepted',
    fromUserId: String(fromId),
    toUserId: String(currentUserId),
    requestId: String(request._id)
  });

  return request;
}

async function rejectFriendRequest({ app, userId, fromUserId }) {
  const currentUserId = toObjectIdOrFail(userId, 'userId');
  const fromId = toObjectIdOrFail(fromUserId, 'fromUserId');
  assertNotSelf(currentUserId, fromId);

  const request = await Relationship.findOneAndUpdate(
    {
      fromUserId: fromId,
      toUserId: currentUserId,
      type: 'request',
      status: 'pending'
    },
    { $set: { status: 'rejected' } },
    { new: true }
  ).lean();

  if (!request) {
    throw httpError(404, 'Pending friend request not found');
  }

  emitToUsers(app, [String(currentUserId), String(fromId)], 'social:relationship', {
    action: 'friend_request_rejected',
    fromUserId: String(fromId),
    toUserId: String(currentUserId),
    requestId: String(request._id)
  });

  return request;
}

async function removeFriend({ app, userId, friendUserId }) {
  const currentUserId = toObjectIdOrFail(userId, 'userId');
  const friendId = toObjectIdOrFail(friendUserId, 'friendUserId');
  assertNotSelf(currentUserId, friendId);

  const result = await Relationship.deleteMany({
    type: 'friend',
    status: 'accepted',
    $or: [
      { fromUserId: currentUserId, toUserId: friendId },
      { fromUserId: friendId, toUserId: currentUserId }
    ]
  });

  if (!result.deletedCount) {
    throw httpError(404, 'Friend relationship not found');
  }

  await incrementManyCounters([
    { userId: currentUserId, delta: { friends: -1 } },
    { userId: friendId, delta: { friends: -1 } }
  ]);

  emitToUsers(app, [String(currentUserId), String(friendId)], 'social:relationship', {
    action: 'friend_removed',
    userId: String(currentUserId),
    friendUserId: String(friendId)
  });

  return { success: true };
}

async function followUser({ app, fromUserId, toUserId }) {
  const fromId = toObjectIdOrFail(fromUserId, 'fromUserId');
  const toId = toObjectIdOrFail(toUserId, 'toUserId');
  assertNotSelf(fromId, toId);
  await ensureTargetUser(toId);
  await assertNotBlocked(fromId, toId);

  const existing = await Relationship.findOne({
    fromUserId: fromId,
    toUserId: toId,
    type: 'follow'
  }).lean();

  const wasAccepted = existing?.status === 'accepted';

  const follow = await Relationship.findOneAndUpdate(
    { fromUserId: fromId, toUserId: toId, type: 'follow' },
    {
      $set: {
        status: 'accepted',
        createdAt: existing?.createdAt || new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  if (!wasAccepted) {
    await incrementManyCounters([
      { userId: fromId, delta: { following: 1 } },
      { userId: toId, delta: { followers: 1 } }
    ]);
  }

  emitToUsers(app, [String(fromId), String(toId)], 'social:relationship', {
    action: 'followed',
    fromUserId: String(fromId),
    toUserId: String(toId)
  });

  return follow;
}

async function unfollowUser({ app, fromUserId, toUserId }) {
  const fromId = toObjectIdOrFail(fromUserId, 'fromUserId');
  const toId = toObjectIdOrFail(toUserId, 'toUserId');
  assertNotSelf(fromId, toId);

  const result = await Relationship.deleteOne({
    fromUserId: fromId,
    toUserId: toId,
    type: 'follow',
    status: 'accepted'
  });

  if (!result.deletedCount) {
    throw httpError(404, 'Follow relationship not found');
  }

  await incrementManyCounters([
    { userId: fromId, delta: { following: -1 } },
    { userId: toId, delta: { followers: -1 } }
  ]);

  emitToUsers(app, [String(fromId), String(toId)], 'social:relationship', {
    action: 'unfollowed',
    fromUserId: String(fromId),
    toUserId: String(toId)
  });

  return { success: true };
}

async function listRelationsWithUsers({ query, userField, cursor, limit }) {
  const normalizedLimit = normalizeLimit(limit, 20, 50);
  const cursorPayload = decodeCursor(cursor);
  const mongoQuery = { ...query };
  applyObjectIdCursorFilter(mongoQuery, cursorPayload, '_id');

  const rows = await Relationship.find(mongoQuery)
    .sort({ _id: -1 })
    .limit(normalizedLimit + 1)
    .populate(userField, '_id name avatarUrl')
    .lean();

  const hasMore = rows.length > normalizedLimit;
  const items = hasMore ? rows.slice(0, normalizedLimit) : rows;
  const nextCursor = hasMore ? buildObjectIdCursor(items) : null;

  return {
    items: items.map((row) => ({
      _id: row._id,
      type: row.type,
      status: row.status,
      createdAt: row.createdAt,
      user: row[userField] || null
    })),
    nextCursor
  };
}

async function listIncomingRequests({ userId, cursor, limit }) {
  const currentUserId = toObjectIdOrFail(userId, 'userId');
  return listRelationsWithUsers({
    query: {
      toUserId: currentUserId,
      type: 'request',
      status: 'pending'
    },
    userField: 'fromUserId',
    cursor,
    limit
  });
}

async function listFriends({ userId, cursor, limit }) {
  const currentUserId = toObjectIdOrFail(userId, 'userId');
  return listRelationsWithUsers({
    query: {
      fromUserId: currentUserId,
      type: 'friend',
      status: 'accepted'
    },
    userField: 'toUserId',
    cursor,
    limit
  });
}

async function listFollowers({ userId, cursor, limit }) {
  const currentUserId = toObjectIdOrFail(userId, 'userId');
  return listRelationsWithUsers({
    query: {
      toUserId: currentUserId,
      type: 'follow',
      status: 'accepted'
    },
    userField: 'fromUserId',
    cursor,
    limit
  });
}

async function listFollowing({ userId, cursor, limit }) {
  const currentUserId = toObjectIdOrFail(userId, 'userId');
  return listRelationsWithUsers({
    query: {
      fromUserId: currentUserId,
      type: 'follow',
      status: 'accepted'
    },
    userField: 'toUserId',
    cursor,
    limit
  });
}

module.exports = {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  followUser,
  unfollowUser,
  listIncomingRequests,
  listFriends,
  listFollowers,
  listFollowing
};
