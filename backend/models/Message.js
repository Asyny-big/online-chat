const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'file', 'audio', 'image', 'video', 'voice', 'video_note', 'system'],
    default: 'text'
  },
  text: {
    type: String,
    default: '',
    maxlength: 10000
  },
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  revision: {
    type: Number,
    default: 0
  },
  deleted: {
    type: Boolean,
    default: false
  },
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  attachment: {
    url: String,
    originalName: String,
    mimeType: String,
    size: Number,
    durationMs: Number,
    thumbnailUrl: String,
    previewUrl: String
  },
  deliveredTo: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deliveredAt: { type: Date, default: Date.now }
  }],
  readBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }],
  systemEvent: {
    type: { type: String },
    stage: {
      type: String,
      enum: ['progress', 'final'],
      default: 'final'
    },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sourceMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    planId: { type: String, default: null }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

messageSchema.index({ chat: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
