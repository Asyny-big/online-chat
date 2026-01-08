const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const authMiddleware = require('../middleware/auth');
const { checkChatAccess } = require('../middleware/checkChatAccess');
const fs = require('fs');
const path = require('path');

router.use(authMiddleware);

// Путь к папке uploads
const uploadsDir = path.join(__dirname, '..', 'uploads');

// Функция удаления файла вложения
const deleteAttachmentFile = (attachmentUrl) => {
  if (!attachmentUrl) return;
  
  try {
    // Извлекаем имя файла из URL (например /uploads/filename.ext -> filename.ext)
    const filename = attachmentUrl.split('/').pop();
    const filePath = path.join(uploadsDir, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Messages] Deleted file: ${filename}`);
    }
  } catch (err) {
    console.error('[Messages] Error deleting file:', err);
  }
};

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

// Удаление одного сообщения
router.delete('/:chatId/:messageId', checkChatAccess, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const userId = req.userId;
    
    const message = await Message.findOne({ _id: messageId, chat: chatId });
    
    if (!message) {
      return res.status(404).json({ error: 'Сообщение не найдено' });
    }
    
    // Проверяем что пользователь - отправитель сообщения
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ error: 'Можно удалять только свои сообщения' });
    }
    
    // Удаляем файл вложения если есть
    if (message.attachment?.url) {
      deleteAttachmentFile(message.attachment.url);
    }
    
    await Message.deleteOne({ _id: messageId });
    
    // Уведомляем всех участников чата через socket
    const io = req.app.get('io');
    io.to(`chat:${chatId}`).emit('message:deleted', {
      chatId,
      messageId,
      deletedBy: userId
    });
    
    res.json({ success: true, messageId });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Ошибка удаления сообщения' });
  }
});

module.exports = router;
