const mongoose = require('mongoose');
const Call = require('../models/Call');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const AiLog = require('../models/AiLog');
const config = require('../config.local');
const { AI_TOOLS } = require('./aiTools');
const { formatChatForUser } = require('../social/services/chatService');
const { logAiAction, loadLatestSuccessfulAiAction } = require('./aiLogService');
const { rememberAction } = require('./aiMemoryService');
const { startPrivateCallFlow } = require('./callOrchestrator');
const { getOpenRouterApiKey } = require('./aiService');
const {
  REQUEST_SLOW_THRESHOLD_MS,
  getSystemSnapshot,
  getSlowRequestSnapshot,
  getRealtimeSnapshot,
  getCallSnapshot
} = require('./runtimeDiagnostics');
const { resolveUser } = require('../utils/userLookup');

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
    activeGroupCalls: socketData.activeGroupCalls,
    activeGroupCallStreams: socketData.activeGroupCallStreams
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

function findLatestStepData(sequenceState, actionName) {
  const steps = Array.isArray(sequenceState?.steps) ? sequenceState.steps : [];
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    if (steps[index]?.action === actionName) {
      return steps[index]?.result?.data || null;
    }
  }

  return null;
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

  if (
    action === 'suggest_fix_connection'
    && !resolved.serverStatus
    && ['get_server_status', 'system_diagnostics'].includes(String(lastStep?.action || ''))
  ) {
    resolved.serverStatus = lastStep.result?.data || null;
  }

  if (action === 'explain_issue') {
    if (!resolved.diagnostics) {
      resolved.diagnostics = findLatestStepData(sequenceState, 'system_diagnostics')
        || findLatestStepData(sequenceState, 'get_server_status');
    }
    if (!resolved.requestAnalysis) {
      resolved.requestAnalysis = findLatestStepData(sequenceState, 'analyze_slow_requests');
    }
    if (!resolved.realtimeHealth) {
      resolved.realtimeHealth = findLatestStepData(sequenceState, 'check_realtime_health');
    }
    if (!resolved.callsHealth) {
      resolved.callsHealth = findLatestStepData(sequenceState, 'check_calls_health');
    }
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

function createAiActionError(message, code, extra = null) {
  const error = new Error(message);
  error.code = code;
  if (extra && typeof extra === 'object') {
    Object.assign(error, extra);
  }
  return error;
}

function buildUserLookupInput(params) {
  if (!params || typeof params !== 'object') {
    return null;
  }

  const userId = String(params.userId || params.id || '').trim();
  const phone = String(params.phone || '').trim();
  const identifier = String(params.identifier || '').trim();
  const username = String(params.username || '').trim();
  const name = String(params.name || '').trim();

  if (!userId && !phone && !identifier && !username && !name) {
    return null;
  }

  return {
    userId,
    phone,
    identifier,
    username,
    name
  };
}

function describeLookupTarget(input) {
  if (!input || typeof input !== 'object') {
    return 'указанному идентификатору';
  }

  if (input.phone) return `номеру ${input.phone}`;
  if (input.identifier) return `идентификатору ${input.identifier}`;
  if (input.username) return `имени ${input.username}`;
  if (input.name) return `имени ${input.name}`;
  if (input.userId) return `id ${input.userId}`;
  return 'указанному идентификатору';
}

async function resolveUserOrThrow({ params, actorUserId = null, purpose = 'general' }) {
  const lookupInput = buildUserLookupInput(params);
  if (!lookupInput) {
    throw createAiActionError(
      'Не указан пользователь. Передайте userId, phone или identifier.',
      'AI_USER_IDENTIFIER_REQUIRED'
    );
  }

  const resolved = await resolveUser(lookupInput, {
    excludeUserId: purpose === 'find_user' ? actorUserId : null
  });

  if (resolved?.ambiguous) {
    throw createAiActionError(
      `Найдено несколько пользователей по ${describeLookupTarget(lookupInput)}. Уточните номер телефона.`,
      'USER_RESOLUTION_AMBIGUOUS',
      { stopExecution: true }
    );
  }

  if (!resolved?.userId || !resolved?.user) {
    throw createAiActionError(
      `Не удалось найти пользователя по ${describeLookupTarget(lookupInput)}. Убедитесь, что он зарегистрирован в GovChat.`,
      'USER_NOT_FOUND',
      { stopExecution: true }
    );
  }

  if (purpose === 'start_call' && actorUserId && String(resolved.userId) === String(actorUserId)) {
    throw createAiActionError('Нельзя позвонить самому себе.', 'AI_SELF_CALL_NOT_ALLOWED', {
      stopExecution: true
    });
  }

  return resolved;
}

function collectParticipantLookupInputs(params) {
  const items = [];
  const participants = Array.isArray(params?.participants) ? params.participants : [];
  const participantPhones = Array.isArray(params?.participantPhones) ? params.participantPhones : [];
  const participantIds = Array.isArray(params?.participantIds) ? params.participantIds : [];

  participants.forEach((item) => {
    if (!item) return;
    if (typeof item === 'string') {
      items.push({ identifier: item });
      return;
    }
    if (typeof item === 'object') {
      const normalized = buildUserLookupInput(item);
      if (normalized) items.push(normalized);
    }
  });

  participantPhones.forEach((phone) => {
    if (String(phone || '').trim()) {
      items.push({ phone: String(phone).trim() });
    }
  });

  participantIds.forEach((userId) => {
    if (String(userId || '').trim()) {
      items.push({ userId: String(userId).trim() });
    }
  });

  return items;
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

  const participantInputs = collectParticipantLookupInputs(params);
  const participantMap = new Map();

  for (const participantInput of participantInputs) {
    const resolved = await resolveUserOrThrow({
      params: participantInput,
      actorUserId,
      purpose: 'create_group'
    });

    if (String(resolved.userId) === String(actorUserId)) {
      continue;
    }

    if (!participantMap.has(String(resolved.userId))) {
      participantMap.set(String(resolved.userId), resolved.user);
    }
  }

  const participants = [{ user: actorUserId, role: 'admin' }];
  participantMap.forEach((user) => {
    participants.push({ user: user._id, role: 'member' });
  });

  const chat = await Chat.create({
    type: 'group',
    name,
    participants
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

  (refreshedChat.participants || []).forEach((participant) => {
    const participantId = participant?.user?._id?.toString?.() || participant?.user?.toString?.();
    if (participantId) {
      emitChatToUserSockets({ app, userId: participantId, chat: refreshedChat });
    }
  });

  const addedCount = participantMap.size;
  const responseText = addedCount > 0
    ? `Готово. Создал группу «${name}» и добавил ${addedCount} ${addedCount === 1 ? 'участника' : addedCount < 5 ? 'участников' : 'участников'}.`
    : `Готово. Создал группу «${name}».`;

  return {
    ok: true,
    action: 'create_group',
    responseText,
    data: {
      chatId: String(chat._id),
      name,
      participantUserIds: Array.from(participantMap.keys())
    }
  };
}

async function addUserTool({ app, actorUserId, params }) {
  const chatId = String(params?.chatId || '').trim();

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

  const { user: targetUser } = await resolveUserOrThrow({
    params,
    actorUserId,
    purpose: 'add_user'
  });

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

async function findUserTool({ actorUserId, params }) {
  const resolved = await resolveUserOrThrow({
    params,
    actorUserId,
    purpose: 'find_user'
  });

  return {
    ok: true,
    action: 'find_user',
    responseText: `Нашёл пользователя ${resolved.user.name}.`,
    data: {
      userId: String(resolved.user._id),
      name: resolved.user.name,
      phone: resolved.user.phone || null,
      avatarUrl: resolved.user.avatarUrl || null,
      resolvedBy: resolved.resolvedBy
    }
  };
}

async function getServerStatusTool({ app }) {
  const result = await systemDiagnosticsTool({ app });
  return {
    ...result,
    action: 'get_server_status'
  };

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

async function measureMongoPingMs() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection?.db?.admin) {
    return null;
  }

  const startedAt = Date.now();

  try {
    await mongoose.connection.db.admin().ping();
    return Date.now() - startedAt;
  } catch (_) {
    return null;
  }
}

function getSocketConnectionsCount(userSockets) {
  let socketConnections = 0;
  userSockets?.forEach?.((socketIds) => {
    socketConnections += socketIds?.size || 0;
  });
  return socketConnections;
}

function buildIssueForecast(issues) {
  if (issues.some((issue) => issue.includes('Mongo') || issue.includes('event loop'))) {
    return 'Если нагрузка сохранится, возможны задержки сообщений и лаги звонков.';
  }
  if (issues.some((issue) => issue.includes('reconnect') || issue.includes('dropped events'))) {
    return 'Если reconnect-волна продолжится, пользователи начнут терять realtime-события и стабильность звонков.';
  }
  if (issues.some((issue) => issue.includes('TURN') || issue.includes('LiveKit'))) {
    return 'Если медиастек останется в таком состоянии, качество звонков будет деградировать при росте нагрузки.';
  }
  return 'Если ситуация повторится под нагрузкой, сначала пострадает realtime и скорость ответа API.';
}

async function systemDiagnosticsToolLegacy({ app }) {
  const { userSockets, activeCalls, activeGroupCalls } = getSocketState(app);
  const systemSnapshot = getSystemSnapshot();
  const mongoLatencyMs = await measureMongoPingMs();
  const socketConnections = getSocketConnectionsCount(userSockets);
  const mongoState = toMongoState(mongoose.connection.readyState);
  const openRouterConfigured = Boolean(getOpenRouterApiKey());
  const activePrivateCalls = activeCalls?.size || 0;
  const activeGroupCallCount = activeGroupCalls?.size || 0;
  const heapUsedMb = Number(systemSnapshot?.memory?.heapUsedMb || 0);
  const heapTotalMb = Number(systemSnapshot?.memory?.heapTotalMb || 0);
  const heapUsageRatio = heapTotalMb > 0 ? heapUsedMb / heapTotalMb : 0;
  const eventLoopP95Ms = Number(systemSnapshot?.eventLoop?.p95Ms || 0);
  const eventLoopMaxMs = Number(systemSnapshot?.eventLoop?.maxMs || 0);
  const issues = [];

  if (mongoState !== 'connected') {
    issues.push(`MongoDB сейчас в состоянии ${mongoState}`);
  } else if (mongoLatencyMs !== null && mongoLatencyMs > 250) {
    issues.push(`Mongo отвечает медленно: ${mongoLatencyMs} ms`);
  }

  if (eventLoopP95Ms > 80 || eventLoopMaxMs > 150) {
    issues.push(`event loop подлагивает: p95 ${eventLoopP95Ms || '?'} ms, max ${eventLoopMaxMs || '?'} ms`);
  }

  if (heapUsageRatio >= 0.85) {
    issues.push(`heap почти заполнен: ${heapUsedMb}/${heapTotalMb} MB`);
  }

  const statusLine = issues.length > 0
    ? `Есть признаки деградации: ${issues.join('; ')}.`
    : 'Критичных признаков деградации по runtime-метрикам сейчас не видно.';

  return {
    ok: issues.length === 0,
    action: 'system_diagnostics',
    responseText: [
      statusLine,
      `CPU процесса: user ${systemSnapshot?.cpu?.userMs ?? '?'} ms, system ${systemSnapshot?.cpu?.systemMs ?? '?'} ms.`,
      `RAM: heap ${heapUsedMb || 0}/${heapTotalMb || 0} MB, RSS ${systemSnapshot?.memory?.rssMb ?? '?'} MB.`,
      `Event loop: p95 ${systemSnapshot?.eventLoop?.p95Ms ?? '?'} ms, max ${systemSnapshot?.eventLoop?.maxMs ?? '?'} ms.`,
      `MongoDB: ${mongoState}${mongoLatencyMs !== null ? `, ping ${mongoLatencyMs} ms` : ''}.`,
      `Socket-подключений: ${socketConnections}, online users: ${userSockets?.size || 0}.`,
      `Активных личных звонков: ${activePrivateCalls}, групповых: ${activeGroupCallCount}.`,
      `OpenRouter: ${openRouterConfigured ? 'настроен' : 'не настроен'}.`,
      `TURN: ${config.TURN_SECRET ? 'настроен' : 'не настроен'}.`
    ].join(' '),
    data: {
      mongoState,
      mongoLatencyMs,
      cpu: systemSnapshot?.cpu || {},
      memory: systemSnapshot?.memory || {},
      eventLoop: systemSnapshot?.eventLoop || {},
      onlineUsers: userSockets?.size || 0,
      socketConnections,
      activePrivateCalls,
      activeGroupCalls: activeGroupCallCount,
      openRouterConfigured,
      turnConfigured: Boolean(config.TURN_SECRET),
      issues
    }
  };
}

async function analyzeSlowRequestsToolLegacy() {
  const requestSnapshot = getSlowRequestSnapshot(5);
  const hotspots = Array.isArray(requestSnapshot?.topRoutes) ? requestSnapshot.topRoutes : [];
  const recentErrors = Array.isArray(requestSnapshot?.recentErrors) ? requestSnapshot.recentErrors : [];
  const issues = [];

  if (hotspots.some((route) => Number(route.slowCount || 0) > 0)) {
    issues.push('есть медленные API-маршруты');
  }
  if (recentErrors.length > 0) {
    issues.push('есть свежие 5xx-ошибки');
  }

  const hotspotText = hotspots.length > 0
    ? hotspots
      .slice(0, 3)
      .map((route) => `${route.routeKey}: avg ${route.avgDurationMs} ms, max ${route.maxDurationMs} ms, slow ${route.slowCount}`)
      .join('; ')
    : 'пока нет накопленных HTTP-метрик';

  const errorText = recentErrors.length > 0
    ? recentErrors
      .slice(0, 3)
      .map((entry) => `${entry.routeKey} -> ${entry.status}, ${entry.durationMs} ms`)
      .join('; ')
    : 'свежих 5xx-ошибок не видно';

  return {
    ok: issues.length === 0,
    action: 'analyze_slow_requests',
    responseText: [
      issues.length > 0
        ? `По API есть сигналы деградации: ${issues.join(', ')}.`
        : 'По свежим HTTP-метрикам явной деградации не видно.',
      `Порог slow request: ${requestSnapshot?.thresholdMs || REQUEST_SLOW_THRESHOLD_MS} ms.`,
      `Горячие маршруты: ${hotspotText}.`,
      `Ошибки: ${errorText}.`
    ].join(' '),
    data: {
      thresholdMs: requestSnapshot?.thresholdMs || REQUEST_SLOW_THRESHOLD_MS,
      totalRequests: requestSnapshot?.totalRequests || 0,
      errorRequests: requestSnapshot?.errorRequests || 0,
      hotspots,
      recentErrors,
      issues
    }
  };
}

async function checkRealtimeHealthToolLegacy({ app }) {
  const { userSockets } = getSocketState(app);
  const socketConnections = getSocketConnectionsCount(userSockets);
  const realtimeSnapshot = getRealtimeSnapshot({
    activeUsers: userSockets?.size || 0,
    socketConnections
  });
  const reconnects = Number(realtimeSnapshot?.recentWindow?.reconnects || 0);
  const droppedEvents = Number(realtimeSnapshot?.recentWindow?.droppedEvents || 0);
  const leakWarnings = Number(realtimeSnapshot?.counters?.activeSocketLeakWarnings || 0);
  const issues = [];

  if (reconnects >= 3) {
    issues.push(`частые reconnect за окно диагностики: ${reconnects}`);
  }
  if (droppedEvents > 0) {
    issues.push(`есть потерянные realtime-события: ${droppedEvents}`);
  }
  if (leakWarnings > 0) {
    issues.push(`были предупреждения о лишних сокетах: ${leakWarnings}`);
  }

  return {
    ok: issues.length === 0,
    action: 'check_realtime_health',
    responseText: [
      issues.length > 0
        ? `Realtime нестабилен: ${issues.join('; ')}.`
        : 'Realtime по текущим метрикам выглядит стабильно.',
      `Активных пользователей: ${realtimeSnapshot?.activeUsers || 0}, socket-соединений: ${realtimeSnapshot?.socketConnections || 0}.`,
      `За окно ${Math.round(Number(realtimeSnapshot?.recentWindow?.windowMs || 0) / 60000) || 0} мин: reconnect ${reconnects}, disconnect ${realtimeSnapshot?.recentWindow?.disconnects || 0}, dropped events ${droppedEvents}.`
    ].join(' '),
    data: {
      ...realtimeSnapshot,
      issues
    }
  };
}

async function checkCallsHealthToolLegacy({ app }) {
  const { activeCalls, activeGroupCalls } = getSocketState(app);
  const callSnapshot = getCallSnapshot();
  const activePrivateCalls = activeCalls?.size || 0;
  const activeGroupCallCount = activeGroupCalls?.size || 0;
  const livekitConfigured = Boolean(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);
  const turnConfigured = Boolean(config.TURN_SECRET);
  const staleThresholdMs = 60_000;
  const activeCallDocs = await Call.find({ status: { $in: ['ringing', 'active'] } })
    .select('_id status type startedAt')
    .lean();
  const staleRingingCalls = activeCallDocs.filter((call) => (
    String(call.status || '') === 'ringing'
    && call.startedAt
    && Date.now() - new Date(call.startedAt).getTime() > staleThresholdMs
  )).length;
  const signalingDrops = Number(callSnapshot?.recentWindow?.signalingDrops || 0)
    + Number(callSnapshot?.recentWindow?.groupSignalingDrops || 0);
  const issues = [];

  if (!turnConfigured) {
    issues.push('TURN не настроен');
  }
  if (!livekitConfigured) {
    issues.push('LiveKit/SFU не настроен');
  }
  if (staleRingingCalls > 0) {
    issues.push(`зависшие ringing-call: ${staleRingingCalls}`);
  }
  if (signalingDrops > 0) {
    issues.push(`есть потери signaling: ${signalingDrops}`);
  }

  return {
    ok: issues.length === 0,
    action: 'check_calls_health',
    responseText: [
      issues.length > 0
        ? `По звонкам есть риски: ${issues.join('; ')}.`
        : 'По звонкам критичных рисков по текущим метрикам не видно.',
      `Активных личных звонков: ${activePrivateCalls}, групповых: ${activeGroupCallCount}.`,
      `TURN: ${turnConfigured ? 'настроен' : 'не настроен'}, LiveKit/SFU: ${livekitConfigured ? 'настроен' : 'не настроен'}.`,
      `За окно диагностики signaling drops: ${signalingDrops}, livekit token errors: ${callSnapshot?.recentWindow?.livekitTokenErrors || 0}.`
    ].join(' '),
    data: {
      activePrivateCalls,
      activeGroupCalls: activeGroupCallCount,
      turnConfigured,
      livekitConfigured,
      staleRingingCalls,
      callSnapshot,
      issues
    }
  };
}

async function explainIssueToolLegacy({ params }) {
  const issue = String(params?.issue || 'наблюдается неполадка').trim();
  const diagnostics = params?.diagnostics || {};
  const requestAnalysis = params?.requestAnalysis || {};
  const realtimeHealth = params?.realtimeHealth || {};
  const callsHealth = params?.callsHealth || {};
  const causes = [];
  const recommendations = [];

  if (String(diagnostics?.mongoState || '') && diagnostics.mongoState !== 'connected') {
    causes.push(`база данных нестабильна: MongoDB сейчас в состоянии ${diagnostics.mongoState}`);
    recommendations.push('сначала восстановить MongoDB и проверить задержку базы');
  } else if (Number(diagnostics?.mongoLatencyMs || 0) > 250) {
    causes.push(`MongoDB отвечает медленно: ${diagnostics.mongoLatencyMs} ms`);
    recommendations.push('проверить медленные запросы к MongoDB и нагрузку на backend');
  }

  if (Number(diagnostics?.eventLoop?.p95Ms || 0) > 80 || Number(diagnostics?.eventLoop?.maxMs || 0) > 150) {
    causes.push('Node.js упирается в event loop и начинает тормозить под нагрузкой');
    recommendations.push('снять профилирование CPU и проверить тяжелые синхронные участки');
  }

  if (Array.isArray(requestAnalysis?.hotspots) && requestAnalysis.hotspots.some((route) => Number(route.slowCount || 0) > 0)) {
    const worstRoute = requestAnalysis.hotspots[0];
    causes.push(`есть медленный API-маршрут ${worstRoute?.routeKey || 'unknown'} с max ${worstRoute?.maxDurationMs || '?'} ms`);
    recommendations.push('разобрать самый медленный маршрут и его зависимости');
  }

  if (Number(requestAnalysis?.errorRequests || 0) > 0) {
    causes.push(`в свежих логах есть серверные ошибки: ${requestAnalysis.errorRequests}`);
    recommendations.push('проверить 5xx-ошибки и корреляцию с медленными запросами');
  }

  if (Number(realtimeHealth?.recentWindow?.reconnects || 0) >= 3) {
    causes.push(`realtime нестабилен: reconnect ${realtimeHealth.recentWindow.reconnects} за окно диагностики`);
    recommendations.push('проверить сеть, балансировщик и таймауты socket.io');
  }

  if (Number(realtimeHealth?.recentWindow?.droppedEvents || 0) > 0) {
    causes.push(`часть realtime-событий теряется: ${realtimeHealth.recentWindow.droppedEvents}`);
    recommendations.push('проверить офлайн-доставку и причины потери сокетов');
  }

  if (callsHealth?.turnConfigured === false) {
    causes.push('TURN не настроен, поэтому медиа может деградировать за NAT и мобильными сетями');
    recommendations.push('настроить TURN и проверить выдачу ICE-конфига');
  }

  if (callsHealth?.livekitConfigured === false) {
    causes.push('LiveKit/SFU не настроен, поэтому групповые и медиасценарии ограничены инфраструктурно');
    recommendations.push('проверить LIVEKIT_API_KEY и LIVEKIT_API_SECRET');
  }

  if (Number(callsHealth?.staleRingingCalls || 0) > 0) {
    causes.push(`есть зависшие звонки в ringing: ${callsHealth.staleRingingCalls}`);
    recommendations.push('почистить stale calls и проверить signaling flow');
  }

  const primaryCause = causes[0] || 'по текущим данным явной одной причины не видно';
  const forecast = buildIssueForecast(causes);

  return {
    ok: causes.length === 0,
    action: 'explain_issue',
    responseText: [
      `По запросу "${issue}" наиболее вероятная причина: ${primaryCause}.`,
      causes.length > 1 ? `Дополнительно видно: ${causes.slice(1, 3).join('; ')}.` : null,
      recommendations.length > 0
        ? `Что делать дальше: ${recommendations.slice(0, 3).map((item, index) => `${index + 1}) ${item}`).join(' ')}.`
        : 'Что делать дальше: сначала собрать больше диагностики по моменту деградации.',
      `Риск: ${forecast}`
    ].filter(Boolean).join(' '),
    data: {
      issue,
      causes,
      recommendations,
      forecast
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

function countSocketConnectionsSafe(userSockets) {
  let socketConnections = 0;
  userSockets?.forEach?.((socketIds) => {
    socketConnections += socketIds?.size || 0;
  });
  return socketConnections;
}

async function measureMongoPingLatencyMs() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db?.admin) {
    return null;
  }

  const startedAt = process.hrtime.bigint();
  await mongoose.connection.db.admin().ping();
  return Number(process.hrtime.bigint() - startedAt) / 1e6;
}

function appendIfTruthy(items, value) {
  if (value) {
    items.push(value);
  }
}

async function systemDiagnosticsTool({ app }) {
  const { userSockets, activeCalls, activeGroupCalls } = getSocketState(app);
  const socketConnections = countSocketConnectionsSafe(userSockets);
  const mongoState = toMongoState(mongoose.connection.readyState);
  const openRouterConfigured = Boolean(getOpenRouterApiKey());
  const activePrivateCalls = activeCalls?.size || 0;
  const activeGroupCallCount = activeGroupCalls?.size || 0;
  const system = getSystemSnapshot();

  let mongoLatencyMs = null;
  let mongoLatencyError = null;
  try {
    mongoLatencyMs = await measureMongoPingLatencyMs();
  } catch (error) {
    mongoLatencyError = error?.message || 'mongo_ping_failed';
  }

  const eventLoopP95Ms = Number(system?.eventLoop?.p95Ms || 0);
  const heapUsedMb = Number(system?.memory?.heapUsedMb || 0);
  const heapTotalMb = Number(system?.memory?.heapTotalMb || 0);
  const memoryPressurePercent = heapTotalMb > 0
    ? Math.round((heapUsedMb / heapTotalMb) * 100)
    : null;

  const warnings = [];
  appendIfTruthy(warnings, mongoState !== 'connected' ? `MongoDB сейчас в состоянии ${mongoState}.` : null);
  appendIfTruthy(warnings, mongoLatencyMs !== null && mongoLatencyMs >= 250 ? `Ping до MongoDB повышен: ${Math.round(mongoLatencyMs)} мс.` : null);
  appendIfTruthy(warnings, eventLoopP95Ms >= 120 ? `Event loop проседает: p95 около ${Math.round(eventLoopP95Ms)} мс.` : null);
  appendIfTruthy(warnings, memoryPressurePercent !== null && memoryPressurePercent >= 82 ? `Heap загружен примерно на ${memoryPressurePercent}%.` : null);

  return {
    ok: warnings.length === 0 && mongoState === 'connected',
    action: 'system_diagnostics',
    responseText: [
      warnings.length > 0
        ? 'Есть сигналы деградации на серверной стороне.'
        : 'Критичных сигналов по базовой системной диагностике не видно.',
      `CPU user/system: ${system.cpu.userMs || 0}/${system.cpu.systemMs || 0} мс.`,
      `Память: heap ${system.memory.heapUsedMb || 0}/${system.memory.heapTotalMb || 0} МБ, rss ${system.memory.rssMb || 0} МБ.`,
      `Event loop p95: ${system.eventLoop.p95Ms ?? 'n/a'} мс.`,
      `MongoDB: ${mongoState}${mongoLatencyMs !== null ? `, ping ${Math.round(mongoLatencyMs)} мс` : ''}.`,
      `Онлайн пользователей: ${userSockets?.size || 0}, socket-соединений: ${socketConnections}.`,
      `Активных личных звонков: ${activePrivateCalls}, групповых звонков: ${activeGroupCallCount}.`,
      `OpenRouter: ${openRouterConfigured ? 'настроен' : 'не настроен'}.`,
      `TURN: ${config.TURN_SECRET ? 'настроен' : 'не настроен'}.`
    ].join(' '),
    data: {
      mongoState,
      mongoLatencyMs: mongoLatencyMs === null ? null : Math.round(mongoLatencyMs),
      mongoLatencyError,
      onlineUsers: userSockets?.size || 0,
      socketConnections,
      activePrivateCalls,
      activeGroupCalls: activeGroupCallCount,
      openRouterConfigured,
      turnConfigured: Boolean(config.TURN_SECRET),
      system,
      memoryPressurePercent,
      warnings
    }
  };
}

async function analyzeSlowRequestsTool() {
  const requestSnapshot = getSlowRequestSnapshot(5);
  const slowRoutes = requestSnapshot.topRoutes || [];
  const recentErrors = requestSnapshot.recentErrors || [];
  const aiSlowActions = await AiLog.find({
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  })
    .sort({ duration: -1, createdAt: -1 })
    .limit(5)
    .select('action duration success error createdAt')
    .lean();

  return {
    ok: slowRoutes.length === 0 && recentErrors.length === 0,
    action: 'analyze_slow_requests',
    responseText: [
      slowRoutes.length > 0
        ? `Самые тяжёлые маршруты: ${slowRoutes.map((route) => `${route.routeKey} avg ${route.avgDurationMs} мс, max ${route.maxDurationMs} мс`).join('; ')}.`
        : 'Пока нет накопленной HTTP-статистики по медленным маршрутам.',
      recentErrors.length > 0
        ? `Недавние backend-ошибки: ${recentErrors.map((entry) => `${entry.routeKey} -> ${entry.status}`).join('; ')}.`
        : 'Свежих 5xx по собранной выборке не видно.',
      aiSlowActions.length > 0
        ? `Медленные AI-шаги за сутки: ${aiSlowActions.map((entry) => `${entry.action} ${Math.round(Number(entry.duration || 0))} мс${entry.success ? '' : ' с ошибкой'}`).join('; ')}.`
        : 'Существенно медленных AI-шагов за сутки не видно.'
    ].join(' '),
    data: {
      thresholdMs: requestSnapshot.thresholdMs || REQUEST_SLOW_THRESHOLD_MS,
      totalRequests: requestSnapshot.totalRequests || 0,
      errorRequests: requestSnapshot.errorRequests || 0,
      slowRoutes,
      recentErrors,
      aiSlowActions: aiSlowActions.map((entry) => ({
        action: entry.action,
        durationMs: Math.round(Number(entry.duration || 0)),
        success: Boolean(entry.success),
        error: entry.error || null,
        createdAt: entry.createdAt
      }))
    }
  };
}

async function checkRealtimeHealthTool({ app }) {
  const { userSockets } = getSocketState(app);
  const snapshot = getRealtimeSnapshot({
    activeUsers: userSockets?.size || 0,
    socketConnections: countSocketConnectionsSafe(userSockets)
  });
  const reconnects = Number(snapshot?.recentWindow?.reconnects || 0);
  const disconnects = Number(snapshot?.recentWindow?.disconnects || 0);
  const droppedEvents = Number(snapshot?.recentWindow?.droppedEvents || 0);
  const warnings = [];

  appendIfTruthy(warnings, reconnects >= 5 ? `Есть повышенные переподключения сокетов: ${reconnects} за последнее окно.` : null);
  appendIfTruthy(warnings, droppedEvents > 0 ? `Есть потерянные realtime-события: ${droppedEvents}.` : null);
  appendIfTruthy(warnings, disconnects >= 10 ? `Недавних disconnect слишком много: ${disconnects}.` : null);

  return {
    ok: warnings.length === 0,
    action: 'check_realtime_health',
    responseText: [
      warnings.length > 0 ? 'Realtime выглядит нестабильно.' : 'По realtime критичной деградации не видно.',
      `Активных пользователей: ${snapshot.activeUsers}.`,
      `Socket-соединений: ${snapshot.socketConnections}.`,
      `Недавние reconnect: ${reconnects}, disconnect: ${disconnects}, dropped events: ${droppedEvents}.`,
      snapshot.counters.activeSocketLeakWarnings > 0
        ? `Были предупреждения о возможных socket leak: ${snapshot.counters.activeSocketLeakWarnings}.`
        : 'Признаков socket leak по текущим предупреждениям нет.'
    ].join(' '),
    data: snapshot
  };
}

async function checkCallsHealthTool({ app }) {
  const { activeCalls, activeGroupCalls, activeGroupCallStreams } = getSocketState(app);
  const activeCallDocs = await Call.find({ status: { $in: ['ringing', 'active'] } })
    .select('_id chat status type participants startedAt')
    .sort({ startedAt: -1 })
    .limit(20)
    .lean();
  const metrics = getCallSnapshot();
  const longRingingCalls = activeCallDocs.filter((call) => (
    String(call.status || '') === 'ringing'
    && Date.now() - new Date(call.startedAt || Date.now()).getTime() > 45 * 1000
  )).length;
  const warnings = [];
  const groupCallCount = activeGroupCalls?.size || 0;
  const groupStreamCount = activeGroupCallStreams?.size || 0;

  appendIfTruthy(warnings, !config.TURN_SECRET ? 'TURN не настроен.' : null);
  appendIfTruthy(warnings, !(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET) ? 'LiveKit credentials не настроены.' : null);
  appendIfTruthy(warnings, longRingingCalls > 0 ? `Есть звонки, которые слишком долго висят в ringing: ${longRingingCalls}.` : null);
  appendIfTruthy(warnings, groupCallCount > 0 && groupStreamCount === 0 ? 'Есть групповые звонки без активных SFU stream map.' : null);
  appendIfTruthy(
    warnings,
    Number(metrics?.recentWindow?.signalingDrops || 0) > 0 || Number(metrics?.recentWindow?.groupSignalingDrops || 0) > 0
      ? 'Зафиксированы потери signaling-событий.'
      : null
  );

  return {
    ok: warnings.length === 0,
    action: 'check_calls_health',
    responseText: [
      warnings.length > 0 ? 'По подсистеме звонков есть сигналы риска.' : 'Критичных симптомов по звонкам сейчас не видно.',
      `Активных private calls: ${activeCalls?.size || 0}, group calls: ${groupCallCount}.`,
      `Активных SFU stream maps: ${groupStreamCount}.`,
      `TURN: ${config.TURN_SECRET ? 'настроен' : 'не настроен'}.`,
      `LiveKit: ${process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET ? 'настроен' : 'не настроен'}.`,
      `Недавние signaling drops: ${metrics.recentWindow.signalingDrops || 0}, group signaling drops: ${metrics.recentWindow.groupSignalingDrops || 0}, token errors: ${metrics.recentWindow.livekitTokenErrors || 0}.`
    ].join(' '),
    data: {
      activePrivateCalls: activeCalls?.size || 0,
      activeGroupCalls: groupCallCount,
      activeGroupCallStreams: groupStreamCount,
      turnConfigured: Boolean(config.TURN_SECRET),
      livekitConfigured: Boolean(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET),
      longRingingCalls,
      warnings,
      metrics
    }
  };
}

function buildExplainIssueSummary({ diagnostics, requestAnalysis, realtimeHealth, callsHealth }) {
  const causes = [];
  const evidence = [];
  const actions = [];
  const forecast = [];

  if (diagnostics?.mongoState && diagnostics.mongoState !== 'connected') {
    causes.push('основной риск сейчас в MongoDB');
    evidence.push(`MongoDB в состоянии ${diagnostics.mongoState}`);
    actions.push('проверить доступность MongoDB и latency на ping');
  }

  if (Number(diagnostics?.mongoLatencyMs || 0) >= 250) {
    causes.push('база отвечает с повышенной задержкой');
    evidence.push(`ping MongoDB около ${diagnostics.mongoLatencyMs} мс`);
    actions.push('разобрать нагрузку на MongoDB и медленные запросы');
  }

  if (Number(diagnostics?.system?.eventLoop?.p95Ms || 0) >= 120) {
    causes.push('Node.js перегружен по event loop');
    evidence.push(`event loop p95 около ${diagnostics.system.eventLoop.p95Ms} мс`);
    actions.push('снять тяжёлые синхронные операции и проверить нагрузку на backend');
    forecast.push('если нагрузка сохранится, начнутся задержки сообщений и звонков');
  }

  if (Array.isArray(requestAnalysis?.slowRoutes) && requestAnalysis.slowRoutes.length > 0) {
    const topRoute = requestAnalysis.slowRoutes[0];
    causes.push('есть медленные backend-маршруты');
    evidence.push(`${topRoute.routeKey} avg ${topRoute.avgDurationMs} мс`);
    actions.push('посмотреть самый медленный маршрут и его зависимости');
  }

  if (Number(realtimeHealth?.recentWindow?.reconnects || 0) >= 5) {
    causes.push('realtime страдает из-за переподключений');
    evidence.push(`reconnect ${realtimeHealth.recentWindow.reconnects} за окно`);
    actions.push('проверить стабильность socket.io и сеть между клиентами и backend');
  }

  if (Number(realtimeHealth?.recentWindow?.droppedEvents || 0) > 0) {
    causes.push('часть realtime-событий теряется');
    evidence.push(`dropped events ${realtimeHealth.recentWindow.droppedEvents}`);
    actions.push('проверить недоставленные signaling/realtime события');
  }

  if (Array.isArray(callsHealth?.warnings) && callsHealth.warnings.length > 0) {
    causes.push('в подсистеме звонков есть инфраструктурные риски');
    evidence.push(callsHealth.warnings[0]);
    actions.push('проверить TURN/LiveKit и долгие ringing calls');
    forecast.push('при росте нагрузки вероятны лаги звонков и обрывы медиапотока');
  }

  if (causes.length === 0) {
    causes.push('явной серверной аварии по собранным данным нет');
    evidence.push('базовая диагностика без критических отклонений');
    actions.push('проверить клиентскую сеть, устройство и повторить диагностику в момент проблемы');
  }

  return {
    causes,
    evidence,
    actions: Array.from(new Set(actions)),
    forecast: Array.from(new Set(forecast))
  };
}

async function explainIssueTool({ params }) {
  const diagnostics = params?.diagnostics && typeof params.diagnostics === 'object' ? params.diagnostics : {};
  const requestAnalysis = params?.requestAnalysis && typeof params.requestAnalysis === 'object' ? params.requestAnalysis : {};
  const realtimeHealth = params?.realtimeHealth && typeof params.realtimeHealth === 'object' ? params.realtimeHealth : {};
  const callsHealth = params?.callsHealth && typeof params.callsHealth === 'object' ? params.callsHealth : {};
  const summary = buildExplainIssueSummary({
    diagnostics,
    requestAnalysis,
    realtimeHealth,
    callsHealth
  });

  const explanation = `Похоже, что ${summary.causes[0]}.`;
  const evidence = summary.evidence.length > 0
    ? `Почему я так думаю: ${summary.evidence.join('; ')}.`
    : '';
  const nextActions = summary.actions.length > 0
    ? `Что делать сейчас: ${summary.actions.slice(0, 3).map((item, index) => `${index + 1}) ${item}`).join(' ')}.`
    : '';
  const forecast = summary.forecast.length > 0
    ? `Риск дальше: ${summary.forecast[0]}.`
    : '';
  const offer = 'Если нужно, я могу отдельно сфокусироваться на realtime или на звонках и сузить причину.';

  return {
    ok: true,
    action: 'explain_issue',
    responseText: [explanation, evidence, nextActions, forecast, offer].filter(Boolean).join(' '),
    data: {
      diagnostics,
      requestAnalysis,
      realtimeHealth,
      callsHealth,
      summary
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
  const target = params?.chatId
    ? null
    : await resolveUserOrThrow({
      params,
      actorUserId: actor._id,
      purpose: 'start_call'
    });

  const result = await startPrivateCallFlow({
    app,
    fromUserId: actor._id,
    toUserId: target?.userId || params?.userId || null,
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
  find_user: findUserTool,
  get_server_status: getServerStatusTool,
  system_diagnostics: systemDiagnosticsTool,
  analyze_slow_requests: analyzeSlowRequestsTool,
  check_realtime_health: checkRealtimeHealthTool,
  check_calls_health: checkCallsHealthTool,
  explain_issue: explainIssueTool,
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
        responseText: loggedAction.responseText || 'Готово. Действие выполнено.',
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
  const failureCode = failedStep?.error?.code || 'AI_MULTI_STEP_FAILED';
  const failureMessage = failedStep?.error?.message || 'Действие остановлено.';
  return {
    ok: !failedStep,
    partial: Boolean(failedStep),
    stopExecution: Boolean(failedStep),
    error: failedStep ? failureCode : null,
    action: normalizedActions.length === 1
      ? (lastStep?.action || failedStep?.action || 'unknown')
      : 'multi_step',
    responseText: failedStep
      ? failureMessage
      : (lastStep?.result?.responseText || 'Готово. Действие выполнено.'),
    data: {
      steps: sequenceState.steps.map((step, index) => ({
        stepIndex: index,
        action: step.action,
        params: step.params,
        data: step.result?.data || null
      })),
      planId: planId ? String(planId) : null,
      stopExecution: Boolean(failedStep),
      failedStep: failedStep ? {
        stepIndex: failedStep.index,
        action: failedStep.action,
        params: failedStep.params,
        error: failureMessage,
        code: failureCode
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
      error.stopExecution = true;
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
    responseText: lastStep?.result?.responseText || 'Готово. Действие выполнено.',
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
