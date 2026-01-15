const express = require('express');
const { AccessToken } = require('livekit-server-sdk');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const LIVEKIT_URL = 'wss://govchat.ru/rtc';

router.post('/token', authMiddleware, (req, res) => {
  const { roomId } = req.body || {};

  if (!roomId || typeof roomId !== 'string' || !roomId.trim()) {
    return res.status(400).json({ error: 'roomId is required' });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: 'LiveKit credentials are not configured' });
  }

  const identity = String(req.userId);

  const token = new AccessToken(apiKey, apiSecret, { identity })
    .addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canSubscribe: true
    })
    .toJwt();

  return res.json({
    url: LIVEKIT_URL,
    token
  });
});

module.exports = router;