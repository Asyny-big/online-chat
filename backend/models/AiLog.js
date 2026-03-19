const mongoose = require('mongoose');

const aiLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
    index: true
  },
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    default: null,
    index: true
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
    index: true
  },
  paramsFingerprint: {
    type: String,
    default: null,
    trim: true,
    maxlength: 500,
    index: true
  },
  stepIndex: {
    type: Number,
    default: null,
    min: 0
  },
  planId: {
    type: String,
    default: null,
    trim: true,
    maxlength: 120,
    index: true
  },
  partial: {
    type: Boolean,
    default: false,
    index: true
  },
  success: {
    type: Boolean,
    required: true,
    index: true
  },
  duration: {
    type: Number,
    required: true,
    min: 0
  },
  error: {
    type: String,
    default: null,
    maxlength: 2000
  },
  responseText: {
    type: String,
    default: null,
    maxlength: 4000
  },
  resultData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true
});

aiLogSchema.index({ userId: 1, createdAt: -1 });
aiLogSchema.index({ chatId: 1, createdAt: -1 });
aiLogSchema.index({ messageId: 1, createdAt: -1 });
aiLogSchema.index({
  userId: 1,
  chatId: 1,
  messageId: 1,
  stepIndex: 1,
  action: 1,
  paramsFingerprint: 1,
  success: 1,
  createdAt: -1
});

module.exports = mongoose.model('AiLog', aiLogSchema);
