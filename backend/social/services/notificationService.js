const SocialNotification = require('../../models/SocialNotification');
const User = require('../../models/User');
const {
  decodeCursor,
  normalizeLimit,
  buildObjectIdCursor,
  applyObjectIdCursorFilter
} = require('../utils/cursor');
const {
  enqueueNotificationCreate,
  enqueueNotificationBulkCreate
} = require('./queueService');
const { emitToUserSockets } = require('./socketService');

function normalizeNotificationPayload({ userId, type, actorId, targetId, meta = {}, delivered = false }) {
  if (!userId || !actorId || !type || !targetId) return null;
  if (String(userId) === String(actorId)) return null;

  return {
    userId,
    type,
    actorId,
    targetId,
    read: false,
    delivered: Boolean(delivered),
    meta: meta || {}
  };
}

function toRealtimePayload(notification) {
  if (!notification) return null;

  return {
    _id: notification._id,
    userId: notification.userId,
    type: notification.type,
    actorId: notification.actorId?._id || notification.actorId,
    targetId: notification.targetId,
    read: Boolean(notification.read),
    delivered: true,
    meta: notification.meta || {},
    createdAt: notification.createdAt,
    actor: notification.actor || notification.actorId || null
  };
}

async function createNotification({ app, userId, type, actorId, targetId, meta = {} }) {
  const payload = normalizeNotificationPayload({ userId, type, actorId, targetId, meta });
  if (!payload) return null;

  // Realtime branch: persist synchronously and push notification:new immediately.
  if (app) {
    const notification = await persistNotification({
      ...payload,
      delivered: true
    });

    const realtimePayload = toRealtimePayload(notification);
    if (realtimePayload) {
      emitToUserSockets(app, String(userId), 'notification:new', realtimePayload);
    }

    return notification;
  }

  // Queue branch for background contexts without app/socket.
  enqueueNotificationCreate(payload)
    .then((ok) => {
      if (!ok) {
        setImmediate(() => {
          persistNotification(payload).catch((error) => {
            console.error('[Social][Notification] fallback persist failed:', error?.message || error);
          });
        });
      }
    })
    .catch((error) => {
      console.error('[Social][Notification] enqueue failed:', error?.message || error);
    });

  return { queued: true };
}

async function createBulkNotifications({ app, userIds, type, actorId, targetId, meta = {} }) {
  const normalizedUserIds = Array.from(new Set((userIds || []).map((id) => String(id)).filter(Boolean)));
  if (!normalizedUserIds.length || !type || !actorId || !targetId) {
    return { queued: false, accepted: 0 };
  }

  if (app) {
    const actor = await User.findById(actorId).select('_id name avatarUrl').lean();

    const docs = normalizedUserIds
      .map((userId) => normalizeNotificationPayload({
        userId,
        type,
        actorId,
        targetId,
        meta,
        delivered: true
      }))
      .filter(Boolean);

    if (!docs.length) {
      return { queued: false, accepted: 0 };
    }

    const inserted = await SocialNotification.insertMany(docs, { ordered: false });
    inserted.forEach((notification) => {
      const realtimePayload = toRealtimePayload({
        ...notification.toObject(),
        actor: actor || null
      });
      emitToUserSockets(app, String(notification.userId), 'notification:new', realtimePayload);
    });

    return { queued: false, accepted: inserted.length };
  }

  enqueueNotificationBulkCreate({
    userIds: normalizedUserIds,
    type,
    actorId,
    targetId,
    meta
  }).then((ok) => {
    if (!ok) {
      setImmediate(() => {
        persistBulkNotifications({
          userIds: normalizedUserIds,
          type,
          actorId,
          targetId,
          meta
        }).catch((error) => {
          console.error('[Social][Notification] fallback bulk persist failed:', error?.message || error);
        });
      });
    }
  }).catch((error) => {
    console.error('[Social][Notification] enqueue bulk failed:', error?.message || error);
  });

  return { queued: true, accepted: normalizedUserIds.length };
}

async function persistNotification(payload) {
  const normalized = normalizeNotificationPayload(payload || {});
  if (!normalized) return null;

  const notification = await SocialNotification.create(normalized);
  await notification.populate('actorId', '_id name avatarUrl');
  const plain = notification.toObject();

  return {
    ...plain,
    actor: plain.actorId || null
  };
}

async function persistBulkNotifications({ userIds, type, actorId, targetId, meta = {} }) {
  const docs = (userIds || [])
    .map((userId) => normalizeNotificationPayload({ userId, type, actorId, targetId, meta }))
    .filter(Boolean);

  if (!docs.length) {
    return { inserted: 0 };
  }

  await SocialNotification.insertMany(docs, { ordered: false });
  return { inserted: docs.length };
}

async function getUndeliveredNotifications({ userId, limit = 200 }) {
  const normalizedLimit = normalizeLimit(limit, 100, 500);
  const rows = await SocialNotification.find({
    userId,
    $or: [{ delivered: false }, { delivered: { $exists: false } }]
  })
    .sort({ _id: 1 })
    .limit(normalizedLimit)
    .populate('actorId', '_id name avatarUrl')
    .lean();

  return rows.map((item) => ({
    ...item,
    actor: item.actorId || null
  }));
}

async function markNotificationsDelivered({ userId, notificationIds }) {
  const ids = Array.from(new Set((notificationIds || []).map((id) => String(id)).filter(Boolean)));
  if (!ids.length) {
    return { modifiedCount: 0 };
  }

  return SocialNotification.updateMany(
    {
      _id: { $in: ids },
      userId,
      $or: [{ delivered: false }, { delivered: { $exists: false } }]
    },
    { $set: { delivered: true } }
  );
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
  createBulkNotifications,
  persistNotification,
  persistBulkNotifications,
  getUndeliveredNotifications,
  markNotificationsDelivered,
  markNotificationRead,
  markAllNotificationsRead,
  listNotifications
};
