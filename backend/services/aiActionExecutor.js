const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const config = require('../config.local');
const { AI_TOOLS } = require('./aiTools');
const { formatChatForUser } = require('../social/services/chatService');
const { logAiAction, loadLatestSuccessfulAiAction } = require('./aiLogService');
const { rememberAction } = require('./aiMemoryService');
const { startPrivateCallFlow } = require('./callOrchestrator');
const { getOpenRouterApiKey } = require('./aiService');

const FEATURE_HELP = {
  capabilities: [
    'Я умею создавать группы по вашему запросу.',
    'Могу показать ваши текущие чаты.',
    'Могу проверять состояние сервера и разбирать проблемы со связью.',
    'Могу запускать реальные действия, если для них хватает данных.'
  ],
  calls: [
    'В GovChat есть личные и групповые звонки.',
    'Если связь лагает, я могу проверить сервер и предложить план действий.',
    'Если вы дадите нужный chatId или userId, я могу реально запустить личный звонок.'
  ],
  groups: [
    'Могу создать новую группу.',
    'Могу добавить участника в группу, если у меня есть chatId и userId или телефон.'
  ],
  messages: [
    'В сообщениях поддерживаются realtime, вложения, редактирование и удаление.',
    'Если назовёте конкретную функцию, объясню без воды.'
  ],
  support: [
    'Чат поддержки умеет не только отвечать, но и запускать инструменты.',
    'Например: проверить сервер, подсказать фикс, создать группу, показать чаты или инициировать звонок.'
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
    const error = new Error('Неизвестное действие AI.');
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

function pickValueByPath(source, path) {
  if (!source || !path) return undefined;

  return String(path)
    .split('.')
    .filter(Boolean)
    .reduce((accumulator, segment) => (
      accumulator && typeof accumulator === 'object'
        ? accumulator[segment]
        : undefined
    ), source);
}

function resolveTemplateValue(value, runtimeContext) {
  if (typeof value === 'string' && value.startsWith('$')) {
    return pickValueByPath(runtimeContext, value.slice(1));
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplateValue(item, runtimeContext));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((accumulator, [key, nestedValue]) => {
      accumulator[key] = resolveTemplateValue(nestedValue, runtimeContext);
      return accumulator;
    }, {});
  }

  return value;
}

function resolveSequentialParams(action, params, sequenceState) {
  const lastStep = sequenceState.steps[sequenceState.steps.length - 1] || null;
  const runtimeContext = {
    last: lastStep?.result?.data || {},
    lastStep: lastStep ? {
      action: lastStep.action,
      data: lastStep.result?.data || {}
    } : {},
    currentChatId: sequenceState.chatId,
    steps: sequenceState.steps.reduce((accumulator, step, index) => {
      accumulator[`step${index + 1}`] = {
        action: step.action,
        data: step.result?.data || {}
      };
      return accumulator;
    }, {})
  };

  const resolved = resolveTemplateValue(params || {}, runtimeContext) || {};

  if (action === 'add_user' && !resolved.chatId && lastStep?.result?.data?.chatId) {
    resolved.chatId = lastStep.result.data.chatId;
  }

  if (action === 'suggest_fix_connection' && !resolved.serverStatus && lastStep?.action === 'get_server_status') {
    resolved.serverStatus = lastStep.result?.data || null;
  }

  return resolved;
}

function sortValueDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortValueDeep);
  }

  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.keys(value)
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = sortValueDeep(value[key]);
        return accumulator;
      }, {});
  }

  return value;
}

function buildParamsFingerprint(params) {
  try {
    return JSON.stringify(sortValueDeep(params && typeof params === 'object' ? params : {}));
  } catch (_) {
    return '{}';
  }
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
  const refreshedChat = await Chat.findById(chat._id)
    .populate('participants.user', 'name phone avatarUrl status lastSeen isSystem systemKey');
  if (!refreshedChat) {
    const error = new Error('Созданная группа не найдена после сохранения.');
    error.code = 'AI_GROUP_CHAT_NOT_FOUND';
    throw error;
  }
  emitChatToUserSockets({ app, userId: actorUserId, chat: refreshedChat });

  return {
    ok: true,
    action: 'create_group',
    responseText: `Готово. Создал группу «${name}».`,
    responseText: `Готово. Создал группу «${name}».`,
    data: {
      chatId: String(chat._id),
      name
    },
    responseText: `Готово. Создал группу «${name}».`
  };
}

async function addUserTool({ app, actorUserId, params }) {
  const chatId = String(params?.chatId || '').trim();
  const userId = String(params?.userId || '').trim();
  const phone = String(params?.phone || '').trim();

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    const error = new Error('Для add_user нужен корректный chatId.');
    error.code = 'AI_ADD_USER_CHAT_REQUIRED';
    throw error;
  }

  const chat = await Chat.findById(chatId)
    .populate('participants.user', 'name phone avatarUrl status lastSeen isSystem systemKey');
  if (!chat) {
    const error = new Error('Группа не найдена.');
    error.code = 'AI_ADD_USER_CHAT_NOT_FOUND';
    throw error;
  }

  if (chat.type !== 'group') {
    const error = new Error('Добавить участника можно только в группу.');
    error.code = 'AI_ADD_USER_GROUP_ONLY';
    throw error;
  }

  if (!chat.isParticipant(actorUserId) || !chat.isAdmin(actorUserId)) {
    const error = new Error('Для добавления участника нужны права администратора группы.');
    error.code = 'AI_ADD_USER_FORBIDDEN';
    throw error;
  }

  let targetUser = null;
  if (mongoose.Types.ObjectId.isValid(userId)) {
    targetUser = await User.findById(userId).select('_id name phone avatarUrl');
  } else if (phone) {
    targetUser = await User.findOne({ phone }).select('_id name phone avatarUrl');
  }

  if (!targetUser) {
    const error = new Error('Пользователь для добавления не найден.');
    error.code = 'AI_ADD_USER_TARGET_NOT_FOUND';
    throw error;
  }

  if (chat.isParticipant(targetUser._id)) {
    const error = new Error('Пользователь уже состоит в группе.');
    error.code = 'AI_ADD_USER_ALREADY_PARTICIPANT';
    throw error;
  }

  const addResult = await Chat.updateOne(
    {
      _id: chat._id,
      type: 'group',
      participants: {
        $not: {
          $elemMatch: {
            user: targetUser._id
          }
        }
      }
    },
    {
      $push: {
        participants: {
          user: targetUser._id,
          role: 'member',
          joinedAt: new Date(),
          muted: false
        }
      },
      $set: {
        updatedAt: new Date()
      }
    }
  );

  if (!addResult?.modifiedCount) {
    const error = new Error('Пользователь уже состоит в группе или состояние чата изменилось.');
    error.code = 'AI_ADD_USER_ALREADY_PARTICIPANT';
    throw error;
  }

  await Message.create({
    chat: chat._id,
    sender: actorUserId,
    type: 'system',
    systemEvent: {
      type: 'user_added',
      targetUser: targetUser._id,
      actorUser: actorUserId
    }
  });

  const refreshedChat = await Chat.findById(chat._id)
    .populate('participants.user', 'name phone avatarUrl status lastSeen isSystem systemKey');

  if (!refreshedChat) {
    const error = new Error('Чат не найден после обновления.');
    error.code = 'AI_ADD_USER_CHAT_NOT_FOUND';
    throw error;
  }

  emitChatToUserSockets({ app, userId: targetUser._id, chat: refreshedChat });

  const { io } = getSocketState(app);
  if (io) {
    io.to(`chat:${refreshedChat._id}`).emit('chat:participant_added', {
      chatId: String(refreshedChat._id),
      user: targetUser.toPublicJSON()
    });
  }

  return {
    ok: true,
    action: 'add_user',
    responseText: `Добавил ${targetUser.name} в группу «${chat.name || 'Без названия'}».`,
    data: {
      chatId: String(chat._id),
      userId: String(targetUser._id),
      userName: targetUser.name
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
      statusLine,
      `MongoDB: ${mongoState}.`,
      `Онлайн пользователей по socket: ${userSockets?.size || 0}.`,
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

async function suggestFixConnectionTool({ app, params }) {
  const serverStatus = params?.serverStatus && typeof params.serverStatus === 'object'
    ? {
      responseText: '',
      data: params.serverStatus
    }
    : await getServerStatusTool({ app });

  const serverData = serverStatus.data || {};
  const tips = [
    '1. Переключитесь между Wi-Fi и мобильной сетью, если это возможно.',
    '2. Закройте фоновые загрузки и стриминг на устройстве.',
    '3. Перезайдите в звонок, если деградация появилась после долгой сессии.',
    '4. Если маршрут до сервера нестабилен, можно мягко проверить VPN и сравнить качество.',
    '5. Если проблема массовая, это уже похоже на серверную сторону.'
  ];

  const diagnosis = serverData.mongoState && serverData.mongoState !== 'connected'
    ? 'Похоже, есть серверный риск на стороне базы.'
    : 'По серверным метрикам явной аварии не видно, проблема вероятнее в сети или маршруте.';

  return {
    ok: true,
    action: 'suggest_fix_connection',
    responseText: [
      serverStatus.responseText || '',
      diagnosis,
      'Что сделать сейчас:',
      tips.join(' ')
    ].join(' ').trim(),
    data: {
      server: serverData,
      diagnosis,
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
        isAiChat: Boolean(chat.isAiChat),
        peerUserId: chat.peerUserId || null
      }))
    }
  };
}

async function startCallTool({ app, actor, params }) {
  const result = await startPrivateCallFlow({
    app,
    fromUserId: actor._id,
    toUserId: params?.userId || null,
    chatId: params?.chatId || null,
    type: params?.type || 'video',
    notifyInitiator: true,
    source: 'ai',
    initiatorUser: actor
  });

  return {
    ok: true,
    action: 'start_call',
    responseText: `Запустил звонок с ${result.targetUser.name}.`,
    data: {
      callId: String(result.call._id),
      chatId: String(result.chat._id),
      targetUserId: String(result.targetUser._id),
      targetUserName: result.targetUser.name
    }
  };
}

const EXECUTORS = {
  create_group: createGroupTool,
  add_user: addUserTool,
  get_server_status: getServerStatusTool,
  explain_feature: explainFeatureTool,
  suggest_fix_connection: suggestFixConnectionTool,
  get_user_chats: getUserChatsTool,
  start_call: startCallTool
};

async function resolveActor(actorUserId) {
  if (!mongoose.Types.ObjectId.isValid(String(actorUserId || ''))) {
    const error = new Error('Некорректный пользователь для AI-действия.');
    error.code = 'AI_INVALID_ACTOR';
    throw error;
  }

  const actor = await User.findById(actorUserId).select('_id name avatarUrl');
  if (!actor) {
    const error = new Error('Пользователь для AI-действия не найден.');
    error.code = 'AI_ACTOR_NOT_FOUND';
    throw error;
  }

  return actor;
}

async function runSingleAction({
  app,
  actor,
  chatId,
  action,
  params,
  messageId = null,
  stepIndex = null,
  planId = null,
  partial = false
}) {
  ensureKnownAction(action);
  const executor = EXECUTORS[action];
  if (!executor) {
    const error = new Error('Для действия AI не найден executor.');
    error.code = 'AI_ACTION_EXECUTOR_MISSING';
    throw error;
  }

  const startedAt = Date.now();
  const paramsFingerprint = buildParamsFingerprint(params || {});
  const normalizedStepIndex = Number.isInteger(stepIndex) ? stepIndex : null;

  if (normalizedStepIndex !== null && mongoose.Types.ObjectId.isValid(String(messageId || ''))) {
    const loggedAction = await loadLatestSuccessfulAiAction({
      userId: actor._id,
      chatId,
      messageId,
      action,
      paramsFingerprint,
      stepIndex: normalizedStepIndex
    });

    if (loggedAction) {
      return {
        ok: true,
        action,
        responseText: loggedAction.responseText || 'Готово.',
        data: loggedAction.resultData || null,
        replayedFromLog: true
      };
    }
  }

  try {
    const result = await executor({
      app,
      actorUserId: actor._id,
      actor,
      chatId,
      params: params || {}
    });

    await Promise.all([
      logAiAction({
        userId: actor._id,
        action,
        chatId,
        messageId,
        paramsFingerprint,
        stepIndex,
        planId,
        partial,
        success: true,
        duration: Date.now() - startedAt,
        error: null,
        responseText: result?.responseText || null,
        resultData: result?.data || null
      }),
      rememberAction({
        userId: actor._id,
        action,
        params,
        result,
        success: true
      })
    ]);

    return result;
  } catch (error) {
    await Promise.all([
      logAiAction({
        userId: actor._id,
        action,
        chatId,
        messageId,
        paramsFingerprint,
        stepIndex,
        planId,
        partial,
        success: false,
        duration: Date.now() - startedAt,
        error: error?.message || 'Unknown AI action error',
        responseText: error?.partialResult?.responseText || null,
        resultData: error?.partialResult?.data || null
      }),
      rememberAction({
        userId: actor._id,
        action,
        params,
        result: { responseText: error?.message || '' },
        success: false
      })
    ]);
    throw error;
  }
}

async function executeAiAction({ app, actorUserId, chatId, action, params, messageId = null, planId = null }) {
  const actor = await resolveActor(actorUserId);
  const resolvedPlanId = String(planId || new mongoose.Types.ObjectId());
  return runSingleAction({
    app,
    actor,
    chatId,
    action,
    params: params || {},
    messageId,
    stepIndex: 0,
    planId: resolvedPlanId
  });
}

function buildPlanResponse({ normalizedActions, sequenceState, planId = null, failedStep = null }) {
  const lastStep = sequenceState.steps[sequenceState.steps.length - 1] || null;
  const failureText = failedStep
    ? `Step ${Number(failedStep.index) + 1} (${failedStep.action || 'unknown'}) failed: ${failedStep.error?.message || 'Unknown AI action error'}.`
    : null;
  return {
    ok: !failedStep,
    partial: Boolean(failedStep),
    action: normalizedActions.length === 1
      ? (lastStep?.action || failedStep?.action || 'unknown')
      : 'multi_step',
    responseText: failedStep
      ? (lastStep?.result?.responseText || failedStep.error?.message || 'Действие остановлено.')
      : (lastStep?.result?.responseText || 'Готово.'),
    data: {
      steps: sequenceState.steps.map((step, index) => ({
        stepIndex: index,
        action: step.action,
        params: step.params,
        data: step.result?.data || null
      })),
      planId: planId ? String(planId) : null,
      failedStep: failedStep ? {
        stepIndex: failedStep.index,
        action: failedStep.action,
        params: failedStep.params,
        error: failedStep.error?.message || 'Unknown AI action error',
        code: failedStep.error?.code || 'AI_MULTI_STEP_FAILED'
      } : null
    }
  };
}

async function executeAiPlan({
  app,
  actorUserId,
  chatId,
  actions,
  messageId = null,
  planId = null,
  onStepStart,
  onStepSuccess,
  onStepError
}) {
  const actor = await resolveActor(actorUserId);
  const normalizedActions = Array.isArray(actions) ? actions : [];
  if (normalizedActions.length === 0) {
    const error = new Error('Пустой AI action plan.');
    error.code = 'AI_PLAN_EMPTY';
    throw error;
  }

  const sequenceState = {
    chatId,
    steps: []
  };
  const resolvedPlanId = String(planId || new mongoose.Types.ObjectId());

  for (let index = 0; index < normalizedActions.length; index += 1) {
    const step = normalizedActions[index] || {};
    const action = String(step.action || '').trim();
    const params = resolveSequentialParams(action, step.params || {}, sequenceState);
    const stepContext = {
      index,
      total: normalizedActions.length,
      action,
      params
    };

    onStepStart?.(stepContext);

    try {
      const result = await runSingleAction({
        app,
        actor,
        chatId,
        action,
        params,
        messageId,
        stepIndex: index,
        planId: resolvedPlanId,
        partial: index > 0
      });

      const completedStep = {
        action,
        params,
        result
      };
      sequenceState.steps.push(completedStep);
      onStepSuccess?.({
        ...stepContext,
        result
      });
    } catch (error) {
      error.code = error.code || 'AI_MULTI_STEP_FAILED';
      error.stepIndex = index;
      error.totalSteps = normalizedActions.length;
      error.aiSteps = sequenceState.steps;
      error.planId = resolvedPlanId;
      error.partialResult = buildPlanResponse({
        normalizedActions,
        sequenceState,
        planId: resolvedPlanId,
        failedStep: {
          index,
          action,
          params,
          error
        }
      });
      onStepError?.({
        ...stepContext,
        error
      });
      throw error;
    }
  }

  return buildPlanResponse({
    normalizedActions,
    sequenceState,
    planId: resolvedPlanId
  });

  return {
    ok: true,
    action: normalizedActions.length === 1 ? lastStep.action : 'multi_step',
    responseText: lastStep?.result?.responseText || 'Готово.',
    data: {
      steps: sequenceState.steps.map((step, index) => ({
        index,
        action: step.action,
        params: step.params,
        data: step.result?.data || null
      }))
    }
  };
}

module.exports = {
  executeAiAction,
  executeAiPlan
};
