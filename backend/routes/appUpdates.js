const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const downloadsDir = path.join(__dirname, '../downloads');
const releaseManifestPath = path.join(downloadsDir, 'android-release.json');
const apkMimeType = 'application/vnd.android.package-archive';

function readAndroidReleaseManifest() {
  const raw = fs.readFileSync(releaseManifestPath, 'utf8');
  const parsed = JSON.parse(raw);

  const latestVersion = String(parsed?.latestVersion || '').trim();
  const latestVersionCode = Number(parsed?.latestVersionCode || 0);
  const minSupportedVersion = String(parsed?.minSupportedVersion || '').trim();
  const minSupportedVersionCode = Number(parsed?.minSupportedVersionCode || 0);
  const apkFile = path.basename(String(parsed?.apkFile || '').trim());

  if (!latestVersion) {
    throw new Error('android-release.json: latestVersion is required');
  }
  if (!Number.isFinite(latestVersionCode) || latestVersionCode <= 0) {
    throw new Error('android-release.json: latestVersionCode must be a positive number');
  }
  if (!minSupportedVersion) {
    throw new Error('android-release.json: minSupportedVersion is required');
  }
  if (!Number.isFinite(minSupportedVersionCode) || minSupportedVersionCode <= 0) {
    throw new Error('android-release.json: minSupportedVersionCode must be a positive number');
  }
  if (!apkFile || !apkFile.toLowerCase().endsWith('.apk')) {
    throw new Error('android-release.json: apkFile must point to an .apk file');
  }

  const apkPath = path.join(downloadsDir, apkFile);
  if (!fs.existsSync(apkPath)) {
    throw new Error(`android-release.json: APK file not found: ${apkFile}`);
  }

  return {
    latestVersion,
    latestVersionCode,
    minSupportedVersion,
    minSupportedVersionCode,
    forceUpdate: Boolean(parsed?.forceUpdate),
    apkFile,
    apkPath,
    changelog: Array.isArray(parsed?.changelog)
      ? parsed.changelog.map((item) => String(item || '').trim()).filter(Boolean)
      : [],
    apkSha256: String(parsed?.apkSha256 || '').trim() || null,
    signingCertSha256: Array.isArray(parsed?.signingCertSha256)
      ? parsed.signingCertSha256.map((item) => String(item || '').trim()).filter(Boolean)
      : []
  };
}

router.get('/android-update', async (_req, res) => {
  try {
    const release = readAndroidReleaseManifest();

    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.json({
      latestVersion: release.latestVersion,
      latestVersionCode: release.latestVersionCode,
      minSupportedVersion: release.minSupportedVersion,
      minSupportedVersionCode: release.minSupportedVersionCode,
      forceUpdate: release.forceUpdate,
      apkUrl: `/api/app/android-apk/${encodeURIComponent(release.apkFile)}`,
      changelog: release.changelog,
      apkSha256: release.apkSha256,
      signingCertSha256: release.signingCertSha256
    });
  } catch (error) {
    console.error('GET /api/app/android-update error:', error);
    res.status(500).json({ error: 'android_update_lookup_failed' });
  }
});

router.get('/android-apk/latest', async (_req, res) => {
  try {
    const release = readAndroidReleaseManifest();
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.setHeader('Content-Type', apkMimeType);
    return res.download(release.apkPath, release.apkFile);
  } catch (error) {
    console.error('GET /api/app/android-apk/latest error:', error);
    res.status(500).json({ error: 'android_apk_lookup_failed' });
  }
});

router.get('/android-apk/:filename', async (req, res) => {
  try {
    const release = readAndroidReleaseManifest();
    const requestedFile = path.basename(String(req.params.filename || '').trim());

    if (!requestedFile || requestedFile !== release.apkFile) {
      return res.status(404).json({ error: 'android_apk_not_found' });
    }

    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.setHeader('Content-Type', apkMimeType);
    return res.download(release.apkPath, release.apkFile);
  } catch (error) {
    console.error('GET /api/app/android-apk/:filename error:', error);
    res.status(500).json({ error: 'android_apk_download_failed' });
  }
});

module.exports = router;
