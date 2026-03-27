const express = require('express');
const router = express.Router();
const AppRelease = require('../models/AppRelease');

router.get('/android-update', async (_req, res) => {
  try {
    const release = await AppRelease.findOne({
      platform: 'android',
      isActive: true
    })
      .sort({ latestVersionCode: -1, updatedAt: -1 })
      .lean();

    if (!release) {
      return res.status(404).json({ error: 'android_release_not_found' });
    }

    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.json({
      latestVersion: release.latestVersion,
      latestVersionCode: release.latestVersionCode,
      minSupportedVersion: release.minSupportedVersion,
      minSupportedVersionCode: release.minSupportedVersionCode,
      forceUpdate: Boolean(release.forceUpdate),
      apkUrl: release.apkUrl,
      changelog: Array.isArray(release.changelog) ? release.changelog : [],
      apkSha256: release.apkSha256 || null,
      signingCertSha256: Array.isArray(release.signingCertSha256)
        ? release.signingCertSha256
        : []
    });
  } catch (error) {
    console.error('GET /api/app/android-update error:', error);
    res.status(500).json({ error: 'android_update_lookup_failed' });
  }
});

module.exports = router;
