const mongoose = require('mongoose');

const aiMemorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  key: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

aiMemorySchema.index({ userId: 1, key: 1 }, { unique: true });
aiMemorySchema.pre('save', function preSave(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('AiMemory', aiMemorySchema);
