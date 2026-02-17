const SocialNotification = require('../../models/SocialNotification');
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

function normalizeNotificationPayload({ userId, type, actorId, targetId, meta = {} }) {
  if (!userId || !actorId || !type || !targetId) return null;
  if (String(userId) === String(actorId)) return null;

  return {
    userId,
    type,
    actorId,
    targetId,
    read: false,
    delivered: false,
    meta: meta || {}
  };
}

function createNotification({ userId, type, actorId, targetId, meta = {} }) {
  const payload = normalizeNotificationPayload({ userId, type, actorId, targetId, meta });
  if (!payload) return null;

  // Fire-and-forget enqueue to keep HTTP handlers non-blocking.
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

function createBulkNotifications({ userIds, type, actorId, targetId, meta = {} }) {
  const normalizedUserIds = Array.from(new Set((userIds || []).map((id) => String(id)).filter(Boolean)));
  if (!normalizedUserIds.length || !type || !actorId || !targetId) {
    return { queued: false, accepted: 0 };
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
  return notification.toObject();
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
