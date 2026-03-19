const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const config = require('../config.local');
const { getOpenRouterApiKey } = require('./aiService');
const { AI_TOOLS } = require('./aiTools');
const { formatChatForUser, ensureDirectChat } = require('../social/services/chatService');

const FEATURE_HELP = {
  capabilities: [
    'Я умею создавать группы по вашему запросу.',
    'Могу показать ваши текущие чаты.',
    'Могу проверить состояние сервера и подсказать, что делать при лагах в звонках.',
    'Могу объяснить функции GovChat без лишней воды.'
  ],
  calls: [
    'В GovChat есть личные и групповые звонки.',
    'Если связь лагает, я могу быстро проверить сервер и дать конкретные шаги.'
  ],
  groups: [
    'Группы можно создавать и управлять участниками.',
    'Я уже умею создавать новую группу прямо из чата поддержки.'
  ],
  messages: [
    'В сообщениях поддерживаются редактирование, удаление, вложения и realtime.',
    'Я могу подсказать, как это работает, если назовёте конкретную функцию.'
  ],
  support: [
    'Этот чат поддержки теперь умеет не только отвечать, но и выполнять реальные действия.',
    'Например: создать группу, показать чаты, проверить состояние сервера.'
  ]
};

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

function emitChatToUserSockets({ app, userId, chat }) {
  const { io, userSockets } = getSocketState(app);
  const sockets = userSockets?.get?.(String(userId));
  if (!io || !sockets || sockets.size === 0) return;

  const payload = formatChatForUser({
    app,
    chat,
    viewerUserId: userId
  });

  sockets.forEach((socketId) => {
    io.to(socketId).emit('chat:new', payload);
    io.to(socketId).emit('chat:created', { chat: payload, created: true });
    io.to(socketId).emit('new_chat', payload);
  });
}

function ensureKnownAction(action) {
  if (!AI_TOOLS[action]) {
    const error = new Error('Неизвестное действие AI');
    error.code = 'AI_ACTION_NOT_ALLOWED';
    throw error;
  }
}

function toMongoState(value) {
  const state = Number(value || 0);
  const labels = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return labels[state] || 'unknown';
}

function normalizeFeature(feature) {
  const normalized = String(feature || '').trim().toLowerCase();
  if (!normalized) return 'capabilities';
  if (normalized.includes('уме')) return 'capabilities';
  if (normalized.includes('звон')) return 'calls';
  if (normalized.includes('груп')) return 'groups';
  if (normalized.includes('сообщ')) return 'messages';
  if (normalized.includes('поддерж')) return 'support';
  return normalized;
}

async function createGroupTool({ app, actorUserId, params }) {
  const name = String(params?.name || '').trim();
  if (!name) {
    const error = new Error('Не удалось создать группу: не указано название.');
    error.code = 'AI_GROUP_NAME_REQUIRED';
    throw error;
  }

  if (name.length > 100) {
    const error = new Error('Название группы слишком длинное.');
    error.code = 'AI_GROUP_NAME_TOO_LONG';
    throw error;
  }

  const chat = await Chat.create({
    type: 'group',
    name,
    participants: [{ user: actorUserId, role: 'admin' }]
  });

  await Message.create({
    chat: chat._id,
    sender: actorUserId,
    type: 'system',
    systemEvent: { type: 'chat_created' }
  });

  await chat.populate('participants.user', 'name phone avatarUrl status lastSeen isSystem systemKey');
  emitChatToUserSockets({ app, userId: actorUserId, chat });

  return {
    ok: true,
    action: 'create_group',
    responseText: `Готово ✅ Создал группу «${name}». Она уже появилась у вас в списке чатов.`,
    data: {
      chatId: String(chat._id),
      name
    }
  };
}

async function getServerStatusTool({ app }) {
  const { userSockets, activeCalls, activeGroupCalls } = getSocketState(app);
  let socketConnections = 0;

  userSockets?.forEach?.((socketIds) => {
    socketConnections += socketIds?.size || 0;
  });

  const mongoState = toMongoState(mongoose.connection.readyState);
  const openRouterConfigured = Boolean(getOpenRouterApiKey());
  const activePrivateCalls = activeCalls?.size || 0;
  const activeGroupCallCount = activeGroupCalls?.size || 0;

  const statusLine = mongoState === 'connected'
    ? 'Сервер сейчас выглядит здоровым.'
    : `Есть сигнал проблемы: MongoDB в состоянии ${mongoState}.`;

  return {
    ok: mongoState === 'connected',
    action: 'get_server_status',
    responseText: [
      `${statusLine}`,
      `MongoDB: ${mongoState}.`,
      `Socket-пользователей онлайн: ${userSockets?.size || 0}.`,
      `Socket-соединений: ${socketConnections}.`,
      `Активных личных звонков: ${activePrivateCalls}.`,
      `Активных групповых звонков: ${activeGroupCallCount}.`,
      `OpenRouter: ${openRouterConfigured ? 'настроен' : 'не настроен'}.`,
      `TURN: ${config.TURN_SECRET ? 'настроен' : 'не настроен'}.`
    ].join(' '),
    data: {
      mongoState,
      onlineUsers: userSockets?.size || 0,
      socketConnections,
      activePrivateCalls,
      activeGroupCalls: activeGroupCallCount,
      openRouterConfigured,
      turnConfigured: Boolean(config.TURN_SECRET)
    }
  };
}

async function explainFeatureTool({ params }) {
  const featureKey = normalizeFeature(params?.feature);
  const lines = FEATURE_HELP[featureKey] || FEATURE_HELP.capabilities;

  return {
    ok: true,
    action: 'explain_feature',
    responseText: lines.join(' '),
    data: {
      feature: featureKey
    }
  };
}

async function suggestFixConnectionTool({ app }) {
  const status = await getServerStatusTool({ app });
  const tips = [
    '1. Переключитесь между Wi-Fi и мобильной сетью, если это возможно.',
    '2. Закройте фоновые загрузки и стриминг на устройстве.',
    '3. Перезайдите в звонок, если лаг появился после долгой сессии.',
    '4. Если маршрут до сервера нестабилен, можно мягко попробовать VPN и сравнить качество.',
    '5. Если проблема повторяется у всех участников, это уже похоже на серверную сторону.'
  ];

  return {
    ok: true,
    action: 'suggest_fix_connection',
    responseText: `${status.responseText} Быстрый план: ${tips.join(' ')}`,
    data: {
      server: status.data,
      tips
    }
  };
}

async function getUserChatsTool({ app, actorUserId }) {
  const chats = await Chat.find({ 'participants.user': actorUserId })
    .populate('participants.user', 'name phone avatarUrl status lastSeen isSystem systemKey')
    .sort({ updatedAt: -1 })
    .limit(8);

  if (!chats.length) {
    return {
      ok: true,
      action: 'get_user_chats',
      responseText: 'У вас пока нет других чатов, кроме поддержки.',
      data: { chats: [] }
    };
  }

  const items = chats.map((chat) => formatChatForUser({
    app,
    chat,
    viewerUserId: actorUserId
  }));

  const summary = items
    .map((chat, index) => `${index + 1}. ${chat.displayName || chat.name || 'Чат'}`)
    .join(' ');

  return {
    ok: true,
    action: 'get_user_chats',
    responseText: `Вот ваши последние чаты: ${summary}`,
    data: {
      chats: items.map((chat) => ({
        chatId: String(chat._id),
        displayName: chat.displayName || chat.name || 'Чат',
        type: chat.type,
        isAiChat: Boolean(chat.isAiChat)
      }))
    }
  };
}

async function startCallTool({ actorUserId, params }) {
  const targetUserId = String(params?.userId || '').trim();
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    const error = new Error('Не удалось подготовить звонок: некорректный userId.');
    error.code = 'AI_INVALID_TARGET_USER';
    throw error;
  }

  if (String(actorUserId) === targetUserId) {
    const error = new Error('Нельзя начать звонок с самим собой.');
    error.code = 'AI_SELF_CALL_NOT_ALLOWED';
    throw error;
  }

  const targetUser = await User.findById(targetUserId).select('_id name');
  if (!targetUser) {
    const error = new Error('Пользователь для звонка не найден.');
    error.code = 'AI_CALL_TARGET_NOT_FOUND';
    throw error;
  }

  const { chat } = await ensureDirectChat({
    userAId: actorUserId,
    userBId: targetUserId
  });

  return {
    ok: true,
    action: 'start_call',
    responseText: `Я подготовил чат с ${targetUser.name}. Автозапуск звонка без подтверждения клиента сейчас не поддерживается, но нужный чат уже готов.`,
    data: {
      chatId: String(chat._id),
      targetUserId
    }
  };
}

const EXECUTORS = {
  create_group: createGroupTool,
  get_server_status: getServerStatusTool,
  explain_feature: explainFeatureTool,
  suggest_fix_connection: suggestFixConnectionTool,
  get_user_chats: getUserChatsTool,
  start_call: startCallTool
};

async function executeAiAction({ app, actorUserId, chatId, action, params }) {
  ensureKnownAction(action);

  if (!mongoose.Types.ObjectId.isValid(String(actorUserId || ''))) {
    const error = new Error('Некорректный пользователь для AI-действия.');
    error.code = 'AI_INVALID_ACTOR';
    throw error;
  }

  const actor = await User.findById(actorUserId).select('_id');
  if (!actor) {
    const error = new Error('Пользователь для AI-действия не найден.');
    error.code = 'AI_ACTOR_NOT_FOUND';
    throw error;
  }

  const executor = EXECUTORS[action];
  if (!executor) {
    const error = new Error('Для действия AI не найден executor.');
    error.code = 'AI_ACTION_EXECUTOR_MISSING';
    throw error;
  }

  return executor({
    app,
    actorUserId,
    chatId,
    params: params || {}
  });
}

module.exports = {
  executeAiAction
};
