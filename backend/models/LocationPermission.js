const mongoose = require('mongoose');

const locationPermissionSchema = new mongoose.Schema({
  ownerUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  allowedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  enabled: {
    type: Boolean,
    default: true,
    index: true
  },
  grantedAt: {
    type: Date,
    default: Date.now
  },
  revokedAt: {
    type: Date,
    default: null
  },
  lastRequestedAt: {
    type: Date,
    default: null
  },
  requestCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

locationPermissionSchema.index({ ownerUser: 1, allowedUser: 1 }, { unique: true });
locationPermissionSchema.index({ allowedUser: 1, enabled: 1 });

module.exports = mongoose.model('LocationPermission', locationPermissionSchema);
