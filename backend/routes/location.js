const express = require('express');
const mongoose = require('mongoose');

const Chat = require('../models/Chat');
const User = require('../models/User');
const LocationPermission = require('../models/LocationPermission');
const authMiddleware = require('../middleware/auth');
const { NotificationService } = require('../services/notificationService');
const {
  LOCATION_REQUEST_RATE_LIMIT_MS,
  LOCATION_REQUEST_TTL_MS,
  getParticipantUserId,
  startLocationRequest
} = require('../services/locationRequestService');

const router = express.Router();

router.use(authMiddleware);

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || '').trim());
}

async function loadPrivateChatWithTarget(viewerUserId, targetUserId) {
  return Chat.findOne({
    type: 'private',
    'participants.user': { $all: [viewerUserId, targetUserId] }
  });
}

router.get('/permissions/:targetUserId', async (req, res) => {
  try {
    const userId = req.userId;
    const { targetUserId } = req.params;

    if (!isObjectId(targetUserId) || String(targetUserId) === String(userId)) {
      return res.status(400).json({ error: 'Invalid target user', code: 'INVALID_TARGET_USER' });
    }

    const target = await User.findById(targetUserId).select('_id name').lean();
    if (!target) {
      return res.status(404).json({ error: 'Target user not found', code: 'TARGET_USER_NOT_FOUND' });
    }

    const chat = await loadPrivateChatWithTarget(userId, targetUserId);
    if (!chat) {
      return res.status(403).json({ error: 'Private chat is required', code: 'PRIVATE_CHAT_REQUIRED' });
    }

    const [canRequestTarget, targetCanRequestMe] = await Promise.all([
      LocationPermission.findOne({
        ownerUser: targetUserId,
        allowedUser: userId,
        enabled: true,
        revokedAt: null
      }).lean(),
      LocationPermission.findOne({
        ownerUser: userId,
        allowedUser: targetUserId,
        enabled: true,
        revokedAt: null
      }).lean()
    ]);

    return res.json({
      targetUserId,
      canRequestTarget: Boolean(canRequestTarget),
      targetCanRequestMe: Boolean(targetCanRequestMe),
      rateLimitSeconds: Math.ceil(LOCATION_REQUEST_RATE_LIMIT_MS / 1000),
      requestTtlSeconds: Math.ceil(LOCATION_REQUEST_TTL_MS / 1000)
    });
  } catch (error) {
    console.error('[Location] permission status error:', error);
    return res.status(500).json({ error: 'Location permission status failed', code: 'LOCATION_PERMISSION_STATUS_FAILED' });
  }
});

router.put('/permissions/:allowedUserId', async (req, res) => {
  try {
    const ownerUserId = req.userId;
    const { allowedUserId } = req.params;
    const enabled = req.body?.enabled !== false;

    if (!isObjectId(allowedUserId) || String(allowedUserId) === String(ownerUserId)) {
      return res.status(400).json({ error: 'Invalid allowed user', code: 'INVALID_ALLOWED_USER' });
    }

    const allowedUser = await User.findById(allowedUserId).select('_id').lean();
    if (!allowedUser) {
      return res.status(404).json({ error: 'Allowed user not found', code: 'ALLOWED_USER_NOT_FOUND' });
    }

    const chat = await loadPrivateChatWithTarget(ownerUserId, allowedUserId);
    if (!chat) {
      return res.status(403).json({ error: 'Private chat is required', code: 'PRIVATE_CHAT_REQUIRED' });
    }

    const now = new Date();
    const permission = await LocationPermission.findOneAndUpdate(
      { ownerUser: ownerUserId, allowedUser: allowedUserId },
      {
        $set: {
          enabled,
          revokedAt: enabled ? null : now,
          updatedAt: now
        },
        $setOnInsert: {
          ownerUser: ownerUserId,
          allowedUser: allowedUserId,
          grantedAt: now,
          requestCount: 0
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const io = req.app.get('io');
    io?.to?.(`user:${ownerUserId}`)?.to?.(`user:${allowedUserId}`)?.emit?.('location:permission-updated', {
      ownerUserId,
      allowedUserId,
      enabled: permission.enabled,
      updatedAt: permission.updatedAt
    });

    return res.json({
      success: true,
      ownerUserId,
      allowedUserId,
      enabled: permission.enabled
    });
  } catch (error) {
    console.error('[Location] permission update error:', error);
    return res.status(500).json({ error: 'Location permission update failed', code: 'LOCATION_PERMISSION_UPDATE_FAILED' });
  }
});

router.post('/requests', async (req, res) => {
  try {
    const requesterUserId = req.userId;
    const { chatId, targetUserId } = req.body || {};

    if (!isObjectId(chatId) || !isObjectId(targetUserId) || String(targetUserId) === String(requesterUserId)) {
      return res.status(400).json({ error: 'Invalid location request', code: 'INVALID_LOCATION_REQUEST' });
    }

    const chat = await Chat.findById(chatId).select('_id type participants isAiChat').lean();
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found', code: 'CHAT_NOT_FOUND' });
    }

    const participantIds = (chat.participants || []).map(getParticipantUserId).filter(Boolean);
    if (!participantIds.includes(String(requesterUserId)) || !participantIds.includes(String(targetUserId))) {
      return res.status(403).json({ error: 'Chat access denied', code: 'CHAT_ACCESS_DENIED' });
    }

    const [requesterUser, targetUser] = await Promise.all([
      User.findById(requesterUserId).select('_id name').lean(),
      User.findById(targetUserId).select('_id name').lean()
    ]);

    if (!requesterUser || !targetUser) {
      return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    }

    const io = req.app.get('io');
    const socketData = req.app.get('socketData');
    const notificationService = new NotificationService({
      userSockets: socketData?.userSockets,
      io
    });

    const result = await startLocationRequest({
      io,
      userSockets: socketData?.userSockets,
      chat,
      requesterUser,
      targetUser,
      notificationService
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('[Location] request error:', error);
    return res.status(500).json({ error: 'Location request failed', code: 'LOCATION_REQUEST_FAILED' });
  }
});

module.exports = router;
