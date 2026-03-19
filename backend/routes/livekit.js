const express = require('express');
const router = express.Router();

const livekit = require('livekit-server-sdk');
const AccessToken = livekit.AccessToken;
const authMiddleware = require('../middleware/auth');
const Call = require('../models/Call');
const Chat = require('../models/Chat');

router.use(authMiddleware);

router.get('/token', async (req, res) => {
  const { room, identity } = req.query;

  if (!room || !identity) {
    return res.status(400).json({ error: 'room and identity are required' });
  }

  if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    return res.status(500).json({
      error: 'LIVEKIT_API_KEY/LIVEKIT_API_SECRET are not configured',
    });
  }

  if (String(identity) !== String(req.userId)) {
    return res.status(403).json({ error: 'identity does not match authenticated user' });
  }

  try {
    const call = await Call.findById(room).select('_id chat status');
    if (!call || !['ringing', 'active'].includes(String(call.status || ''))) {
      return res.status(404).json({ error: 'call not found' });
    }

    const chat = await Chat.findById(call.chat).select('_id participants.user');
    if (!chat || !chat.isParticipant(req.userId)) {
      return res.status(403).json({ error: 'chat access denied' });
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

    const token = await at.toJwt(); // 🔥 ВАЖНО

    res.json({ token });
  } catch (err) {
    console.error('[LiveKit token error]', err);
    res.status(500).json({ error: 'failed to generate token' });
  }
});

module.exports = router;
