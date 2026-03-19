const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true
  },
  initiator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['audio', 'video'],
    default: 'video'
  },
  status: {
    type: String,
    enum: ['ringing', 'active', 'ended', 'missed', 'declined', 'busy'],
    default: 'ringing'
  },
  activeChatLock: {
    type: String,
    default: null
  },
  // Текущие участники звонка
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    joinedAt: { type: Date, default: Date.now },
    leftAt: Date
  }],
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: Date,
  // Причина завершения
  endReason: {
    type: String,
    enum: ['completed', 'no_answer', 'declined', 'error', 'busy']
  }
});

// Проверка, может ли пользователь присоединиться к звонку
callSchema.methods.canJoin = function(userId) {
  // Пользователь должен быть участником чата (проверяется на уровне сервиса)
  // Здесь проверяем только статус звонка
  return this.status === 'ringing' || this.status === 'active';
};

// Проверка, участвует ли пользователь в звонке
callSchema.methods.isInCall = function(userId) {
  return this.participants.some(
    p => p.user.toString() === userId.toString() && !p.leftAt
  );
};

// Индексы
callSchema.pre('validate', function(next) {
  if (this.chat && ['ringing', 'active'].includes(String(this.status || ''))) {
    this.activeChatLock = `chat:${this.chat.toString()}`;
  } else {
    this.activeChatLock = null;
  }
  next();
});

callSchema.index({ chat: 1, status: 1 });
callSchema.index({ startedAt: -1 });
callSchema.index(
  { activeChatLock: 1 },
  {
    unique: true,
    partialFilterExpression: {
      activeChatLock: { $type: 'string' }
    }
  }
);

module.exports = mongoose.model('Call', callSchema);
