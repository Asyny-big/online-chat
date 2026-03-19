const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const Call = require('../models/Call');
const User = require('../models/User');
const { maybeRewardCallStart } = require('../economy/rewardsService');
const { NotificationService } = require('./notificationService');
const { formatChatForUser, ensureDirectChat } = require('../social/services/chatService');

function getSocketState(app) {
  const io = app?.get?.('io');
  const socketData = app?.get?.('socketData') || {};

  return {
    io,
    userSockets: socketData.userSockets,
    activeCalls: socketData.activeCalls,
    activeGroupCalls: socketData.activeGroupCalls
  };
}

function emitToUserSockets({ io, userSockets, userId, event, payload }) {
  const sockets = userSockets?.get?.(String(userId || ''));
  if (!io || !sockets || sockets.size === 0) return;

  sockets.forEach((socketId) => {
    io.to(socketId).emit(event, payload);
  });
}

function emitToSingleSocket({ io, socketId, event, payload }) {
  if (!io || !socketId) return;
  io.to(String(socketId)).emit(event, payload);
}

function buildUserSummary(user) {
  return {
    _id: String(user?._id || ''),
    name: String(user?.name || '').trim(),
    avatarUrl: user?.avatarUrl || null
  };
}

function createCallError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function syncChatToUser({ app, chat, userId }) {
  const { io, userSockets } = getSocketState(app);
  if (!io || !chat || !userId) return;

  const payload = formatChatForUser({
    app,
    chat,
    viewerUserId: userId
  });

  emitToUserSockets({
    io,
    userSockets,
    userId,
    event: 'chat:new',
    payload
  });
  emitToUserSockets({
    io,
    userSockets,
    userId,
    event: 'chat:created',
    payload: { chat: payload, created: true }
  });
  emitToUserSockets({
    io,
    userSockets,
    userId,
    event: 'new_chat',
    payload
  });
}

async function resolvePrivateCallTarget({ fromUserId, toUserId, chatId }) {
  if (chatId) {
    const chat = await Chat.findById(chatId)
      .populate('participants.user', '_id name phone avatarUrl status lastSeen isSystem systemKey');

    if (!chat) {
      throw createCallError('Чат не найден.', 'AI_CALL_CHAT_NOT_FOUND');
    }

    if (chat.type !== 'private') {
      throw createCallError('AI может запускать только личный звонок.', 'AI_CALL_CHAT_NOT_PRIVATE');
    }

    if (!chat.isParticipant(fromUserId)) {
      throw createCallError('Нет доступа к чату для старта звонка.', 'AI_CALL_CHAT_ACCESS_DENIED');
    }

    const targetParticipant = (chat.participants || []).find((participant) => {
      const participantId = participant?.user?._id?.toString?.() || participant?.user?.toString?.();
      return participantId && participantId !== String(fromUserId);
    });

    if (!targetParticipant?.user?._id) {
      throw createCallError('Собеседник для звонка не найден.', 'AI_CALL_TARGET_NOT_FOUND');
    }

    return {
      chat,
      targetUser: targetParticipant.user
    };
  }

  if (!mongoose.Types.ObjectId.isValid(String(toUserId || ''))) {
    throw createCallError('Некорректный userId для звонка.', 'AI_INVALID_TARGET_USER');
  }

  if (String(fromUserId) === String(toUserId)) {
    throw createCallError('Нельзя начать звонок с самим собой.', 'AI_SELF_CALL_NOT_ALLOWED');
  }

  const targetUser = await User.findById(toUserId).select('_id name avatarUrl');
  if (!targetUser) {
    throw createCallError('Пользователь для звонка не найден.', 'AI_CALL_TARGET_NOT_FOUND');
  }

  const { chat } = await ensureDirectChat({
    userAId: fromUserId,
    userBId: toUserId
  });

  return {
    chat,
    targetUser
  };
}

function buildPrivateCallPayload({ call, chat, initiator, targetUser, source, direction }) {
  const chatName = String(chat?.name || targetUser?.name || initiator?.name || 'GovChat');
  return {
    callId: String(call._id),
    chatId: String(chat._id),
    chatName,
    type: String(call.type || 'audio'),
    status: String(call.status || 'ringing'),
    source,
    direction,
    initiator: buildUserSummary(initiator),
    targetUser: buildUserSummary(targetUser)
  };
}

function updateActivePrivateCallMap(activeCalls, chatId, callId, initiatorId) {
  if (!activeCalls?.set) return;
  activeCalls.set(String(chatId), {
    callId: String(callId),
    participants: new Set([String(initiatorId)])
  });
}

async function resolveExistingActiveCall(chatId) {
  return Call.findOne({
    chat: chatId,
    status: { $in: ['ringing', 'active'] }
  }).select('_id type status chat');
}

function throwExistingCallError(existingCall, fallbackType) {
  const error = createCallError('В чате уже есть активный звонок.', 'AI_CALL_ALREADY_ACTIVE');
  error.callId = String(existingCall?._id || '');
  error.callType = String(existingCall?.type || fallbackType || 'audio');
  throw error;
}

async function startPrivateCallFlow({
  app,
  fromUserId,
  toUserId = null,
  chatId = null,
  type = 'video',
  notifyInitiator = false,
  source = 'user',
  initiatorUser = null
}) {
  if (!mongoose.Types.ObjectId.isValid(String(fromUserId || ''))) {
    throw createCallError('Некорректный пользователь для звонка.', 'AI_INVALID_ACTOR');
  }

  const normalizedType = String(type || 'video').trim().toLowerCase() === 'audio' ? 'audio' : 'video';
  const { io, userSockets, activeCalls } = getSocketState(app);

  const [initiator, resolved] = await Promise.all([
    initiatorUser
      ? Promise.resolve(initiatorUser)
      : User.findById(fromUserId).select('_id name avatarUrl'),
    resolvePrivateCallTarget({ fromUserId, toUserId, chatId })
  ]);

  if (!initiator?._id) {
    throw createCallError('Инициатор звонка не найден.', 'AI_ACTOR_NOT_FOUND');
  }

  const chat = resolved.chat;
  const targetUser = resolved.targetUser;

  if (chat.isAiChat) {
    throw createCallError('В чате поддержки звонки недоступны.', 'AI_CALL_NOT_ALLOWED_IN_SUPPORT');
  }

  const existingCall = await resolveExistingActiveCall(chat._id);
  if (existingCall) {
    throwExistingCallError(existingCall, normalizedType);
  }

  let call;
  try {
    call = await Call.create({
      chat: chat._id,
      initiator: initiator._id,
      type: normalizedType,
      status: 'ringing',
      participants: [{ user: initiator._id }]
    });
  } catch (error) {
    if (error?.code === 11000) {
      const lockedCall = await resolveExistingActiveCall(chat._id);
      throwExistingCallError(lockedCall, normalizedType);
    }
    throw error;
  }

  updateActivePrivateCallMap(activeCalls, chat._id, call._id, initiator._id);

  await Promise.all([
    syncChatToUser({ app, chat, userId: initiator._id }),
    syncChatToUser({ app, chat, userId: targetUser._id })
  ]);

  const initiatorPayload = buildPrivateCallPayload({
    call,
    chat,
    initiator,
    targetUser,
    source,
    direction: 'outgoing'
  });
  const targetPayload = buildPrivateCallPayload({
    call,
    chat,
    initiator,
    targetUser,
    source,
    direction: 'incoming'
  });

  emitToUserSockets({
    io,
    userSockets,
    userId: targetUser._id,
    event: 'call:incoming',
    payload: targetPayload
  });
  emitToUserSockets({
    io,
    userSockets,
    userId: targetUser._id,
    event: 'call:sync',
    payload: targetPayload
  });

  emitToUserSockets({
    io,
    userSockets,
    userId: initiator._id,
    event: 'call:sync',
    payload: initiatorPayload
  });

  if (notifyInitiator) {
    emitToUserSockets({
      io,
      userSockets,
      userId: initiator._id,
      event: 'call:start:ai',
      payload: initiatorPayload
    });
  }

  const notificationService = new NotificationService({ userSockets, io });
  Promise.resolve(
    notificationService.sendIncomingCallNotification({
      chat,
      callId: String(call._id),
      senderId: initiator._id,
      senderName: initiator.name,
      callType: normalizedType,
      isGroup: false
    })
  ).catch((error) => {
    console.warn('[Push] incoming_call notification failed:', error?.message || error);
  });

  Promise.resolve(
    maybeRewardCallStart({
      userId: String(initiator._id),
      callId: String(call._id),
      chatId: String(chat._id),
      callType: normalizedType
    })
  ).catch((error) => {
    console.warn('[Economy] call_start reward failed:', error?.message || error);
  });

  return {
    call,
    chat,
    targetUser,
    initiator,
    chatName: initiatorPayload.chatName
  };
}

async function syncActiveCallsForUser({ app, userId, socketId = null }) {
  if (!mongoose.Types.ObjectId.isValid(String(userId || ''))) {
    return;
  }

  const { io, userSockets } = getSocketState(app);
  if (!io || (!socketId && !userSockets?.get?.(String(userId)))) {
    return;
  }

  const calls = await Call.find({
    status: { $in: ['ringing', 'active'] }
  })
    .populate('chat')
    .populate('initiator', '_id name avatarUrl')
    .lean();

  const syncedPrivateCallIds = [];
  const syncedGroupCallIds = [];

  for (const call of calls) {
    const chat = call.chat;
    if (!chat) continue;

    const participantIds = Array.isArray(chat.participants)
      ? chat.participants.map((participant) => participant?.user?._id?.toString?.() || participant?.user?.toString?.())
      : [];
    const activeParticipantIds = Array.isArray(call.participants)
      ? call.participants
        .filter((participant) => !participant?.leftAt)
        .map((participant) => participant?.user?._id?.toString?.() || participant?.user?.toString?.())
      : [];
    const isRinging = String(call.status || '') === 'ringing';

    if (!participantIds.includes(String(userId))) {
      continue;
    }

    if (chat.type === 'group') {
      const payload = {
        callId: String(call._id),
        chatId: String(chat._id),
        chatName: String(chat.name || 'GovChat'),
        type: String(call.type || 'audio'),
        status: String(call.status || 'ringing'),
        direction: String(call.initiator?._id || '') === String(userId) ? 'outgoing' : 'incoming',
        initiator: buildUserSummary(call.initiator),
        participantCount: Array.isArray(call.participants)
          ? call.participants.filter((participant) => !participant?.leftAt).length
          : 0
      };

      if (socketId) {
        emitToSingleSocket({ io, socketId, event: 'group-call:sync', payload });
      } else {
        emitToUserSockets({
          io,
          userSockets,
          userId,
          event: 'group-call:sync',
          payload
        });
      }
      syncedGroupCallIds.push(String(call._id));
      continue;
    }

    const shouldSyncPrivateCall = activeParticipantIds.includes(String(userId))
      || (isRinging && participantIds.includes(String(userId)));
    if (!shouldSyncPrivateCall) {
      continue;
    }

    const targetParticipant = (chat.participants || []).find((participant) => {
      const participantId = participant?.user?._id?.toString?.() || participant?.user?.toString?.();
      return participantId && participantId !== String(call.initiator?._id || '');
    }) || null;

    const targetUser = targetParticipant?.user || {};
    const direction = String(call.initiator?._id || '') === String(userId) ? 'outgoing' : 'incoming';
    const payload = {
      callId: String(call._id),
      chatId: String(chat._id),
      chatName: String(chat.name || targetUser?.name || call.initiator?.name || 'GovChat'),
      type: String(call.type || 'audio'),
      status: String(call.status || 'ringing'),
      source: 'sync',
      direction,
      initiator: buildUserSummary(call.initiator),
      targetUser: buildUserSummary(direction === 'outgoing' ? targetUser : call.initiator)
    };

    if (socketId) {
      emitToSingleSocket({ io, socketId, event: 'call:sync', payload });
    } else {
      emitToUserSockets({
        io,
        userSockets,
        userId,
        event: 'call:sync',
        payload
      });
    }
    syncedPrivateCallIds.push(String(call._id));
  }

  const completionPayload = {
    privateCallIds: syncedPrivateCallIds,
    groupCallIds: syncedGroupCallIds
  };

  if (socketId) {
    emitToSingleSocket({
      io,
      socketId,
      event: 'call:sync:complete',
      payload: completionPayload
    });
    return;
  }

  emitToUserSockets({
    io,
    userSockets,
    userId,
    event: 'call:sync:complete',
    payload: completionPayload
  });
}

module.exports = {
  startPrivateCallFlow,
  syncActiveCallsForUser
};
