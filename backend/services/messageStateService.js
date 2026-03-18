const Chat = require('../models/Chat');
const Message = require('../models/Message');

const DELETED_MESSAGE_TEXT = 'Сообщение удалено';

function buildLastMessageText(message) {
  if (!message) return '';
  if (message.deleted) return DELETED_MESSAGE_TEXT;

  const messageType = String(message.type || 'text').toLowerCase();
  if (message.text) {
    return message.text;
  }

  if (['audio', 'voice'].includes(messageType)) {
    return '🎤 Голосовое сообщение';
  }
  if (messageType === 'video_note') {
    return '🎥 Видео-кружок';
  }
  if (messageType === 'image') {
    return '📷 Изображение';
  }
  if (messageType === 'video') {
    return '🎥 Видео';
  }
  if (messageType === 'file') {
    return '📎 Файл';
  }

  return 'Сообщение';
}

function buildLastMessagePayload(message) {
  if (!message) return null;

  const senderId = message.sender?._id?.toString?.()
    || message.sender?.toString?.()
    || null;
  const senderName = message.sender?.name || message.senderName || '';

  return {
    messageId: message._id,
    text: buildLastMessageText(message),
    senderId,
    senderName,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt || message.createdAt,
    revision: Number(message.revision || 0),
    type: message.deleted ? 'text' : String(message.type || 'text').toLowerCase()
  };
}

async function syncChatLastMessage(chatId) {
  const latestMessage = await Message.findOne({ chat: chatId })
    .populate('sender', 'name')
    .sort({ createdAt: -1, _id: -1 });

  if (!latestMessage) {
    await Chat.findByIdAndUpdate(chatId, {
      $unset: { lastMessage: 1 },
      $set: { updatedAt: new Date() }
    });
    return null;
  }

  const lastMessage = buildLastMessagePayload(latestMessage);
  await Chat.findByIdAndUpdate(chatId, {
    $set: {
      lastMessage,
      updatedAt: new Date()
    }
  });
  return lastMessage;
}

module.exports = {
  DELETED_MESSAGE_TEXT,
  buildLastMessagePayload,
  syncChatLastMessage
};
