const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    trim: true
  },
  path: {
    type: String,
    required: true,
    trim: true
  },
  thumb: {
    type: String,
    default: ''
  },
  width: {
    type: Number,
    default: null
  },
  height: {
    type: Number,
    default: null
  },
  size: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

mediaSchema.index({ ownerId: 1, _id: -1 }, { name: 'media_owner_cursor' });
mediaSchema.index({ path: 1 }, { name: 'media_path' });

module.exports = mongoose.model('Media', mediaSchema);
