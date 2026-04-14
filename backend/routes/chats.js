const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const authMiddleware = require('../middleware/auth');
const { checkChatAccess, checkChatAdmin } = require('../middleware/checkChatAccess');
const { formatChatForUser } = require('../social/services/chatService');
const { resolveUser } = require('../utils/userLookup');
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

function buildUserLookupInput({ userId = '', phone = '', identifier = '' } = {}) {
  const normalized = {
    userId: String(userId || '').trim(),
    phone: String(phone || '').trim(),
    identifier: String(identifier || '').trim()
  };

  if (!normalized.userId && !normalized.phone && !normalized.identifier) {
    return null;
  }

  return normalized;
}

function describeLookupValue(input) {
  if (input?.phone) return `номеру ${input.phone}`;
  if (input?.identifier) return `идентификатору ${input.identifier}`;
  if (input?.userId) return `id ${input.userId}`;
  return 'указанным данным';
}

async function resolveRouteUserOrThrow({ userId = '', phone = '', identifier = '', excludeUserId = null }) {
  const lookupInput = buildUserLookupInput({ userId, phone, identifier });
  if (!lookupInput) {
    const error = new Error('Укажите userId, phone или identifier');
    error.status = 400;
    throw error;
  }

  const resolved = await resolveUser(lookupInput, { excludeUserId });
  if (resolved?.ambiguous) {
    const error = new Error(`Найдено несколько пользователей по ${describeLookupValue(lookupInput)}. Уточните номер телефона.`);
    error.status = 409;
    throw error;
  }

  if (!resolved?.user?._id) {
    const error = new Error(`Не удалось найти пользователя по ${describeLookupValue(lookupInput)}.`);
    error.status = 404;
    throw error;
  }

  return resolved.user;
}

// Получение списка чатов пользователя
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    const userObjectId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : null;
    const io = req.app.get('io');
    const socketData = req.app.get('socketData');
    const userSockets = socketData?.userSockets;
    const isUserOnlineBySockets = (candidateUserId) => {
      const key = String(candidateUserId || '');
      if (!key) return false;
      const sockets = userSockets?.get?.(key);
      if (!sockets || sockets.size === 0) return false;

      let alive = 0;
      sockets.forEach((socketId) => {
        if (io?.sockets?.sockets?.get?.(socketId)) {
          alive += 1;
        } else {
          sockets.delete(socketId);
        }
      });
      if (sockets.size === 0) {
        userSockets?.delete?.(key);
      }
      return alive > 0;
    };

    const chats = await Chat.find({ 'participants.user': userId })
      .populate('participants.user', 'name phone avatarUrl status lastSeen isSystem systemKey')
      .sort({ updatedAt: -1 })
      .lean(); // lean() для производительности

    let unreadByChatId = new Map();
    const chatIds = chats.map(chat => chat._id).filter(Boolean);
    if (chatIds.length > 0 && userObjectId) {
      const unreadStats = await Message.aggregate([
        {
          $match: {
            chat: { $in: chatIds },
            deleted: { $ne: true },
            sender: { $ne: userObjectId },
            'readBy.user': { $ne: userObjectId },
            deletedFor: { $ne: userObjectId }
          }
        },
        {
          $group: {
            _id: '$chat',
            unreadCount: { $sum: 1 }
          }
        }
      ]);

      unreadByChatId = new Map(
        unreadStats.map(item => [item._id.toString(), Number(item.unreadCount) || 0])
      );
    }

    const formattedChats = chats.map(chat => {
      if (chat.type === 'private') {
        const otherParticipant = chat.participants.find(
          p => p.user._id.toString() !== userId
        );
        if (otherParticipant) {
          const otherUserId = otherParticipant.user._id.toString();
          chat.displayName = chat.isAiChat
            ? (chat.name || 'Поддержка')
            : otherParticipant.user.name;
          chat.displayPhone = otherParticipant.user.phone;
          chat.displayAvatar = otherParticipant.user.avatarUrl;
          chat.displayStatus = (chat.isAiChat || otherParticipant.user.isSystem)
            ? 'online'
            : (isUserOnlineBySockets(otherUserId) ? 'online' : 'offline');
          chat.displayLastSeen = otherParticipant.user.lastSeen;
          chat.peerUserId = otherUserId;
        }
      } else {
        chat.displayName = chat.name;
        chat.displayAvatar = chat.avatarUrl;
        chat.participantCount = chat.participants.length;
        chat.peerUserId = null;
      }
      chat.unreadCount = unreadByChatId.get(chat._id.toString()) || 0;
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
    const io = req.app.get('io');
    const socketData = req.app.get('socketData');
    const userSockets = socketData?.userSockets;
    const isUserOnlineBySockets = (candidateUserId) => {
      const key = String(candidateUserId || '');
      if (!key) return false;
      const sockets = userSockets?.get?.(key);
      if (!sockets || sockets.size === 0) return false;
      let alive = 0;
      sockets.forEach((socketId) => {
        if (io?.sockets?.sockets?.get?.(socketId)) {
          alive += 1;
        } else {
          sockets.delete(socketId);
        }
      });
      if (sockets.size === 0) {
        userSockets?.delete?.(key);
      }
      return alive > 0;
    };
    const { userId: targetUserId, phone, identifier } = req.body;

    const targetUser = await resolveRouteUserOrThrow({
      userId: targetUserId,
      phone,
      identifier
    });

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
      ...formatChatForUser({ app: req.app, chat, viewerUserId: userId }),
      displayName: otherParticipant?.user.name,
      displayPhone: otherParticipant?.user.phone,
      displayAvatar: otherParticipant?.user.avatarUrl,
      displayStatus: otherParticipant?.user?._id
        ? (isUserOnlineBySockets(otherParticipant.user._id.toString()) ? 'online' : 'offline')
        : otherParticipant?.user.status,
      unreadCount: 0
    };
    const formattedForTarget = formatChatForUser({
      app: req.app,
      chat,
      viewerUserId: targetUser._id
    });

    // Уведомляем только если чат был создан
    if (created) {
      const io = req.app.get('io');
      const socketData = req.app.get('socketData');
      
      if (socketData?.userSockets.has(targetUser._id.toString())) {
        socketData.userSockets.get(targetUser._id.toString()).forEach(socketId => {
          io.to(socketId).emit('chat:new', formattedForTarget);
          io.to(socketId).emit('chat:created', { chat: formattedForTarget, created: true });
          io.to(socketId).emit('new_chat', formattedForTarget);
        });
      }
    }

    res.status(created ? 201 : 200).json(formatted);
  } catch (error) {
    console.error('Create private chat error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Ошибка создания чата' });
  }
});

// Создание группового чата
router.post('/group', async (req, res) => {
  try {
    const userId = req.userId;
    const { name, participantPhones = [], participantIds = [], participants = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Укажите название группы' });
    }

    const chatParticipants = [{ user: userId, role: 'admin' }];
    const participantMap = new Map();
    const lookupItems = [];

    participantPhones.forEach((rawPhone) => {
      if (String(rawPhone || '').trim()) {
        lookupItems.push({ phone: String(rawPhone).trim() });
      }
    });

    participantIds.forEach((rawUserId) => {
      if (String(rawUserId || '').trim()) {
        lookupItems.push({ userId: String(rawUserId).trim() });
      }
    });

    participants.forEach((item) => {
      if (!item) return;
      if (typeof item === 'string') {
        lookupItems.push({ identifier: item });
        return;
      }
      if (typeof item === 'object') {
        lookupItems.push(item);
      }
    });

    for (const lookupItem of lookupItems) {
      const user = await resolveRouteUserOrThrow({
        userId: lookupItem.userId,
        phone: lookupItem.phone,
        identifier: lookupItem.identifier
      });
      const resolvedUserId = String(user._id);
      if (resolvedUserId === String(userId)) {
        continue;
      }
      if (!participantMap.has(resolvedUserId)) {
        participantMap.set(resolvedUserId, user);
      }
    }

    participantMap.forEach((participantUser) => {
      chatParticipants.push({ user: participantUser._id, role: 'member' });
    });

    const chat = await Chat.create({
      type: 'group',
      name: name.trim(),
      participants: chatParticipants
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
      participantCount: chat.participants.length,
      unreadCount: 0
    };

    chatParticipants.forEach(p => {
      const participantId = p.user.toString();
      if (socketData?.userSockets.has(participantId)) {
        socketData.userSockets.get(participantId).forEach(socketId => {
          io.to(socketId).emit('chat:new', chatPayload);
          io.to(socketId).emit('chat:created', { chat: chatPayload, created: true });
          io.to(socketId).emit('new_chat', chatPayload);
        });
      }
    });

    res.status(201).json(chatPayload);
  } catch (error) {
    console.error('Create group chat error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Ошибка создания группы' });
  }
});

// ИСПРАВЛЕНО: Используем middleware для проверки доступа
router.get('/:chatId', checkChatAccess, async (req, res) => {
  try {
    await req.chat.populate('participants.user', 'name phone avatarUrl status lastSeen');
    res.json(formatChatForUser({
      app: req.app,
      chat: req.chat,
      viewerUserId: req.userId
    }));
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
    const { userId: targetUserId, phone, identifier } = req.body;
    const chat = req.chat;
    const newUser = await resolveRouteUserOrThrow({
      userId: targetUserId,
      phone,
      identifier
    });

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
        io.to(socketId).emit('chat:created', { chat, created: true });
        io.to(socketId).emit('new_chat', chat);
      });
    }

    io.to(`chat:${chatId}`).emit('chat:participant_added', {
      chatId,
      user: newUser.toPublicJSON()
    });

    res.json(chat);
  } catch (error) {
    console.error('Add participant error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Ошибка добавления участника' });
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
