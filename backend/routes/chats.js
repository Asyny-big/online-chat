const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const User = require('../models/User');
const Message = require('../models/Message');
const authMiddleware = require('../middleware/auth');
const { checkChatAccess, checkChatAdmin } = require('../middleware/checkChatAccess');
const fs = require('fs');
const path = require('path');

router.use(authMiddleware);

// Путь к папке uploads
const uploadsDir = path.join(__dirname, '..', 'uploads');

// Функция удаления файла вложения
const deleteAttachmentFile = (attachmentUrl) => {
  if (!attachmentUrl) return;
  
  try {
    const filename = attachmentUrl.split('/').pop();
    const filePath = path.join(uploadsDir, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Chats] Deleted file: ${filename}`);
    }
  } catch (err) {
    console.error('[Chats] Error deleting file:', err);
  }
};

// Получение списка чатов пользователя
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;

    const chats = await Chat.find({ 'participants.user': userId })
      .populate('participants.user', 'name phone avatarUrl status lastSeen')
      .sort({ updatedAt: -1 })
      .lean(); // lean() для производительности

    const formattedChats = chats.map(chat => {
      if (chat.type === 'private') {
        const otherParticipant = chat.participants.find(
          p => p.user._id.toString() !== userId
        );
        if (otherParticipant) {
          chat.displayName = otherParticipant.user.name;
          chat.displayPhone = otherParticipant.user.phone;
          chat.displayAvatar = otherParticipant.user.avatarUrl;
          chat.displayStatus = otherParticipant.user.status;
          chat.displayLastSeen = otherParticipant.user.lastSeen;
        }
      } else {
        chat.displayName = chat.name;
        chat.displayAvatar = chat.avatarUrl;
        chat.participantCount = chat.participants.length;
      }
      return chat;
    });

    res.json(formattedChats);
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ error: 'Ошибка получения чатов' });
  }
});

// Создание приватного чата через userId (для поиска пользователей)
router.post('/private', async (req, res) => {
  try {
    const userId = req.userId;
    const { userId: targetUserId, phone } = req.body;

    let targetUser;

    // Поддерживаем оба варианта: userId или phone
    if (targetUserId) {
      targetUser = await User.findById(targetUserId);
    } else if (phone) {
      const phoneNormalized = phone.replace(/[\s\-()]/g, '');
      targetUser = await User.findOne({ phoneNormalized });
    } else {
      return res.status(400).json({ error: 'Укажите userId или phone' });
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (targetUser._id.toString() === userId) {
      return res.status(400).json({ error: 'Нельзя создать чат с самим собой' });
    }

    // Атомарное создание/получение чата
    const { chat, created } = await Chat.findOrCreatePrivateChat(userId, targetUser._id);
    
    await chat.populate('participants.user', 'name phone avatarUrl status lastSeen');

    // Форматируем для клиента
    const otherParticipant = chat.participants.find(
      p => p.user._id.toString() !== userId
    );
    const formatted = {
      ...chat.toObject(),
      displayName: otherParticipant?.user.name,
      displayPhone: otherParticipant?.user.phone,
      displayAvatar: otherParticipant?.user.avatarUrl,
      displayStatus: otherParticipant?.user.status
    };

    // Уведомляем только если чат был создан
    if (created) {
      const io = req.app.get('io');
      const socketData = req.app.get('socketData');
      
      if (socketData?.userSockets.has(targetUser._id.toString())) {
        socketData.userSockets.get(targetUser._id.toString()).forEach(socketId => {
          io.to(socketId).emit('chat:new', formatted);
        });
      }
    }

    res.status(created ? 201 : 200).json(formatted);
  } catch (error) {
    console.error('Create private chat error:', error);
    res.status(500).json({ error: 'Ошибка создания чата' });
  }
});

// Создание группового чата
router.post('/group', async (req, res) => {
  try {
    const userId = req.userId;
    const { name, participantPhones = [], participantIds = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Укажите название группы' });
    }

    const participants = [{ user: userId, role: 'admin' }];

    // Добавляем участников по phone
    for (const phone of participantPhones) {
      const phoneNormalized = phone.replace(/[\s\-()]/g, '');
      const user = await User.findOne({ phoneNormalized });
      if (user && user._id.toString() !== userId) {
        if (!participants.find(p => p.user.toString() === user._id.toString())) {
          participants.push({ user: user._id, role: 'member' });
        }
      }
    }

    // Добавляем участников по userId
    for (const pid of participantIds) {
      if (!pid) continue;
      const uid = pid.toString();
      if (uid === userId) continue;
      if (!participants.find(p => p.user.toString() === uid)) {
        participants.push({ user: uid, role: 'member' });
      }
    }

    const chat = await Chat.create({
      type: 'group',
      name: name.trim(),
      participants
    });

    await Message.create({
      chat: chat._id,
      sender: userId,
      type: 'system',
      systemEvent: { type: 'chat_created' }
    });

    await chat.populate('participants.user', 'name phone avatarUrl status lastSeen');

    // Уведомление участников
    const io = req.app.get('io');
    const socketData = req.app.get('socketData');

    // Формируем объект для фронтенда (добавим displayName)
    const chatPayload = {
      ...chat.toObject(),
      displayName: chat.name,
      displayAvatar: chat.avatarUrl,
      participantCount: chat.participants.length
    };

    participants.forEach(p => {
      const participantId = p.user.toString();
      if (socketData?.userSockets.has(participantId)) {
        socketData.userSockets.get(participantId).forEach(socketId => {
          io.to(socketId).emit('chat:new', chatPayload);
        });
      }
    });

    res.status(201).json(chatPayload);
  } catch (error) {
    console.error('Create group chat error:', error);
    res.status(500).json({ error: 'Ошибка создания группы' });
  }
});

// ИСПРАВЛЕНО: Используем middleware для проверки доступа
router.get('/:chatId', checkChatAccess, async (req, res) => {
  try {
    await req.chat.populate('participants.user', 'name phone avatarUrl status lastSeen');
    res.json(req.chat);
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Ошибка получения чата' });
  }
});

// ИСПРАВЛЕНО: Используем middleware для проверки админа
router.post('/:chatId/participants', checkChatAdmin, async (req, res) => {
  try {
    const userId = req.userId;
    const { chatId } = req.params;
    const { phone } = req.body;
    const chat = req.chat;

    const phoneNormalized = phone.replace(/[\s\-()]/g, '');
    const newUser = await User.findOne({ phoneNormalized });

    if (!newUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (chat.isParticipant(newUser._id)) {
      return res.status(400).json({ error: 'Пользователь уже является участником' });
    }

    chat.participants.push({ user: newUser._id, role: 'member' });
    await chat.save();

    await Message.create({
      chat: chatId,
      sender: userId,
      type: 'system',
      systemEvent: {
        type: 'user_added',
        targetUser: newUser._id,
        actorUser: userId
      }
    });

    await chat.populate('participants.user', 'name phone avatarUrl status lastSeen');

    const io = req.app.get('io');
    const socketData = req.app.get('socketData');

    if (socketData?.userSockets.has(newUser._id.toString())) {
      socketData.userSockets.get(newUser._id.toString()).forEach(socketId => {
        io.to(socketId).emit('chat:new', chat);
      });
    }

    io.to(`chat:${chatId}`).emit('chat:participant_added', {
      chatId,
      user: newUser.toPublicJSON()
    });

    res.json(chat);
  } catch (error) {
    console.error('Add participant error:', error);
    res.status(500).json({ error: 'Ошибка добавления участника' });
  }
});

// Удаление участника
router.delete('/:chatId/participants/:targetUserId', checkChatAccess, async (req, res) => {
  try {
    const userId = req.userId;
    const { chatId, targetUserId } = req.params;
    const chat = req.chat;

    if (chat.type !== 'group') {
      return res.status(400).json({ error: 'Операция доступна только для групп' });
    }

    const isAdmin = chat.isAdmin(userId);
    const isSelf = userId === targetUserId;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: 'Нет прав на удаление участника' });
    }

    chat.participants = chat.participants.filter(
      p => p.user.toString() !== targetUserId
    );
    await chat.save();

    await Message.create({
      chat: chatId,
      sender: userId,
      type: 'system',
      systemEvent: {
        type: isSelf ? 'user_left' : 'user_removed',
        targetUser: targetUserId,
        actorUser: userId
      }
    });

    const io = req.app.get('io');
    io.to(`chat:${chatId}`).emit('chat:participant_removed', {
      chatId,
      userId: targetUserId,
      removedBy: userId
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({ error: 'Ошибка удаления участника' });
  }
});

// Удаление чата (со всеми сообщениями и вложениями)
router.delete('/:chatId', checkChatAccess, async (req, res) => {
  try {
    const userId = req.userId;
    const { chatId } = req.params;
    const chat = req.chat;

    // Для групп - только админ может удалить
    if (chat.type === 'group' && !chat.isAdmin(userId)) {
      return res.status(403).json({ error: 'Только администратор может удалить группу' });
    }

    // Получаем все сообщения с вложениями для удаления файлов
    const messagesWithAttachments = await Message.find({
      chat: chatId,
      'attachment.url': { $exists: true, $ne: null }
    }).select('attachment');

    // Удаляем все файлы вложений
    let deletedFilesCount = 0;
    for (const msg of messagesWithAttachments) {
      if (msg.attachment?.url) {
        deleteAttachmentFile(msg.attachment.url);
        deletedFilesCount++;
      }
    }
    console.log(`[Chats] Deleted ${deletedFilesCount} attachment files for chat ${chatId}`);

    // Удаляем все сообщения чата
    const deletedMessages = await Message.deleteMany({ chat: chatId });
    console.log(`[Chats] Deleted ${deletedMessages.deletedCount} messages for chat ${chatId}`);

    // Собираем ID всех участников для уведомления
    const participantIds = chat.participants.map(p => 
      p.user._id?.toString() || p.user.toString()
    );

    // Удаляем сам чат
    await Chat.deleteOne({ _id: chatId });
    console.log(`[Chats] Deleted chat ${chatId}`);

    // Уведомляем всех участников об удалении чата
    const io = req.app.get('io');
    const socketData = req.app.get('socketData');

    participantIds.forEach(participantId => {
      if (socketData?.userSockets.has(participantId)) {
        socketData.userSockets.get(participantId).forEach(socketId => {
          io.to(socketId).emit('chat:deleted', {
            chatId,
            deletedBy: userId
          });
        });
      }
    });

    res.json({ 
      success: true, 
      deletedMessages: deletedMessages.deletedCount,
      deletedFiles: deletedFilesCount 
    });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({ error: 'Ошибка удаления чата' });
  }
});

module.exports = router;
