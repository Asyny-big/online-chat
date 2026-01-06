const Chat = require('../models/Chat');

/**
 * Middleware для проверки, что пользователь является участником чата.
 * Ожидает chatId в req.params.chatId
 */
const checkChatAccess = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;

    if (!chatId) {
      return res.status(400).json({ error: 'chatId обязателен' });
    }

    const chat = await Chat.findById(chatId);
    
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден' });
    }

    if (!chat.isParticipant(userId)) {
      return res.status(403).json({ error: 'Нет доступа к этому чату' });
    }

    // Прикрепляем чат к request для использования в route handler
    req.chat = chat;
    next();
  } catch (error) {
    console.error('checkChatAccess error:', error);
    res.status(500).json({ error: 'Ошибка проверки доступа' });
  }
};

/**
 * Проверка что пользователь — админ чата (для групповых операций)
 */
const checkChatAdmin = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;

    const chat = await Chat.findById(chatId);
    
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден' });
    }

    if (chat.type !== 'group') {
      return res.status(400).json({ error: 'Операция доступна только для групп' });
    }

    if (!chat.isAdmin(userId)) {
      return res.status(403).json({ error: 'Требуются права администратора' });
    }

    req.chat = chat;
    next();
  } catch (error) {
    console.error('checkChatAdmin error:', error);
    res.status(500).json({ error: 'Ошибка проверки прав' });
  }
};

module.exports = { checkChatAccess, checkChatAdmin };
