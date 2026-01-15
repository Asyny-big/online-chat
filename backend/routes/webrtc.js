const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const authMiddleware = require('../middleware/auth');
const config = require('../config.local');

router.use(authMiddleware);

/**
 * Генерация time-limited TURN credentials
 * Использует HMAC-SHA1 согласно RFC 5389 и спецификации coturn
 * 
 * username = "<expiryUnixTimestamp>:<uniqueId>"
 * credential = HMAC-SHA1(username, TURN_SECRET) в base64
 */
function generateTurnCredentials(userId) {
  const turnSecret = config.TURN_SECRET;
  
  if (!turnSecret) {
    throw new Error('TURN_SECRET not configured');
  }
  
  // Срок действия: 1 час от текущего момента
  const ttl = 3600; // секунды
  const expiryTimestamp = Math.floor(Date.now() / 1000) + ttl;
  
  // Формат username: "timestamp:userId"
  const username = `${expiryTimestamp}:${userId}`;
  
  // HMAC-SHA1 от username с секретом, результат в base64
  const hmac = crypto.createHmac('sha1', turnSecret);
  hmac.update(username);
  const credential = hmac.digest('base64');
  
  return {
    username,
    credential,
    ttl
  };
}

/**
 * GET /api/webrtc/ice
 * Возвращает ICE серверы с временными TURN credentials
 */
router.get('/ice', (req, res) => {
  try {
    const userId = req.userId;
    
    // Генерируем credentials для TURN
    const turnCredentials = generateTurnCredentials(userId);
    
    const iceServers = {
      iceServers: [
        // STUN серверы (публичные, не требуют авторизации)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        
        // Собственный TURN сервер с временными credentials
        {
          urls: [
            'turn:govchat.ru:3478?transport=udp',
            'turn:govchat.ru:3478?transport=tcp'
          ],
          username: turnCredentials.username,
          credential: turnCredentials.credential
        }
      ],
      iceCandidatePoolSize: 10
    };
    
    console.log(`[WebRTC] Generated ICE config for user ${userId}, TURN expires in ${turnCredentials.ttl}s`);
    
    res.json(iceServers);
  } catch (error) {
    console.error('[WebRTC] Error generating ICE config:', error);
    res.status(500).json({ error: 'Failed to generate ICE configuration' });
  }
});

/**
 * GET /api/webrtc/config
 * Возвращает ICE серверы с временными TURN credentials + конфиг SFU (ion-sfu json-rpc)
 *
 * ВАЖНО:
 * - TURN credentials генерируются ТОЛЬКО на backend (TURN_SECRET не уходит на frontend)
 * - Endpoint защищён authMiddleware
 */
router.get('/config', (req, res) => {
  try {
    const userId = req.userId;

    const turnCredentials = generateTurnCredentials(userId);

    const response = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: [
            'turn:govchat.ru:3478?transport=udp',
            'turn:govchat.ru:3478?transport=tcp'
          ],
          username: turnCredentials.username,
          credential: turnCredentials.credential
        }
      ],
      iceCandidatePoolSize: 10,
    };

    console.log(`[WebRTC] Generated WebRTC config for user ${userId}, TURN expires in ${turnCredentials.ttl}s`);
    res.json(response);
  } catch (error) {
    console.error('[WebRTC] Error generating WebRTC config:', error);
    res.status(500).json({ error: 'Failed to generate WebRTC configuration' });
  }
});

module.exports = router;
