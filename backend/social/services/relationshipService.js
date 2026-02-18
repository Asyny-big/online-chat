const mongoose = require('mongoose');
const Relationship = require('../../models/Relationship');
const User = require('../../models/User');
const { createNotification } = require('./notificationService');
const { ensureDirectChat, formatChatForUser } = require('./chatService');
const { emitToUserSockets, emitToUsers } = require('./socketService');
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

function normalizePhoneDigits(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length === 10 && digits.startsWith('9')) {
    return `7${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('8')) {
    return `7${digits.slice(1)}`;
  }

  if (digits.length === 11 && digits.startsWith('7')) {
    return digits;
  }

  return digits;
}

function formatPhoneForClient(rawPhone) {
  const normalized = normalizePhoneDigits(rawPhone);
  return normalized || String(rawPhone || '').replace(/\s+/g, '').replace(/^\+/, '');
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveRelationshipStatus({ currentUserId, candidateUserId, relationRows }) {
  const current = String(currentUserId);
  const candidate = String(candidateUserId);

  const hasFriend = relationRows.some((row) => {
    if (row.type !== 'friend' || row.status !== 'accepted') return false;
    const fromId = String(row.fromUserId);
    const toId = String(row.toUserId);
    return (fromId === current && toId === candidate) || (fromId === candidate && toId === current);
  });

  if (hasFriend) return 'friends';

  const outgoingPending = relationRows.some((row) => (
    row.type === 'request'
    && row.status === 'pending'
    && String(row.fromUserId) === current
    && String(row.toUserId) === candidate
  ));
  if (outgoingPending) return 'outgoing_request';

  const incomingPending = relationRows.some((row) => (
    row.type === 'request'
    && row.status === 'pending'
    && String(row.fromUserId) === candidate
    && String(row.toUserId) === current
  ));
  if (incomingPending) return 'incoming_request';

  return 'none';
}

function emitRelationshipUpdate(app, userIds, payload) {
  emitToUsers(app, userIds, 'relationship:update', payload);
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
    meta: {
      action: 'request_created',
      requestId: String(request._id),
      fromUserId: String(fromId),
      toUserId: String(toId)
    }
  });

  emitRelationshipUpdate(app, [String(fromId), String(toId)], {
    action: 'friend_request',
    status: 'pending',
    fromUserId: String(fromId),
    toUserId: String(toId),
    requestId: String(request._id)
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
    type: 'friend_accept',
    actorId: currentUserId,
    targetId: request._id,
    meta: {
      action: 'request_accepted',
      requestId: String(request._id),
      fromUserId: String(fromId),
      toUserId: String(currentUserId)
    }
  });

  const { chat, created } = await ensureDirectChat({
    userAId: fromId,
    userBId: currentUserId
  });

  const payloadForRequester = formatChatForUser({
    app,
    chat,
    viewerUserId: fromId
  });

  const payloadForAcceptor = formatChatForUser({
    app,
    chat,
    viewerUserId: currentUserId
  });

  emitRelationshipUpdate(app, [String(currentUserId), String(fromId)], {
    action: 'friend_accept',
    status: 'friends',
    fromUserId: String(fromId),
    toUserId: String(currentUserId),
    requestId: String(request._id),
    chatId: String(chat._id)
  });

  emitToUsers(app, [String(currentUserId), String(fromId)], 'social:relationship', {
    action: 'friend_request_accepted',
    fromUserId: String(fromId),
    toUserId: String(currentUserId),
    requestId: String(request._id)
  });

  emitToUserSockets(app, String(fromId), 'chat:created', {
    chat: payloadForRequester,
    created
  });
  emitToUserSockets(app, String(currentUserId), 'chat:created', {
    chat: payloadForAcceptor,
    created
  });

  // Backward-compat + required aliases.
  emitToUserSockets(app, String(fromId), 'chat:new', payloadForRequester);
  emitToUserSockets(app, String(currentUserId), 'chat:new', payloadForAcceptor);
  emitToUserSockets(app, String(fromId), 'new_chat', payloadForRequester);
  emitToUserSockets(app, String(currentUserId), 'new_chat', payloadForAcceptor);

  return {
    ...request,
    chatId: chat._id,
    chatCreated: created
  };
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

  emitRelationshipUpdate(app, [String(currentUserId), String(fromId)], {
    action: 'friend_reject',
    status: 'rejected',
    fromUserId: String(fromId),
    toUserId: String(currentUserId),
    requestId: String(request._id)
  });

  emitToUsers(app, [String(currentUserId), String(fromId)], 'social:relationship', {
    action: 'friend_request_rejected',
    fromUserId: String(fromId),
    toUserId: String(currentUserId),
    requestId: String(request._id)
  });

  return request;
}

async function cancelFriendRequest({ app, userId, toUserId }) {
  const currentUserId = toObjectIdOrFail(userId, 'userId');
  const targetUserId = toObjectIdOrFail(toUserId, 'toUserId');
  assertNotSelf(currentUserId, targetUserId);

  const request = await Relationship.findOneAndDelete({
    fromUserId: currentUserId,
    toUserId: targetUserId,
    type: 'request',
    status: 'pending'
  }).lean();

  if (!request) {
    throw httpError(404, 'Pending friend request not found');
  }

  emitRelationshipUpdate(app, [String(currentUserId), String(targetUserId)], {
    action: 'friend_request_cancel',
    status: 'cancelled',
    fromUserId: String(currentUserId),
    toUserId: String(targetUserId),
    requestId: String(request._id)
  });

  emitToUsers(app, [String(currentUserId), String(targetUserId)], 'social:relationship', {
    action: 'friend_request_cancelled',
    fromUserId: String(currentUserId),
    toUserId: String(targetUserId),
    requestId: String(request._id)
  });

  return { success: true, requestId: request._id };
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

  emitRelationshipUpdate(app, [String(currentUserId), String(friendId)], {
    action: 'friend_remove',
    status: 'none',
    userId: String(currentUserId),
    friendUserId: String(friendId)
  });

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
    .populate(userField, '_id name phone avatarUrl')
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

async function searchUsers({ userId, query, limit }) {
  const currentUserId = toObjectIdOrFail(userId, 'userId');
  const rawQuery = String(query || '').trim();
  const normalizedLimit = normalizeLimit(limit, 20, 40);

  if (!rawQuery || rawQuery.length < 2) {
    return { items: [] };
  }

  const escaped = escapeRegex(rawQuery);
  const byName = { name: { $regex: escaped, $options: 'i' } };

  const phoneDigits = normalizePhoneDigits(rawQuery);
  const searchOr = [byName];
  if (phoneDigits) {
    const escapedDigits = escapeRegex(phoneDigits);
    searchOr.push({ phoneNormalized: { $regex: escapedDigits, $options: 'i' } });
    searchOr.push({ phone: { $regex: escapedDigits, $options: 'i' } });
  }

  const users = await User.find({
    _id: { $ne: currentUserId },
    $or: searchOr
  })
    .select('_id name phone phoneNormalized avatarUrl followers following friends posts')
    .sort({ name: 1, _id: -1 })
    .limit(normalizedLimit)
    .lean();

  if (!users.length) {
    return { items: [] };
  }

  const candidateIds = users.map((user) => user._id);
  const relationRows = await Relationship.find({
    type: { $in: ['friend', 'request'] },
    status: { $in: ['accepted', 'pending'] },
    $or: [
      { fromUserId: currentUserId, toUserId: { $in: candidateIds } },
      { fromUserId: { $in: candidateIds }, toUserId: currentUserId }
    ]
  }).lean();

  return {
    items: users.map((user) => ({
      _id: user._id,
      name: user.name,
      username: user.name,
      phone: formatPhoneForClient(user.phoneNormalized || user.phone),
      avatarUrl: user.avatarUrl || null,
      counters: {
        followers: Number(user.followers || 0),
        following: Number(user.following || 0),
        friends: Number(user.friends || 0),
        posts: Number(user.posts || 0)
      },
      relationshipStatus: resolveRelationshipStatus({
        currentUserId,
        candidateUserId: user._id,
        relationRows
      })
    }))
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
  cancelFriendRequest,
  removeFriend,
  followUser,
  unfollowUser,
  listIncomingRequests,
  listFriends,
  listFollowers,
  listFollowing,
  searchUsers
};
