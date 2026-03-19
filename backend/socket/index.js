const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Call = require('../models/Call');
const config = require('../config.local');
const { maybeRewardMessage } = require('../economy/rewardsService');
const { NotificationService } = require('../services/notificationService');
const {
  createBulkNotifications,
  getUndeliveredNotifications,
  markNotificationsDelivered
} = require('../social/services/notificationService');
const { buildLastMessagePayload } = require('../services/messageStateService');
const {
  createAppFacade,
  ensureSupportChatForUser,
  emitChatCreatedToUser,
  checkAiRateLimit,
  ensureAiTextLimit,
  queueAiResponse,
  recoverPendingAiResponses,
  startAiQueueWatchdog,
  rememberAiUserMessage
} = require('../services/aiChatService');
const { startPrivateCallFlow, syncActiveCallsForUser } = require('../services/callOrchestrator');

const userSockets = new Map();
const activeCalls = new Map();
const activeGroupCalls = new Map(); // chatId -> { callId, type, participants:Set<userId> }
const activeGroupCallStreams = new Map(); // callId -> Map<userId, streamId>

async function joinCallParticipantAtomically({ callId, userId, promoteToActive = false }) {
  const normalizedUserId = String(userId || '').trim();
  const joinedAt = new Date();
  const statusPatch = promoteToActive ? { status: 'active' } : {};

  let call = await Call.findOneAndUpdate(
    {
      _id: callId,
      status: { $in: ['ringing', 'active'] },
      participants: { $elemMatch: { user: normalizedUserId, leftAt: { $ne: null } } },
      $nor: [{ participants: { $elemMatch: { user: normalizedUserId, leftAt: null } } }]
    },
    {
      $set: {
        ...statusPatch,
        'participants.$[participant].leftAt': null,
        'participants.$[participant].joinedAt': joinedAt
      }
    },
    {
      new: true,
      arrayFilters: [{ 'participant.user': normalizedUserId, 'participant.leftAt': { $ne: null } }]
    }
  );
  if (call) {
    return { call, joinedNow: true };
  }

  call = await Call.findOneAndUpdate(
    {
      _id: callId,
      status: { $in: ['ringing', 'active'] },
      participants: { $not: { $elemMatch: { user: normalizedUserId, leftAt: null } } }
    },
    {
      ...(promoteToActive ? { $set: { status: 'active' } } : {}),
      $push: { participants: { user: normalizedUserId, joinedAt } }
    },
    { new: true }
  );
  if (call) {
    return { call, joinedNow: true };
  }

  call = await Call.findById(callId);
  return { call, joinedNow: false };
}

async function forceLeaveUserFromCall({ io, userId, call, notificationService, senderName = '' }) {
  // Помечаем пользователя вышедшим из звонка (на случай закрытия вкладки/потери сети)
  let changed = false;
  call.participants.forEach((p) => {
    if (p.user?.toString?.() === userId && !p.leftAt) {
      p.leftAt = new Date();
      changed = true;
    }
  });
  if (!changed) return;

  const chat = await Chat.findById(call.chat).select('_id type name participants.user');
  if (!chat) {
    await call.save();
    return;
  }

  const stillIn = call.participants.filter(p => !p.leftAt);

  if (chat.type === 'group') {
    if (stillIn.length <= 0) {
      call.status = 'ended';
      call.endedAt = new Date();
      call.endReason = 'completed';
      activeGroupCalls.delete(chat._id.toString());
    }
    await call.save();

    io.to(`chat:${chat._id}`).emit('group-call:participant-left', {
      callId: call._id.toString(),
      chatId: chat._id.toString(),
      userId,
      oderId: userId
    });

    if (call.status === 'ended') {
      io.to(`chat:${chat._id}`).emit('group-call:ended', {
        callId: call._id.toString(),
        chatId: chat._id.toString(),
        reason: 'completed'
      });
      Promise.resolve(
        notificationService?.sendCallCancelledNotification?.({
          chat,
          callId: call._id.toString(),
          senderId: userId,
          senderName,
          callType: String(call.type || 'audio'),
          isGroup: true,
          reason: 'completed'
        })
      ).catch((error) => {
        console.warn('[Push] group_call_cancelled notification failed:', error?.message || error);
      });
    } else {
      io.to(`chat:${chat._id}`).emit('group-call:updated', {
        callId: call._id.toString(),
        chatId: chat._id.toString(),
        participantCount: stillIn.length
      });
    }
  } else {
    if (stillIn.length <= 1) {
      call.status = 'ended';
      call.endedAt = new Date();
      call.endReason = 'completed';
      activeCalls.delete(chat._id.toString());
    }
    await call.save();

    io.to(`chat:${chat._id}`).emit('call:participant_left', {
      callId: call._id.toString(),
      userId,
      callEnded: call.status === 'ended'
    });
    if (call.status === 'ended') {
      Promise.resolve(
        notificationService?.sendCallCancelledNotification?.({
          chat,
          callId: call._id.toString(),
          senderId: userId,
          senderName,
          callType: String(call.type || 'audio'),
          isGroup: false,
          reason: 'completed'
        })
      ).catch((error) => {
        console.warn('[Push] call_cancelled notification failed:', error?.message || error);
      });
    }
  }
}

module.exports = function (io) {
  const notificationService = new NotificationService({ userSockets, io });
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

      // logout-all: токен должен быть выпущен после tokensValidAfter
      try {
        const iatMs = typeof decoded.iat === 'number' ? decoded.iat * 1000 : null;
        const validAfter = user.tokensValidAfter ? new Date(user.tokensValidAfter).getTime() : 0;
        if (iatMs !== null && iatMs < validAfter) {
          return next(new Error('TOKEN_REVOKED'));
        }
      } catch (_) { }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('INVALID_TOKEN'));
    }
  });

io.on('connection', async (socket) => {
    const userId = socket.userId;
    const appFacade = createAppFacade({ io, userSockets, activeCalls, activeGroupCalls });
    startAiQueueWatchdog({ app: appFacade });
    console.log(`User connected: ${userId}, socket: ${socket.id}`);
    socket.join(`user:${userId}`);

    // Регистрация сокета
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Логирование всех подключённых пользователей
    console.log(`[Socket] Total connected users: ${userSockets.size}, users:`, Array.from(userSockets.keys()));

    // Обновление статуса
    await User.findByIdAndUpdate(userId, { status: 'online' });
    const ensuredSupportChat = await ensureSupportChatForUser({ app: appFacade, userId });

    // Присоединение к чатам
    const userChats = await Chat.find({ 'participants.user': userId }).select('_id');
    userChats.forEach(chat => {
      socket.join(`chat:${chat._id}`);
    });

    if (ensuredSupportChat?.chat?._id) {
      socket.join(`chat:${ensuredSupportChat.chat._id}`);
      const existedBeforeConnect = userChats.some((chat) => String(chat._id) === String(ensuredSupportChat.chat._id));
      if (!existedBeforeConnect) {
        emitChatCreatedToUser({
          app: appFacade,
          userId,
          chat: ensuredSupportChat.chat
        });
      }
    }

    broadcastUserStatus(io, userId, 'online');
    Promise.resolve(
      syncActiveCallsForUser({
        app: appFacade,
        userId,
        socketId: socket.id
      })
    ).catch((error) => {
      console.warn('[Socket] active call sync failed:', error?.message || error);
    });
    Promise.resolve(
      recoverPendingAiResponses({
        app: appFacade,
        limit: 20
      })
    ).catch((error) => {
      console.warn('[Socket] AI queue recovery failed:', error?.message || error);
    });

    Promise.resolve().then(async () => {
      const pending = await getUndeliveredNotifications({
        userId,
        limit: 300
      });
      if (!pending.length) return;

      const deliveredIds = [];
      pending.forEach((notification) => {
        io.to(socket.id).emit('notification:new', {
          _id: notification._id,
          userId: notification.userId,
          type: notification.type,
          actorId: notification.actorId,
          targetId: notification.targetId,
          read: notification.read,
          delivered: true,
          meta: notification.meta || {},
          createdAt: notification.createdAt,
          actor: notification.actor || null
        });
        deliveredIds.push(String(notification._id));
      });

      await markNotificationsDelivered({
        userId,
        notificationIds: deliveredIds
      });
    }).catch((error) => {
      console.warn('[Social][Notification] undelivered sync failed:', error?.message || error);
    });

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

    const findCurrentCallParticipant = (callDoc, participantUserId) => (
      callDoc?.participants?.find((participant) => (
        participant?.user?.toString?.() === String(participantUserId)
      )) || null
    );

    const findJoinedCallParticipant = (callDoc, participantUserId) => (
      callDoc?.participants?.find((participant) => (
        participant?.user?.toString?.() === String(participantUserId) && !participant?.leftAt
      )) || null
    );

    const ensureJoinedCallParticipant = (callDoc, participantUserId) => {
      const existingParticipant = findCurrentCallParticipant(callDoc, participantUserId);
      if (existingParticipant) {
        existingParticipant.leftAt = null;
        existingParticipant.joinedAt = new Date();
        return existingParticipant;
      }

      callDoc.participants.push({ user: participantUserId });
      return callDoc.participants[callDoc.participants.length - 1] || null;
    };

    // === СООБЩЕНИЯ ===

    socket.on('message:send', async (data, callback) => {
      try {
        const { chatId, text, type = 'text', attachment } = data;
        const messageType = String(type || 'text').toLowerCase();
        const normalizedText = typeof text === 'string'
          ? text.trim()
          : String(text || '').trim();
        const hasAttachment = Boolean(
          attachment?.url
          || attachment?.originalName
          || attachment?.name
          || attachment?.mimeType
          || attachment?.size
        );

        const chat = await verifyAccess(chatId);
        if (!chat) {
          return callback?.({ error: 'Нет доступа к чату' });
        }

        if (messageType === 'text' && !normalizedText && !hasAttachment) {
          return callback?.({ error: 'Нельзя отправить пустое сообщение' });
        }

        if (normalizedText.length > 10000) {
          return callback?.({ error: 'Сообщение превышает лимит в 10000 символов' });
        }

        if (chat.isAiChat) {
          if (messageType !== 'text' || hasAttachment) {
            return callback?.({ error: 'Чат поддержки принимает только текстовые сообщения' });
          }

          ensureAiTextLimit(normalizedText);
          if (!checkAiRateLimit({ userId, chatId })) {
            return callback?.({ error: 'Для чата поддержки действует лимит: 1 сообщение в секунду.' });
          }
        }

        const message = await Message.create({
          chat: chatId,
          sender: userId,
          type: messageType,
          text: normalizedText,
          attachment,
          readBy: [{ user: userId }]
        });

        await message.populate('sender', 'name phone avatarUrl');

        chat.lastMessage = {
          text: normalizedText || (
            ['audio', 'voice'].includes(messageType)
              ? '🎤 Голосовое'
              : (messageType === 'video_note' ? '🎥 Видеокружок' : '📎 Вложение')
          ),
          senderId: userId,
          senderName: socket.user.name,
          createdAt: message.createdAt,
          type: messageType
        };
        chat.lastMessage = buildLastMessagePayload({
          ...message.toObject(),
          sender: {
            _id: userId,
            name: socket.user.name
          }
        });
        await chat.save();

        io.to(`chat:${chatId}`).emit('message:new', {
          chatId,
          message: message.toObject()
        });
        io.to(`chat:${chatId}`).emit('new_message', {
          chatId,
          message: message.toObject()
        });

        callback?.({ success: true, message: message.toObject() });

        if (chat.isAiChat) {
          Promise.resolve(
            rememberAiUserMessage({
              userId,
              text: normalizedText
            })
          ).catch((error) => {
            console.warn('[AI] memory save failed:', error?.message || error);
          });

          queueAiResponse({
            app: appFacade,
            chatId,
            messageId: message._id
          }).catch((error) => {
            console.warn('[AI] queue failed:', error?.message || error);
          });
          return;
        }

        Promise.resolve().then(async () => {
          const recipientIds = (chat?.participants || [])
            .map((participant) => participant?.user?.toString?.() || participant?.user?._id?.toString?.())
            .filter((participantId) => participantId && participantId !== userId);

          if (!recipientIds.length) return;

          createBulkNotifications({
            userIds: recipientIds,
            type: 'message',
            actorId: userId,
            targetId: message._id,
            meta: {
              chatId: String(chatId),
              messageType
            }
          });
        }).catch((error) => {
          console.warn('[Social] message notification queue failed:', error?.message || error);
        });

        Promise.resolve().then(async () => {
          const isAttachment = !!attachment || ['audio', 'voice', 'image', 'video', 'video_note', 'file'].includes(messageType);

          if (isAttachment) {
            const pushResult = await notificationService.sendAttachmentNotification({
              chat,
              message,
              senderId: userId,
              senderName: socket.user.name,
              attachmentName: attachment?.originalName || attachment?.name || ''
            });
            if (pushResult?.skipped) {
              console.log('[Push] attachment skipped:', pushResult);
            }
            return;
          }

          if (chat.type === 'group') {
            const pushResult = await notificationService.sendGroupNotification({
              chat,
              message,
              senderId: userId,
              senderName: socket.user.name,
              text: normalizedText
            });
            if (pushResult?.skipped) {
              console.log('[Push] group message skipped:', pushResult);
            }
            return;
          }

          const pushResult = await notificationService.sendMessageNotification({
            chat,
            message,
            senderId: userId,
            senderName: socket.user.name,
            text: normalizedText
          });
          if (pushResult?.skipped) {
            console.log('[Push] message skipped:', pushResult);
          }
        }).catch((error) => {
          console.warn('[Push] message notification failed:', error?.message || error);
        });

        // Earn: сообщения (best-effort, не блокируем чат).
        try {
          Promise.resolve(
            maybeRewardMessage({
              userId,
              messageId: message._id.toString(),
              chatId,
              text: normalizedText
            })
          )
            .then((r) => {
              if (r?.ok === false) {
                console.warn('[Economy] message reward failed:', { userId, chatId: String(chatId), error: r?.error });
              }
            })
            .catch((e) => {
              console.warn('[Economy] message reward rejected:', { userId, chatId: String(chatId), error: e?.message || e });
            });
        } catch (_) { }
      } catch (error) {
        console.error('message:send error:', error);
        callback?.({ error: error?.message || 'Ошибка отправки' });
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
      const normalizedMessageIds = Array.isArray(messageIds)
        ? messageIds
          .map((messageId) => String(messageId || '').trim())
          .filter(Boolean)
        : [];
      if (normalizedMessageIds.length === 0) return;

      const readAt = new Date();
      await Message.updateMany(
        {
          chat: chat._id,
          _id: { $in: normalizedMessageIds },
          'readBy.user': { $ne: userId }
        },
        { $push: { readBy: { user: userId, readAt } } }
      );

      const updatedMessageIds = await Message.find(
        {
          chat: chat._id,
          _id: { $in: normalizedMessageIds },
          readBy: { $elemMatch: { user: userId, readAt } }
        }
      )
        .select('_id')
        .lean();

      const validMessageIds = updatedMessageIds.map((message) => String(message._id));
      if (validMessageIds.length === 0) return;

      io.to(`chat:${chatId}`).emit('messages:read', { chatId, userId, messageIds: validMessageIds });
    });

    // === ЗВОНКИ ===

    socket.on('call:start', async ({ chatId, type = 'video' }, callback) => {
      try {
        const result = await startPrivateCallFlow({
          app: appFacade,
          fromUserId: userId,
          chatId,
          type,
          notifyInitiator: false,
          source: 'user',
          initiatorUser: socket.user
        });

        callback?.({ success: true, callId: result.call._id.toString() });
        return;
      } catch (error) {
        console.error('call:start error:', error);
        callback?.({
          error: error?.message || 'Ошибка начала звонка',
          callId: error?.callId || undefined,
          type: error?.callType || undefined
        });
        return;
      }

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
        if (chat.isAiChat) {
          return callback?.({ error: 'В чате поддержки звонки недоступны' });
        }

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

        Promise.resolve(
          notificationService.sendIncomingCallNotification({
            chat,
            callId: call._id.toString(),
            senderId: userId,
            senderName: socket.user.name,
            callType: type,
            isGroup: false
          })
        ).then((pushResult) => {
          if (pushResult?.skipped) {
            console.log('[Push] incoming_call skipped:', pushResult);
          }
        }).catch((error) => {
          console.warn('[Push] incoming_call notification failed:', error?.message || error);
        });

        // Earn: факт начала звонка (инициатор).
        try {
          const r = await maybeRewardCallStart({
            userId,
            callId: call._id.toString(),
            chatId: String(chatId),
            callType: String(type)
          });
          if (r?.ok && r?.granted) {
            console.log(`[Economy] call_start granted to ${userId}: +${r.amountHrum} HRUM`);
          } else if (r?.ok === false) {
            console.warn('[Economy] call_start reward failed:', { userId, chatId: String(chatId), error: r?.error });
          }
        } catch (e) {
          console.warn('[Economy] call_start reward failed:', e?.message || e);
        }
      } catch (error) {
        console.error('call:start error:', error);
        callback?.({ error: 'Ошибка начала звонка' });
      }
    });

    // === ГРУППОВЫЕ ЗВОНКИ ===
    socket.on('__disabled:call:start:ai', async ({ fromUserId, toUserId, type = 'video' }, callback) => {
      callback?.({ error: 'Client-side AI call start is disabled' });
      return;
      try {
        if (fromUserId && String(fromUserId) !== String(userId)) {
          return callback?.({ error: 'Нельзя запускать AI-звонок от имени другого пользователя' });
        }

        const result = await startPrivateCallFlow({
          app: appFacade,
          fromUserId: userId,
          toUserId,
          type,
          notifyInitiator: true,
          source: 'ai',
          initiatorUser: socket.user
        });

        callback?.({
          success: true,
          callId: result.call._id.toString(),
          chatId: result.chat._id.toString()
        });
      } catch (error) {
        console.error('call:start:ai error:', error);
        callback?.({
          error: error?.message || 'Ошибка AI-старта звонка',
          callId: error?.callId || undefined,
          type: error?.callType || undefined
        });
      }
    });

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

        let call;
        try {
          call = await Call.create({
            chat: chatId,
            initiator: userId,
            type,
            status: 'active',
            participants: [{ user: userId }]
          });
        } catch (error) {
          if (error?.code === 11000) {
            const lockedCall = await Call.findOne({ chat: chatId, status: { $in: ['ringing', 'active'] } });
            if (lockedCall) {
              return callback?.({ error: 'already_active', callId: lockedCall._id.toString(), type: lockedCall.type });
            }
          }
          throw error;
        }

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

        Promise.resolve(
          notificationService.sendIncomingCallNotification({
            chat,
            callId: call._id.toString(),
            senderId: userId,
            senderName: socket.user.name,
            callType: type,
            isGroup: true
          })
        ).then((pushResult) => {
          if (pushResult?.skipped) {
            console.log('[Push] incoming_group_call skipped:', pushResult);
          }
        }).catch((error) => {
          console.warn('[Push] incoming_group_call notification failed:', error?.message || error);
        });

        // Earn: факт начала группового звонка (инициатор).
        try {
          const r = await maybeRewardCallStart({
            userId,
            callId: call._id.toString(),
            chatId: String(chatId),
            callType: String(type)
          });
          if (r?.ok && r?.granted) {
            console.log(`[Economy] group call_start granted to ${userId}: +${r.amountHrum} HRUM`);
          } else if (r?.ok === false) {
            console.warn('[Economy] group call_start reward failed:', { userId, chatId: String(chatId), error: r?.error });
          }
        } catch (e) {
          console.warn('[Economy] group call_start reward failed:', e?.message || e);
        }
      } catch (err) {
        console.error('group-call:start error:', err);
        callback?.({ error: 'Ошибка начала группового звонка' });
      }
    });

    socket.on('group-call:join', async ({ callId, chatId }, callback) => {
      try {
        const call = await Call.findById(callId);
        if (!call) return callback?.({ error: 'Звонок не найден' });
        if (!['ringing', 'active'].includes(String(call.status || ''))) {
          return callback?.({ error: 'Звонок уже завершён' });
        }
        if (chatId && String(call.chat) !== String(chatId)) {
          return callback?.({ error: 'Некорректный chatId для звонка' });
        }
        const chat = await Chat.findById(call.chat);
        if (!chat || !chat.isParticipant(userId)) return callback?.({ error: 'Нет доступа' });
        if (String(call.initiator) === String(userId)) {
          return callback?.({ error: 'Initiator cannot accept own call' });
        }
        if (!call.canJoin(userId)) {
          return callback?.({ error: 'Call is not available for join' });
        }

        ensureJoinedCallParticipant(call, userId);
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
            return { userId: pid, oderId: pid, userName };
          })
          .filter(p => !!p.userId);

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
                userId,
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

    socket.on('group-call:signal', async ({ callId, targetUserId, oderId, signal }) => {
      try {
        const call = await Call.findById(callId);
        if (!call) return;
        if (!['ringing', 'active'].includes(String(call.status || ''))) return;
        const normalizedTargetUserId = String(targetUserId || oderId || '').trim();
        if (!normalizedTargetUserId || normalizedTargetUserId === String(userId)) return;

        const chat = await Chat.findById(call.chat);
        if (!chat || !chat.isParticipant(userId)) return callback?.({ error: 'Нет доступа' });
        if (String(call.initiator) === String(userId)) {
          return callback?.({ error: 'Инициатор не может принять свой звонок' });
        }
        if (!call.canJoin(userId)) {
          return callback?.({ error: 'Звонок уже завершён или недоступен' });
        }
        if (!chat || !chat.isParticipant(userId) || !chat.isParticipant(normalizedTargetUserId)) return;
        if (!findJoinedCallParticipant(call, userId) || !findJoinedCallParticipant(call, normalizedTargetUserId)) return;
        if (!call.canJoin(userId) || !call.isInCall(userId)) return;
        if (!call.isInCall(normalizedTargetUserId)) return;
        const targetSockets = userSockets.get(normalizedTargetUserId);
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

    // === SFU stream mapping (ADD-ONLY, не ломает существующий signaling) ===
    // Клиент сообщает свой MediaStream.id, чтобы остальные могли связать remote stream.id с userId.
    // Это необходимо, потому что ion-sfu json-rpc в браузере не даёт стабильного userId в ontrack.
    socket.on('group-call:sfu-stream', async ({ callId, streamId }, callback) => {
      try {
        if (!callId || !streamId) return callback?.({ error: 'Invalid payload' });

        const call = await Call.findById(callId);
        if (!call) return callback?.({ error: 'Звонок не найден' });

        const chat = await Chat.findById(call.chat);
        if (!chat || !chat.isParticipant(userId)) return callback?.({ error: 'Нет доступа' });

        // Убеждаемся что пользователь в участниках звонка (не leftAt)
        const inCall = call.participants.some((p) => !p.leftAt && p.user?.toString?.() === userId);
        if (!inCall) return callback?.({ error: 'Not in call' });

        if (!activeGroupCallStreams.has(callId)) {
          activeGroupCallStreams.set(callId, new Map());
        }
        activeGroupCallStreams.get(callId).set(userId, String(streamId));

        // Рассылаем всем в чате (в т.ч. отправителю — чтобы унифицировать обработку на клиенте)
        io.to(`chat:${chat._id}`).emit('group-call:sfu-stream', {
          callId: String(callId),
          userId,
          streamId: String(streamId)
        });

        callback?.({ success: true });
      } catch (err) {
        console.error('group-call:sfu-stream error:', err);
        callback?.({ error: 'Ошибка' });
      }
    });

    socket.on('group-call:leave', async ({ callId }, callback) => {
      try {
        const call = await Call.findById(callId);
        if (!call) return callback?.({ error: 'Звонок не найден' });
        const chat = await Chat.findById(call.chat);
        if (!chat) return callback?.({ error: 'Чат не найден' });

        const participant = call.participants.find(p => p.user.toString() === userId && !p.leftAt);
        if (!chat?.isParticipant?.(userId)) return callback?.({ error: 'Access denied' });
        if (!['ringing', 'active'].includes(String(call.status || ''))) return callback?.({ error: 'Call already ended' });
        if (!participant) return callback?.({ error: 'User is not an active call participant' });
        participant.leftAt = new Date();

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
          userId,
          oderId: userId
        });

        if (call.status === 'ended') {
          io.to(`chat:${chat._id}`).emit('group-call:ended', {
            callId: call._id.toString(),
            chatId: chat._id.toString(),
            reason: 'completed'
          });
          Promise.resolve(
            notificationService.sendCallCancelledNotification({
              chat,
              callId: call._id.toString(),
              senderId: userId,
              senderName: socket.user?.name || '',
              callType: String(call.type || 'audio'),
              isGroup: true,
              reason: 'completed'
            })
          ).then((pushResult) => {
            if (pushResult?.skipped) {
              console.log('[Push] group_call_cancelled skipped:', pushResult);
            }
          }).catch((error) => {
            console.warn('[Push] group_call_cancelled notification failed:', error?.message || error);
          });
        } else {
          io.to(`chat:${chat._id}`).emit('group-call:updated', {
            callId: call._id.toString(),
            chatId: chat._id.toString(),
            participantCount: stillIn.length
          });
        }

        // чистим sfu stream map для вышедшего (best-effort)
        try {
          const map = activeGroupCallStreams.get(callId);
          if (map) {
            map.delete(userId);
            if (map.size === 0) activeGroupCallStreams.delete(callId);
          }
        } catch (e) { }

        callback?.({ success: true });
      } catch (err) {
        console.error('group-call:leave error:', err);
        callback?.({ error: 'Ошибка' });
      }
    });

    socket.on('call:accept', async ({ callId }, callback) => {
      try {
        console.log(`[Socket] call:accept from ${userId}, callId: ${callId}`);

        let call = await Call.findById(callId);
        if (!call) {
          console.log('[Socket] call:accept - call not found');
          return callback?.({ error: 'Звонок не найден' });
        }

        const chat = await Chat.findById(call.chat);
        if (!chat || !chat.isParticipant(userId)) {
          console.log('[Socket] call:accept - user not in chat');
          return callback?.({ error: 'Нет доступа к звонку' });
        }

        if (!['ringing', 'active'].includes(String(call.status || ''))) {
          console.log('[Socket] call:accept - call already ended');
          return callback?.({ error: 'Call already ended' });
        }
        if (String(call.initiator) === String(userId)) {
          console.log('[Socket] call:accept - initiator tried to accept own call');
          return callback?.({ error: 'Initiator cannot accept own call' });
        }
        if (!call.canJoin(userId)) {
          console.log('[Socket] call:accept - call unavailable for join');
          return callback?.({ error: 'Call is not available for join' });
        }

        const alreadyJoined = Boolean(findJoinedCallParticipant(call, userId));
        let joinedNow = false;

        if (alreadyJoined) {
          if (call.status === 'ringing') {
            call.status = 'active';
            await call.save();
          }
        } else {
          const joinResult = await joinCallParticipantAtomically({
            callId: call._id,
            userId,
            promoteToActive: call.status === 'ringing'
          });

          call = joinResult.call;
          joinedNow = Boolean(joinResult.joinedNow);

          if (!call || !findJoinedCallParticipant(call, userId)) {
            console.log('[Socket] call:accept - participant join lost in race');
            return callback?.({ error: 'Call is not available for join' });
          }
        }

        const activeCall = activeCalls.get(chat._id.toString());
        if (activeCall) {
          activeCall.participants.add(userId);
        }

        // Уведомляем ТОЛЬКО инициатора что звонок принят (не в комнату чата!)
        const initiatorId = call.initiator.toString();
        const initiatorSockets = userSockets.get(initiatorId);

        console.log(`[Socket] Notifying initiator ${initiatorId} about accepted call, accepter: ${userId}`);

        if (joinedNow && initiatorSockets) {
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
      if (!call.canJoin(userId) || !call.isInCall(userId)) {
        console.log('[Socket] call:signal - sender is not in active call');
        return;
      }
      if (!['ringing', 'active'].includes(String(call.status || ''))) {
        console.log('[Socket] call:signal - call is not active:', call.status);
        return;
      }
      if (!findJoinedCallParticipant(call, userId)) {
        console.log('[Socket] call:signal - sender is not in call:', userId);
        return;
      }

      // Проверяем что отправитель участник звонка
      const chat = await Chat.findById(call.chat);
      if (!chat || !chat.isParticipant(userId)) {
        console.log('[Socket] call:signal - user not in chat');
        return;
      }
      if (!chat.isParticipant(targetUserId) || !findJoinedCallParticipant(call, targetUserId)) {
        console.log('[Socket] call:signal - invalid target:', targetUserId);
        return;
      }

      const normalizedTargetUserId = String(targetUserId || '').trim();
      if (!normalizedTargetUserId || normalizedTargetUserId === String(userId)) {
        console.log('[Socket] call:signal - invalid target');
        return;
      }
      if (!chat.isParticipant(normalizedTargetUserId) || !call.isInCall(normalizedTargetUserId)) {
        console.log('[Socket] call:signal - target is not in active call');
        return;
      }

      const targetSockets = userSockets.get(normalizedTargetUserId);
      if (targetSockets && targetSockets.size > 0) {
        console.log(`[Socket] Sending signal to ${normalizedTargetUserId}, sockets: ${targetSockets.size}`);
        targetSockets.forEach(socketId => {
          io.to(socketId).emit('call:signal', {
            callId,
            fromUserId: userId,
            signal
          });
        });
      } else {
        console.log(`[Socket] Target user ${normalizedTargetUserId} not connected`);
      }
    });

    socket.on('call:leave', async ({ callId }, callback) => {
      try {
        const call = await Call.findById(callId);
        if (!call) return callback?.({ error: 'Звонок не найден' });
        const chat = await Chat.findById(call.chat).select('_id name type participants');
        if (!chat?.isParticipant?.(userId)) return callback?.({ error: 'РќРµС‚ РґРѕСЃС‚СѓРїР° Рє Р·РІРѕРЅРєСѓ' });
        if (!['ringing', 'active'].includes(String(call.status || ''))) {
          return callback?.({ error: 'Р—РІРѕРЅРѕРє СѓР¶Рµ Р·Р°РІРµСЂС€С‘РЅ' });
        }
        if (!chat || !chat.isParticipant(userId)) {
          return callback?.({ error: 'РќРµС‚ РґРѕСЃС‚СѓРїР°' });
        }
        if (!chat) return callback?.({ error: 'Чат не найден' });

        const participant = call.participants.find(
          p => p.user.toString() === userId && !p.leftAt
        );
        if (!participant) {
          return callback?.({ error: 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ СѓС‡Р°СЃС‚РІСѓРµС‚ РІ Р·РІРѕРЅРєРµ' });
        }
        if (participant) {
          participant.leftAt = new Date();
        }

        if (!participant) return callback?.({ error: 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ СѓС‡Р°СЃС‚РІСѓРµС‚ РІ Р·РІРѕРЅРєРµ' });
        const activeParticipants = call.participants.filter(p => !p.leftAt);

        if (activeParticipants.length <= 1) {
          call.status = 'ended';
          call.endedAt = new Date();
          call.endReason = 'completed';
          activeCalls.delete(chat._id.toString());
        }

        await call.save();

        io.to(`chat:${chat._id}`).emit('call:participant_left', {
          callId,
          userId,
          callEnded: call.status === 'ended'
        });
        if (call.status === 'ended') {
          Promise.resolve(
            notificationService.sendCallCancelledNotification({
              chat,
              callId: call._id.toString(),
              senderId: userId,
              senderName: socket.user?.name || '',
              callType: String(call.type || 'audio'),
              isGroup: false,
              reason: String(call.endReason || 'completed')
            })
          ).then((pushResult) => {
            if (pushResult?.skipped) {
              console.log('[Push] call_cancelled skipped:', pushResult);
            }
          }).catch((error) => {
            console.warn('[Push] call_cancelled notification failed:', error?.message || error);
          });
        }

        callback?.({ success: true });
      } catch (error) {
        console.error('call:leave error:', error);
        callback?.({ error: 'Ошибка' });
      }
    });

    socket.on('call:decline', async ({ callId }) => {
      const call = await Call.findById(callId);
      if (!call) return;

      const chat = await Chat.findById(call.chat).select('_id name type participants');
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

        Promise.resolve(
          notificationService.sendCallCancelledNotification({
            chat,
            callId: call._id.toString(),
            senderId: userId,
            senderName: socket.user?.name || '',
            callType: String(call.type || 'audio'),
            isGroup: false,
            reason: 'declined'
          })
        ).then((pushResult) => {
          if (pushResult?.skipped) {
            console.log('[Push] call_declined skipped:', pushResult);
          }
        }).catch((error) => {
          console.warn('[Push] call_declined notification failed:', error?.message || error);
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

          // ВАЖНО: если пользователь потерял соединение/закрыл вкладку во время звонка,
          // нужно принудительно вывести его из активных звонков, иначе Call остаётся active
          // и при повторной попытке сервер отвечает already_active.
          try {
            const activeUserCalls = await Call.find({
              status: { $in: ['ringing', 'active'] },
              participants: { $elemMatch: { user: userId, leftAt: null } }
            });

            for (const call of activeUserCalls) {
              await forceLeaveUserFromCall({
                io,
                userId,
                call,
                notificationService,
                senderName: socket.user?.name || ''
              });
            }
          } catch (err) {
            console.error('[Socket] disconnect cleanup error:', err);
          }

          await User.findByIdAndUpdate(userId, {
            status: 'offline',
            lastSeen: new Date()
          });

          broadcastUserStatus(io, userId, 'offline');
        }
      }

      // Diagnostic snapshot to catch socket leaks per user.
      const activeSocketsCount = userSockets.get(userId)?.size || 0;
      if (activeSocketsCount > 0) {
        console.log(`[Socket] user ${userId} still has ${activeSocketsCount} active socket(s) after disconnect`);
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

  return { userSockets, activeCalls, activeGroupCalls };
};
