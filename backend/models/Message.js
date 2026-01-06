const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Тип сообщения
  type: {
    type: String,
    enum: ['text', 'file', 'audio', 'image', 'video', 'system'],
    default: 'text'
  },
  // Текст сообщения
  text: {
    type: String,
    default: '',
    maxlength: 10000
  },
  // Вложение
  attachment: {
    url: String,
    originalName: String,
    mimeType: String,
    size: Number // в байтах
  },
  // Статусы прочтения (для каждого участника)
  readBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }],
  // Системное сообщение (добавление участника, создание группы и т.д.)
  systemEvent: {
    type: { type: String }, // 'user_added', 'user_removed', 'chat_created', etc.
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Составной индекс для пагинации сообщений
messageSchema.index({ chat: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
