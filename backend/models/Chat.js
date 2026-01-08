const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['private', 'group'],
    required: true
  },
  // Для групповых чатов
  name: {
    type: String,
    default: null,
    maxlength: 100
  },
  avatarUrl: {
    type: String,
    default: null
  },
  // Участники чата
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    // Для мьютов и настроек
    muted: {
      type: Boolean,
      default: false
    }
  }],
  // Кеш последнего сообщения для быстрого отображения
  lastMessage: {
    text: String,
    senderId: mongoose.Schema.Types.ObjectId,
    senderName: String,
    createdAt: Date,
    type: { type: String, enum: ['text', 'file', 'audio', 'image', 'video', 'system'] }
  },
  // Для приватных чатов: уникальный ключ из двух userId
  privateKey: {
    type: String,
    unique: true,
    sparse: true, // null значения игнорируются в уникальном индексе
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Генерация privateKey для приватных чатов
chatSchema.statics.generatePrivateKey = function(userId1, userId2) {
  const sorted = [userId1.toString(), userId2.toString()].sort();
  return `private:${sorted[0]}:${sorted[1]}`;
};

// ИСПРАВЛЕНО: Атомарный findOrCreate для private chat
chatSchema.statics.findOrCreatePrivateChat = async function(userId1, userId2) {
  const privateKey = this.generatePrivateKey(userId1, userId2);
  
  try {
    // Пытаемся создать с upsert для атомарности
    const chat = await this.findOneAndUpdate(
      { privateKey },
      {
        $setOnInsert: {
          type: 'private',
          privateKey,
          participants: [
            { user: userId1, role: 'member' },
            { user: userId2, role: 'member' }
          ],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      { 
        upsert: true, 
        new: true,
        setDefaultsOnInsert: true
      }
    );
    
    return { chat, created: !chat.updatedAt || chat.createdAt.getTime() === chat.updatedAt.getTime() };
  } catch (error) {
    // Если duplicate key (race condition), просто находим существующий
    if (error.code === 11000) {
      const chat = await this.findOne({ privateKey });
      return { chat, created: false };
    }
    throw error;
  }
};

// Для обратной совместимости
chatSchema.statics.findPrivateChat = function(userId1, userId2) {
  const privateKey = this.generatePrivateKey(userId1, userId2);
  return this.findOne({ privateKey });
};

// Проверка, является ли пользователь участником
chatSchema.methods.isParticipant = function(userId) {
  return this.participants.some(p => {
    const participantId = p.user?._id?.toString?.() || p.user?.toString?.() || p.user;
    return participantId === userId.toString();
  });
};

// Проверка, является ли пользователь админом
chatSchema.methods.isAdmin = function(userId) {
  const participant = this.participants.find(p => {
    const participantId = p.user?._id?.toString?.() || p.user?.toString?.() || p.user;
    return participantId === userId.toString();
  });
  return participant && participant.role === 'admin';
};

// Обновление updatedAt при изменении
chatSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Составной индекс для быстрого поиска чатов пользователя
chatSchema.index({ 'participants.user': 1, updatedAt: -1 });
chatSchema.index({ type: 1 });

module.exports = mongoose.model('Chat', chatSchema);
