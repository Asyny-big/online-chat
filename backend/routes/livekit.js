const express = require('express');
const { AccessToken } = require('livekit-server-sdk');

const router = express.Router();

router.get('/token', (req, res) => {
  const room = req.query?.room;
  const identity = req.query?.identity;

  if (!room || typeof room !== 'string' || !room.trim()) {
    return res.status(400).json({ error: 'room is required' });
  }

  if (!identity || typeof identity !== 'string' || !identity.trim()) {
    return res.status(400).json({ error: 'identity is required' });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return res.status(500).json({
      error: 'LIVEKIT_API_KEY/LIVEKIT_API_SECRET are not configured'
    });
  }

  const token = new AccessToken(apiKey, apiSecret, { identity: identity.trim() })
    .addGrant({
      room: room.trim(),
      roomJoin: true,
      canPublish: true,
      canSubscribe: true
    })
    .toJWT();

  return res.json({ token });
});

module.exports = router;