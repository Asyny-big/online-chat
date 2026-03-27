const mongoose = require('mongoose');

const appReleaseSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ['android'],
      default: 'android',
      index: true
    },
    latestVersion: {
      type: String,
      required: true,
      trim: true
    },
    latestVersionCode: {
      type: Number,
      required: true,
      min: 1
    },
    minSupportedVersion: {
      type: String,
      required: true,
      trim: true
    },
    minSupportedVersionCode: {
      type: Number,
      required: true,
      min: 1
    },
    forceUpdate: {
      type: Boolean,
      default: false
    },
    apkUrl: {
      type: String,
      required: true,
      trim: true
    },
    changelog: {
      type: [String],
      default: []
    },
    apkSha256: {
      type: String,
      default: ''
    },
    signingCertSha256: {
      type: [String],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

appReleaseSchema.index(
  { platform: 1, isActive: 1, latestVersionCode: -1, updatedAt: -1 },
  { name: 'app_release_lookup' }
);

module.exports = mongoose.models.AppRelease || mongoose.model('AppRelease', appReleaseSchema);
