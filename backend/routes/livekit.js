const express = require('express');
const router = express.Router();

const livekit = require('livekit-server-sdk');
const AccessToken = livekit.AccessToken;

router.get('/token', (req, res) => {
  const { room, identity } = req.query;

  if (!room || !identity) {
    return res.status(400).json({ error: 'room and identity are required' });
  }

  if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    return res.status(500).json({
      error: 'LIVEKIT_API_KEY/LIVEKIT_API_SECRET are not configured',
    });
  }

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    { identity }
  );

  at.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  const token = at.toJwt(); // ← ВАЖНО: маленькая t

  res.json({ token });
});

module.exports = router;
