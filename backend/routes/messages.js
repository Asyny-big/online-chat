const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const authMiddleware = require('../middleware/auth');
const { checkChatAccess } = require('../middleware/checkChatAccess');

router.use(authMiddleware);

// ИСПРАВЛЕНО: Используем middleware вместо ручной проверки
router.get('/:chatId', checkChatAccess, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { before, limit = 50 } = req.query;

    const query = { chat: chatId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate('sender', 'name phone avatarUrl')
      .populate('systemEvent.targetUser', 'name')
      .populate('systemEvent.actorUser', 'name')
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit), 100)) // Ограничение максимума
      .lean();

    res.json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Ошибка получения сообщений' });
  }
});

module.exports = router;
