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

function buildTurnUrls() {
  const host = config.TURN_HOST || 'govchat.ru';

  // Базовые порты coturn часто: 3478 (udp/tcp), 5349 (tls). 443/80 — опционально.
  const port3478 = Number(config.TURN_PORT || 3478);
  const tlsPort = Number(config.TURN_TLS_PORT || 5349);
  const enable443 = Boolean(config.TURN_ENABLE_443);
  const enable80 = Boolean(config.TURN_ENABLE_80);

  const urls = [
    `turn:${host}:${port3478}?transport=udp`,
    `turn:${host}:${port3478}?transport=tcp`,
  ];

  // TURN over TLS (желательно для мобильных/корп сетей).
  if (tlsPort > 0) {
    urls.push(`turns:${host}:${tlsPort}?transport=tcp`);
  }
  if (enable443) {
    urls.push(`turns:${host}:443?transport=tcp`);
    urls.push(`turn:${host}:443?transport=tcp`);
  }
  if (enable80) {
    urls.push(`turn:${host}:80?transport=tcp`);
  }

  return urls;
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
          urls: buildTurnUrls(),
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
          urls: buildTurnUrls(),
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
