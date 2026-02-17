const mongoose = require('mongoose');
const {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead
} = require('../services/notificationService');
const { sendServiceError } = require('../utils/controller');

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

async function getNotifications(req, res) {
  try {
    const result = await listNotifications({
      userId: req.userId,
      cursor: req.query?.cursor,
      limit: req.query?.limit
    });
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to load notifications');
  }
}

async function readNotification(req, res) {
  try {
    const { notificationId } = req.params;
    if (!isValidObjectId(notificationId)) {
      return res.status(400).json({ error: 'Invalid notificationId' });
    }

    const result = await markNotificationRead({
      userId: req.userId,
      notificationId
    });

    if (!result) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to mark notification as read');
  }
}

async function readAllNotifications(req, res) {
  try {
    const result = await markAllNotificationsRead({ userId: req.userId });
    return res.json({
      success: true,
      modifiedCount: result?.modifiedCount || 0
    });
  } catch (error) {
    return sendServiceError(res, error, 'Failed to mark notifications as read');
  }
}

module.exports = {
  getNotifications,
  readNotification,
  readAllNotifications
};
