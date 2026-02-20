const fs = require('fs');
const admin = require('firebase-admin');
const config = require('../config.local');

let initialized = false;

function readServiceAccount() {
  const fcmConfig = config.FCM || {};

  if (fcmConfig.serviceAccount && typeof fcmConfig.serviceAccount === 'object') {
    return fcmConfig.serviceAccount;
  }

  if (typeof fcmConfig.serviceAccountJsonBase64 === 'string' && fcmConfig.serviceAccountJsonBase64.trim()) {
    try {
      const json = Buffer.from(fcmConfig.serviceAccountJsonBase64, 'base64').toString('utf8');
      return JSON.parse(json);
    } catch (error) {
      console.error('[Push] Failed to parse FCM.serviceAccountJsonBase64:', error?.message || error);
    }
  }

  if (typeof fcmConfig.serviceAccountPath === 'string' && fcmConfig.serviceAccountPath.trim()) {
    try {
      const raw = fs.readFileSync(fcmConfig.serviceAccountPath, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      console.error('[Push] Failed to read FCM.serviceAccountPath:', error?.message || error);
    }
  }

  return null;
}

function normalizeServiceAccount(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const normalized = { ...raw };
  if (typeof normalized.private_key === 'string') {
    normalized.private_key = normalized.private_key.replace(/\\n/g, '\n');
  }
  return normalized;
}

function getMessaging() {
  if (!initialized) {
    const serviceAccount = normalizeServiceAccount(readServiceAccount());
    if (!serviceAccount) {
      return null;
    }

    const missingFields = ['project_id', 'client_email', 'private_key'].filter(
      (key) => !serviceAccount[key]
    );
    if (missingFields.length) {
      console.error('[Push] Firebase Admin init failed: missing service account fields:', missingFields);
      return null;
    }

    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
      }
      initialized = true;
      console.log('[Push] Firebase Admin initialized:', {
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email
      });
    } catch (error) {
      console.error('[Push] Firebase Admin init failed:', error?.message || error);
      return null;
    }
  }

  return admin.messaging();
}

module.exports = {
  getMessaging
};
