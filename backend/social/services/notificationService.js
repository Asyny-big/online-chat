const SocialNotification = require('../../models/SocialNotification');
const User = require('../../models/User');
const { emitToUserSockets } = require('./socketService');
const {
  decodeCursor,
  normalizeLimit,
  buildObjectIdCursor,
  applyObjectIdCursorFilter
} = require('../utils/cursor');

async function createNotification({ app, userId, type, actorId, targetId, meta = {} }) {
  if (!userId || !actorId || !type || !targetId) return null;
  if (String(userId) === String(actorId)) return null;

  const notification = await SocialNotification.create({
    userId,
    type,
    actorId,
    targetId,
    read: false,
    meta
  });

  const actor = await User.findById(actorId).select('_id name avatarUrl').lean();

  emitToUserSockets(app, userId, 'notification:new', {
    _id: notification._id,
    userId: notification.userId,
    type: notification.type,
    actorId: notification.actorId,
    targetId: notification.targetId,
    read: notification.read,
    meta: notification.meta || {},
    createdAt: notification.createdAt,
    actor: actor || null
  });

  return notification;
}

async function markNotificationRead({ userId, notificationId }) {
  return SocialNotification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { read: true } },
    { new: true }
  ).lean();
}

async function markAllNotificationsRead({ userId }) {
  return SocialNotification.updateMany(
    { userId, read: false },
    { $set: { read: true } }
  );
}

async function listNotifications({ userId, cursor, limit }) {
  const normalizedLimit = normalizeLimit(limit, 20, 50);
  const query = { userId };
  const cursorPayload = decodeCursor(cursor);
  applyObjectIdCursorFilter(query, cursorPayload, '_id');

  const rows = await SocialNotification.find(query)
    .sort({ _id: -1 })
    .limit(normalizedLimit + 1)
    .populate('actorId', '_id name avatarUrl')
    .lean();

  const hasMore = rows.length > normalizedLimit;
  const items = hasMore ? rows.slice(0, normalizedLimit) : rows;
  const nextCursor = hasMore ? buildObjectIdCursor(items) : null;

  return {
    items: items.map((item) => ({
      ...item,
      actor: item.actorId || null
    })),
    nextCursor
  };
}

module.exports = {
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  listNotifications
};
