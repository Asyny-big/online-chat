const mongoose = require('mongoose');

const aiPendingActionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true,
    index: true
  },
  planId: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
    index: true
  },
  actions: {
    type: [{
      action: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120
      },
      params: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      }
    }],
    default: []
  },
  summary: {
    type: String,
    default: '',
    trim: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'expired', 'executed'],
    default: 'pending',
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

aiPendingActionSchema.index(
  { userId: 1, chatId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'pending'
    }
  }
);

module.exports = mongoose.model('AiPendingAction', aiPendingActionSchema);
