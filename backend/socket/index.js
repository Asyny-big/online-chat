const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Call = require('../models/Call');
const config = require('../config.local');

const userSockets = new Map();
const activeCalls = new Map();
const activeGroupCalls = new Map(); // chatId -> { callId, type, participants:Set<userId> }

module.exports = function(io) {
  // Авторизация сокетов
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('AUTH_REQUIRED'));
      }

      const decoded = jwt.verify(token, config.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        return next(new Error('USER_NOT_FOUND'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('INVALID_TOKEN'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`User connected: ${userId}, socket: ${socket.id}`);

    // Регистрация сокета
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);
    
    // Логирование всех подключённых пользователей
    console.log(`[Socket] Total connected users: ${userSockets.size}, users:`, Array.from(userSockets.keys()));

    // Обновление статуса
    await User.findByIdAndUpdate(userId, { status: 'online' });
    
    // Присоединение к чатам
    const userChats = await Chat.find({ 'participants.user': userId }).select('_id');
    userChats.forEach(chat => {
      socket.join(`chat:${chat._id}`);
    });

    broadcastUserStatus(io, userId, 'online');

    // === ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ===
    // ИСПРАВЛЕНО: Проверка доступа к чату перед любым действием
    const verifyAccess = async (chatId) => {
      if (!chatId) return null;
      const chat = await Chat.findById(chatId);
      if (!chat || !chat.isParticipant(userId)) {
        return null;
      }
      return chat;
    };

    // === СООБЩЕНИЯ ===

    socket.on('message:send', async (data, callback) => {
      try {
        const { chatId, text, type = 'text', attachment } = data;
        
        const chat = await verifyAccess(chatId);
        if (!chat) {
          return callback?.({ error: 'Нет доступа к чату' });
        }

        const message = await Message.create({
          chat: chatId,
          sender: userId,
          type,
          text: text || '',
          attachment,
          readBy: [{ user: userId }]
        });

        await message.populate('sender', 'name phone avatarUrl');

        chat.lastMessage = {
          text: text || (type === 'audio' ? '🎤 Голосовое' : '📎 Вложение'),
          senderId: userId,
          senderName: socket.user.name,
          createdAt: message.createdAt,
          type
        };
        await chat.save();

        io.to(`chat:${chatId}`).emit('message:new', {
          chatId,
          message: message.toObject()
        });

        callback?.({ success: true, message: message.toObject() });
      } catch (error) {
        console.error('message:send error:', error);
        callback?.({ error: 'Ошибка отправки' });
      }
    });

    // ИСПРАВЛЕНО: Проверка доступа для typing
    socket.on('typing:start', async ({ chatId }) => {
      const chat = await verifyAccess(chatId);
      if (!chat) return;

      socket.to(`chat:${chatId}`).emit('typing:update', {
        chatId,
        userId,
        userName: socket.user.name,
        isTyping: true
      });
    });

    socket.on('typing:stop', async ({ chatId }) => {
      const chat = await verifyAccess(chatId);
      if (!chat) return;

      socket.to(`chat:${chatId}`).emit('typing:update', {
        chatId,
        userId,
        isTyping: false
      });
    });

    socket.on('messages:read', async ({ chatId, messageIds }) => {
      const chat = await verifyAccess(chatId);
      if (!chat) return;

      await Message.updateMany(
        { _id: { $in: messageIds }, 'readBy.user': { $ne: userId } },
        { $push: { readBy: { user: userId, readAt: new Date() } } }
      );

      io.to(`chat:${chatId}`).emit('messages:read', { chatId, userId, messageIds });
    });

    // === ЗВОНКИ ===

    socket.on('call:start', async ({ chatId, type = 'video' }, callback) => {
      try {
        console.log(`[Socket] call:start from ${userId}, chatId: ${chatId}, type: ${type}`);
        
        const chat = await Chat.findById(chatId).populate('participants.user', 'name');
        
        if (!chat) {
          console.log(`[Socket] call:start - chat not found: ${chatId}`);
          return callback?.({ error: 'Чат не найден' });
        }
        
        const isParticipant = chat.isParticipant(userId);
        console.log(`[Socket] call:start - isParticipant: ${isParticipant}, userId: ${userId}`);
        
        if (!isParticipant) {
          console.log(`[Socket] call:start - user not in chat, participants:`, chat.participants.map(p => p.user?._id?.toString?.() || p.user?.toString?.()));
          return callback?.({ error: 'Нет доступа к чату' });
        }

        // Проверка активного звонка
        const existingCall = await Call.findOne({
          chat: chatId,
          status: { $in: ['ringing', 'active'] }
        });

        if (existingCall) {
          return callback?.({ error: 'В чате уже есть активный звонок', callId: existingCall._id });
        }

        const call = await Call.create({
          chat: chatId,
          initiator: userId,
          type,
          status: 'ringing',
          participants: [{ user: userId }]
        });

        activeCalls.set(chatId, {
          callId: call._id.toString(),
          participants: new Set([userId])
        });

        // Уведомление других участников
        const otherParticipants = chat.participants
          .filter(p => {
            const pId = p.user?._id?.toString?.() || p.user?.toString?.();
            return pId !== userId;
          });

        console.log(`[Socket] call:start - notifying ${otherParticipants.length} other participants`);
        console.log(`[Socket] call:start - all participants:`, chat.participants.map(p => p.user?._id?.toString?.() || p.user?.toString?.()));
        
        otherParticipants.forEach(({ user: participant }) => {
          const participantId = participant?._id?.toString?.() || participant?.toString?.();
          const participantSockets = userSockets.get(participantId);
          console.log(`[Socket] call:start - participant ${participantId} has ${participantSockets?.size || 0} sockets, userSockets keys:`, Array.from(userSockets.keys()));
          
          if (participantSockets && participantSockets.size > 0) {
            participantSockets.forEach(socketId => {
              console.log(`[Socket] call:start - sending call:incoming to socket ${socketId}`);
              io.to(socketId).emit('call:incoming', {
                callId: call._id,
                chatId,
                chatName: chat.type === 'group' ? chat.name : socket.user.name,
                initiator: {
                  _id: userId,
                  name: socket.user.name,
                  avatarUrl: socket.user.avatarUrl
                },
                type
              });
            });
          }
        });

        callback?.({ success: true, callId: call._id });
      } catch (error) {
        console.error('call:start error:', error);
        callback?.({ error: 'Ошибка начала звонка' });
      }
    });

    // === ГРУППОВЫЕ ЗВОНКИ ===
    socket.on('group-call:start', async ({ chatId, type = 'video' }, callback) => {
      try {
        const chat = await Chat.findById(chatId).populate('participants.user', 'name');
        if (!chat) return callback?.({ error: 'Чат не найден' });
        if (chat.type !== 'group') return callback?.({ error: 'Не групповой чат' });
        if (!chat.isParticipant(userId)) return callback?.({ error: 'Нет доступа' });

        // Проверяем активный звонок
        const existing = await Call.findOne({ chat: chatId, status: { $in: ['ringing', 'active'] } });
        if (existing) {
          return callback?.({ error: 'already_active', callId: existing._id.toString(), type: existing.type });
        }

        const call = await Call.create({
          chat: chatId,
          initiator: userId,
          type,
          status: 'active',
          participants: [{ user: userId }]
        });

        activeGroupCalls.set(chatId.toString(), {
          callId: call._id.toString(),
          type,
          participants: new Set([userId])
        });

        // Уведомляем участников: баннер входящего и маркер в списке
        chat.participants.forEach(({ user }) => {
          const pid = user?._id?.toString?.() || user?.toString?.();
          const sockets = userSockets.get(pid);
          if (!sockets) return;
          sockets.forEach(sid => {
            if (pid !== userId) {
              io.to(sid).emit('group-call:incoming', {
                callId: call._id.toString(),
                chatId: chatId.toString(),
                chatName: chat.name,
                initiator: { _id: userId, name: socket.user.name },
                type,
                participantCount: 1
              });
            }
            io.to(sid).emit('group-call:started', {
              callId: call._id.toString(),
              chatId: chatId.toString(),
              initiator: { _id: userId, name: socket.user.name },
              type,
              participantCount: 1
            });
          });
        });

        callback?.({ success: true, callId: call._id.toString() });
      } catch (err) {
        console.error('group-call:start error:', err);
        callback?.({ error: 'Ошибка начала группового звонка' });
      }
    });

    socket.on('group-call:join', async ({ callId, chatId }, callback) => {
      try {
        const call = await Call.findById(callId);
        if (!call) return callback?.({ error: 'Звонок не найден' });
        const chat = await Chat.findById(call.chat);
        if (!chat || !chat.isParticipant(userId)) return callback?.({ error: 'Нет доступа' });

        if (!call.isInCall(userId)) {
          call.participants.push({ user: userId });
        }
        if (call.status === 'ringing') call.status = 'active';
        await call.save();

        // Нужны имена для корректного отображения существующих участников на клиенте
        await call.populate('participants.user', 'name');

        const agc = activeGroupCalls.get(chat._id.toString());
        if (agc) agc.participants.add(userId);

        // Отправляем участнику текущий список для сигналинга
        const existing = call.participants
          .filter(p => !p.leftAt && (p.user?._id?.toString?.() || p.user?.toString?.()) !== userId)
          .map(p => {
            const pid = p.user?._id?.toString?.() || p.user?.toString?.();
            const userName = p.user?.name;
            return { oderId: pid, userName };
          })
          .filter(p => !!p.oderId);

        callback?.({ success: true, participants: existing });

        // Уведомляем остальных участников
        chat.participants.forEach(({ user }) => {
          const pid = user?._id?.toString?.() || user?.toString?.();
          const sockets = userSockets.get(pid);
          if (!sockets) return;
          sockets.forEach(sid => {
            if (pid !== userId) {
              io.to(sid).emit('group-call:participant-joined', {
                callId: call._id.toString(),
                chatId: chat._id.toString(),
                oderId: userId,
                userName: socket.user.name
              });
            }
            io.to(sid).emit('group-call:updated', {
              callId: call._id.toString(),
              chatId: chat._id.toString(),
              participantCount: call.participants.filter(p => !p.leftAt).length
            });
          });
        });
      } catch (err) {
        console.error('group-call:join error:', err);
        callback?.({ error: 'Ошибка присоединения' });
      }
    });

    socket.on('group-call:signal', async ({ callId, oderId, signal }) => {
      try {
        const call = await Call.findById(callId);
        if (!call) return;
        const targetSockets = userSockets.get(oderId);
        if (!targetSockets) return;
        targetSockets.forEach(sid => {
          io.to(sid).emit('group-call:signal', {
            callId,
            fromUserId: userId,
            signal
          });
        });
      } catch (err) {
        console.error('group-call:signal error:', err);
      }
    });

    socket.on('group-call:leave', async ({ callId }, callback) => {
      try {
        const call = await Call.findById(callId);
        if (!call) return callback?.({ error: 'Звонок не найден' });
        const chat = await Chat.findById(call.chat);
        if (!chat) return callback?.({ error: 'Чат не найден' });

        const participant = call.participants.find(p => p.user.toString() === userId && !p.leftAt);
        if (participant) participant.leftAt = new Date();

        const stillIn = call.participants.filter(p => !p.leftAt);
        if (stillIn.length <= 0) {
          call.status = 'ended';
          call.endedAt = new Date();
          call.endReason = 'completed';
          activeGroupCalls.delete(chat._id.toString());
        }
        await call.save();

        // Уведомляем комнату чата
        io.to(`chat:${chat._id}`).emit('group-call:participant-left', {
          callId: call._id.toString(),
          chatId: chat._id.toString(),
          oderId: userId
        });

        if (call.status === 'ended') {
          io.to(`chat:${chat._id}`).emit('group-call:ended', {
            callId: call._id.toString(),
            chatId: chat._id.toString(),
            reason: 'completed'
          });
        } else {
          io.to(`chat:${chat._id}`).emit('group-call:updated', {
            callId: call._id.toString(),
            chatId: chat._id.toString(),
            participantCount: stillIn.length
          });
        }

        callback?.({ success: true });
      } catch (err) {
        console.error('group-call:leave error:', err);
        callback?.({ error: 'Ошибка' });
      }
    });

    socket.on('call:accept', async ({ callId }, callback) => {
      try {
        console.log(`[Socket] call:accept from ${userId}, callId: ${callId}`);
        
        const call = await Call.findById(callId);
        if (!call) {
          console.log('[Socket] call:accept - call not found');
          return callback?.({ error: 'Звонок не найден' });
        }

        const chat = await Chat.findById(call.chat);
        if (!chat || !chat.isParticipant(userId)) {
          console.log('[Socket] call:accept - user not in chat');
          return callback?.({ error: 'Нет доступа к звонку' });
        }

        if (!call.isInCall(userId)) {
          call.participants.push({ user: userId });
        }
        
        if (call.status === 'ringing') {
          call.status = 'active';
        }
        await call.save();

        const activeCall = activeCalls.get(chat._id.toString());
        if (activeCall) {
          activeCall.participants.add(userId);
        }

        // Уведомляем ТОЛЬКО инициатора что звонок принят (не в комнату чата!)
        const initiatorId = call.initiator.toString();
        const initiatorSockets = userSockets.get(initiatorId);
        
        console.log(`[Socket] Notifying initiator ${initiatorId} about accepted call, accepter: ${userId}`);
        
        if (initiatorSockets) {
          initiatorSockets.forEach(socketId => {
            io.to(socketId).emit('call:participant_joined', {
              callId: callId.toString(),
              userId: userId,
              userName: socket.user.name
            });
          });
        }

        callback?.({ success: true, call: call.toObject() });
      } catch (error) {
        console.error('call:accept error:', error);
        callback?.({ error: 'Ошибка принятия звонка' });
      }
    });

    // WebRTC signaling - НЕ сохраняем в БД!
    socket.on('call:signal', async ({ callId, targetUserId, signal }) => {
      console.log(`[Socket] call:signal from ${userId} to ${targetUserId}, type: ${signal?.type}`);
      
      const call = await Call.findById(callId);
      if (!call) {
        console.log('[Socket] call:signal - call not found:', callId);
        return;
      }
      
      // Проверяем что отправитель участник звонка
      const chat = await Chat.findById(call.chat);
      if (!chat || !chat.isParticipant(userId)) {
        console.log('[Socket] call:signal - user not in chat');
        return;
      }

      const targetSockets = userSockets.get(targetUserId);
      if (targetSockets && targetSockets.size > 0) {
        console.log(`[Socket] Sending signal to ${targetUserId}, sockets: ${targetSockets.size}`);
        targetSockets.forEach(socketId => {
          io.to(socketId).emit('call:signal', {
            callId,
            fromUserId: userId,
            signal
          });
        });
      } else {
        console.log(`[Socket] Target user ${targetUserId} not connected`);
      }
    });

    socket.on('call:leave', async ({ callId }, callback) => {
      try {
        const call = await Call.findById(callId);
        if (!call) return callback?.({ error: 'Звонок не найден' });

        const participant = call.participants.find(
          p => p.user.toString() === userId && !p.leftAt
        );
        if (participant) {
          participant.leftAt = new Date();
        }

        const activeParticipants = call.participants.filter(p => !p.leftAt);
        
        if (activeParticipants.length <= 1) {
          call.status = 'ended';
          call.endedAt = new Date();
          call.endReason = 'completed';
          activeCalls.delete(call.chat.toString());
        }

        await call.save();

        io.to(`chat:${call.chat}`).emit('call:participant_left', {
          callId,
          userId,
          callEnded: call.status === 'ended'
        });

        callback?.({ success: true });
      } catch (error) {
        console.error('call:leave error:', error);
        callback?.({ error: 'Ошибка' });
      }
    });

    socket.on('call:decline', async ({ callId }) => {
      const call = await Call.findById(callId);
      if (!call) return;

      const chat = await Chat.findById(call.chat);
      if (!chat || !chat.isParticipant(userId)) return;

      if (chat.type === 'private') {
        call.status = 'declined';
        call.endedAt = new Date();
        call.endReason = 'declined';
        await call.save();
        activeCalls.delete(chat._id.toString());

        io.to(`chat:${chat._id}`).emit('call:ended', {
          callId,
          reason: 'declined',
          declinedBy: userId
        });
      }
    });

    // Присоединение к новому чату
    socket.on('chat:join', async ({ chatId }) => {
      const chat = await verifyAccess(chatId);
      if (chat) {
        socket.join(`chat:${chatId}`);
      }
    });

    // Отключение
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${userId}, socket: ${socket.id}`);

      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          
          await User.findByIdAndUpdate(userId, {
            status: 'offline',
            lastSeen: new Date()
          });
          
          broadcastUserStatus(io, userId, 'offline');
        }
      }
    });
  });

  // Рассылка статуса
  async function broadcastUserStatus(io, odst, status) {
    try {
      const userChats = await Chat.find({ 'participants.user': odst }).select('participants');
      const contactIds = new Set();

      userChats.forEach(chat => {
        chat.participants.forEach(p => {
          const oderId = p.user?.toString?.() || p.user;
          if (oderId && oderId !== odst) {
            contactIds.add(oderId);
          }
        });
      });

      contactIds.forEach(contactId => {
        const contactSockets = userSockets.get(contactId);
        if (contactSockets) {
          contactSockets.forEach(socketId => {
            io.to(socketId).emit('user:status', {
              userId: odst,
              status,
              lastSeen: status === 'offline' ? new Date() : null
            });
          });
        }
      });
    } catch (err) {
      console.error('broadcastUserStatus error:', err.message);
    }
  }

  return { userSockets, activeCalls };
};
