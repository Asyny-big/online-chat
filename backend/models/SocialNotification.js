const mongoose = require('mongoose');

const socialNotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['like', 'comment', 'friend_request', 'message'],
    required: true
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  read: {
    type: Boolean,
    default: false
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { collection: 'notifications' });

socialNotificationSchema.index(
  { userId: 1, read: 1, _id: -1 },
  { name: 'notification_user_read_cursor' }
);
socialNotificationSchema.index(
  { userId: 1, _id: -1 },
  { name: 'notification_user_cursor' }
);

module.exports = mongoose.model('SocialNotification', socialNotificationSchema);
