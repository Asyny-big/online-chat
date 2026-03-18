const mongoose = require('mongoose');

const fileCleanupTaskSchema = new mongoose.Schema({
  fileUrl: {
    type: String,
    required: true,
    index: true
  },
  reason: {
    type: String,
    default: 'message_deleted'
  },
  entityType: {
    type: String,
    default: 'message'
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  executeAfter: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  lastError: {
    type: String,
    default: ''
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

fileCleanupTaskSchema.index({ status: 1, executeAfter: 1 });

module.exports = mongoose.model('FileCleanupTask', fileCleanupTaskSchema);
