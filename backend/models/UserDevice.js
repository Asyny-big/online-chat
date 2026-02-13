const mongoose = require('mongoose');

const userDeviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    platform: {
      type: String,
      required: true,
      enum: ['android', 'ios', 'web'],
      default: 'android'
    },
    appVersion: {
      type: String,
      default: ''
    },
    lastSeen: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

userDeviceSchema.index({ userId: 1, platform: 1, lastSeen: -1 });

module.exports = mongoose.model('UserDevice', userDeviceSchema);
