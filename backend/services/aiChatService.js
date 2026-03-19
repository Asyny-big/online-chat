const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const AiPendingAction = require('../models/AiPendingAction');
const { buildLastMessagePayload } = require('./messageStateService');
const { formatChatForUser } = require('../social/services/chatService');
const { generateAiResponse, getAiSystemPrompt } = require('./aiService');
const { parseAiAction } = require('./aiActionParser');
const { executeAiPlan } = require('./aiActionExecutor');
const { AI_TOOLS, getAiToolProgressText, planRequiresConfirmation } = require('./aiTools');
const { getMemory, buildMemoryPrompt, rememberUserMessage } = require('./aiMemoryService');
const { resolveFallbackAiPlan, resolveSupportShortcut } = require('./aiIntentService');

const AI_BOT_SYSTEM_KEY = 'ai-bot';
const AI_BOT_NAME = 'Поддержка GovChat';
const AI_CHAT_TITLE = 'Поддержка';
const AI_WELCOME_TEXT = 'Привет! Я помощник GovChat. Могу подсказать по сообщениям, звонкам, вложениям и основным функциям приложения.';
const AI_UNAVAILABLE_TEXT = 'Сейчас поддержка временно недоступна. Попробуйте написать чуть позже.';
const AI_BOT_PHONE = String(process.env.AI_BOT_PHONE || '+79990000001').trim();
const AI_BOT_AVATAR_URL = String(process.env.AI_BOT_AVATAR_URL || '/uploads/avatar-default.png').trim();
const AI_MESSAGE_MAX_LENGTH = Math.max(Number(process.env.AI_CHAT_MAX_INPUT_LENGTH || 2000), 1);
const AI_RATE_LIMIT_WINDOW_MS = Math.max(Number(process.env.AI_CHAT_RATE_LIMIT_MS || 1000), 250);
const AI_USER_RATE_LIMIT_WINDOW_MS = Math.max(
  Number(process.env.AI_CHAT_USER_RATE_LIMIT_MS || AI_RATE_LIMIT_WINDOW_MS),
  AI_RATE_LIMIT_WINDOW_MS
);
const AI_CONTEXT_LIMIT = Math.max(Number(process.env.AI_CHAT_CONTEXT_LIMIT || 10), 1);
const AI_CONTEXT_MAX_CHARS = Math.max(Number(process.env.AI_CHAT_CONTEXT_MAX_CHARS || 4000), 500);
const AI_CONTEXT_SCAN_LIMIT = Math.max(
  Number(process.env.AI_CHAT_CONTEXT_SCAN_LIMIT || Math.max(AI_CONTEXT_LIMIT * 3, 30)),
  AI_CONTEXT_LIMIT
);
const AI_QUEUE_TIMEOUT_MS = Math.max(Number(process.env.AI_CHAT_QUEUE_TIMEOUT_MS || 30000), 5000);
const AI_QUEUE_IDLE_TTL_MS = Math.max(
  Number(process.env.AI_CHAT_QUEUE_IDLE_TTL_MS || Math.max(AI_QUEUE_TIMEOUT_MS * 2, 120000)),
  AI_QUEUE_TIMEOUT_MS
);
const AI_CLEANUP_INTERVAL_MS = Math.max(Number(process.env.AI_CHAT_CLEANUP_INTERVAL_MS || 60000), 10000);
const AI_STATE_TTL_MS = Math.max(
  Number(process.env.AI_CHAT_STATE_TTL_MS || Math.max(AI_QUEUE_IDLE_TTL_MS, 300000)),
  AI_QUEUE_IDLE_TTL_MS
);
const AI_MAX_PARALLEL_RESPONSES = Math.max(Number(process.env.AI_CHAT_MAX_PARALLEL_RESPONSES || 8), 1);
const AI_MAX_PENDING_RESPONSES_PER_CHAT = Math.max(Number(process.env.AI_CHAT_MAX_PENDING_PER_CHAT || 20), 1);
const AI_CONFIRMATION_TTL_MS = Math.max(Number(process.env.AI_CONFIRMATION_TTL_MS || 10 * 60 * 1000), 60 * 1000);
const AI_QUEUE_WATCHDOG_MS = Math.max(
  Number(process.env.AI_CHAT_QUEUE_WATCHDOG_MS || Math.max(AI_QUEUE_TIMEOUT_MS * 2, 60_000)),
  AI_QUEUE_TIMEOUT_MS
);
const AI_QUEUE_RECOVERY_BATCH_SIZE = Math.max(
  Number(process.env.AI_CHAT_QUEUE_RECOVERY_BATCH_SIZE || Math.max(AI_MAX_PENDING_RESPONSES_PER_CHAT * 2, 50)),
  AI_MAX_PENDING_RESPONSES_PER_CHAT
);
const SYSTEM_PASSWORD_HASH = bcrypt.hashSync(`system:${AI_BOT_SYSTEM_KEY}:govchat`, 10);

const messageCooldownByUser = new Map();
const messageCooldownByUserChat = new Map();
const responseQueueByChat = new Map();

let activeAiJobs = 0;
const aiConcurrencyWaiters = [];

function normalizePhone(phone) {
  return String(phone || '').replace(/[\s\-()]/g, '');
}

function createAppFacade({ io, userSockets, activeCalls, activeGroupCalls }) {
  return {
    get(key) {
      if (key === 'io') return io;
      if (key === 'socketData') {
        return { userSockets, activeCalls, activeGroupCalls };
      }
      return undefined;
    }
  };
}

function getSocketHelpers(app) {
  const io = app?.get?.('io');
  const socketData = app?.get?.('socketData');
  const userSockets = socketData?.userSockets;
  return { io, userSockets };
}

function touchState(store, key, now = Date.now()) {
  store.set(String(key), { lastSeenAt: now });
}

function compareMessageIds(left, right) {
  const a = String(left || '').trim();
  const b = String(right || '').trim();
  if (!a || !b) return 0;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function getProcessingStartedAtMs(aiState) {
  const rawValue = aiState?.processingStartedAt;
  const value = rawValue ? new Date(rawValue).getTime() : 0;
  return Number.isFinite(value) ? value : 0;
}

function isProcessingLockStale(aiState, now = Date.now()) {
  if (!aiState?.processingMessageId) return false;
  const startedAtMs = getProcessingStartedAtMs(aiState);
  if (!startedAtMs) return true;
  return now - startedAtMs >= AI_QUEUE_WATCHDOG_MS;
}

function buildStaleProcessingQuery() {
  return {
    $or: [
      { 'aiState.processingStartedAt': null },
      { 'aiState.processingStartedAt': { $lte: new Date(Date.now() - AI_QUEUE_WATCHDOG_MS) } }
    ]
  };
}

function getOrCreateQueueState({ app, chatId }) {
  const key = String(chatId);
  const now = Date.now();
  let state = responseQueueByChat.get(key);

  if (!state) {
    state = {
      app,
      chatId: key,
      running: false,
      queue: [],
      queuedIds: new Set(),
      promise: null,
      lastTouchedAt: now,
      recoveryRequired: false
    };
    responseQueueByChat.set(key, state);
  }

  state.app = app;
  state.lastTouchedAt = now;
  return state;
}

function enqueueQueuedMessage(state, messageId) {
  const normalizedMessageId = String(messageId || '').trim();
  if (!normalizedMessageId) return false;
  if (state.queuedIds.has(normalizedMessageId)) return false;

  if (state.queue.length >= AI_MAX_PENDING_RESPONSES_PER_CHAT) {
    state.recoveryRequired = true;
    return false;
  }

  state.queue.push(normalizedMessageId);
  state.queuedIds.add(normalizedMessageId);
  state.lastTouchedAt = Date.now();
  return true;
}

function cleanupVolatileState() {
  const now = Date.now();

  for (const [key, state] of messageCooldownByUser.entries()) {
    if (!state?.lastSeenAt || now - state.lastSeenAt > AI_STATE_TTL_MS) {
      messageCooldownByUser.delete(key);
    }
  }

  for (const [key, state] of messageCooldownByUserChat.entries()) {
    if (!state?.lastSeenAt || now - state.lastSeenAt > AI_STATE_TTL_MS) {
      messageCooldownByUserChat.delete(key);
    }
  }

  for (const [key, state] of responseQueueByChat.entries()) {
    if (state?.running) continue;
    if (now - Number(state?.lastTouchedAt || 0) > AI_QUEUE_IDLE_TTL_MS) {
      responseQueueByChat.delete(key);
    }
  }
}

const cleanupIntervalHandle = setInterval(cleanupVolatileState, AI_CLEANUP_INTERVAL_MS);
cleanupIntervalHandle.unref?.();

function createAbortError(message, code = 'AI_ABORTED') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      reject(createAbortError('AI delay aborted', 'AI_DELAY_ABORTED'));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

async function withAiConcurrencyLimit(task) {
  if (activeAiJobs >= AI_MAX_PARALLEL_RESPONSES) {
    await new Promise((resolve) => {
      aiConcurrencyWaiters.push(resolve);
    });
  }

  activeAiJobs += 1;

  try {
    return await task();
  } finally {
    activeAiJobs = Math.max(activeAiJobs - 1, 0);
    const next = aiConcurrencyWaiters.shift();
    if (next) {
      next();
    }
  }
}

function buildAttachmentPlaceholder(messageType) {
  const attachmentDescriptions = {
    image: '[image]',
    video: '[video]',
    audio: '[audio]',
    voice: '[voice]',
    video_note: '[video note]',
    file: '[file]'
  };

  return attachmentDescriptions[messageType] || '[message]';
}

function toContextEntry(message, aiBotId) {
  const role = String(message.sender) === String(aiBotId) ? 'assistant' : 'user';
  const messageType = String(message.type || 'text').toLowerCase();
  const text = String(message.text || '').trim();
  const content = text || buildAttachmentPlaceholder(messageType);

  return {
    messageId: String(message._id),
    role,
    content
  };
}

async function ensureAiBotUser() {
  try {
    return await User.findOneAndUpdate(
      { systemKey: AI_BOT_SYSTEM_KEY },
      {
        $set: {
          name: AI_BOT_NAME,
          phone: AI_BOT_PHONE,
          phoneNormalized: normalizePhone(AI_BOT_PHONE),
          avatarUrl: AI_BOT_AVATAR_URL,
          isSystem: true,
          systemKey: AI_BOT_SYSTEM_KEY,
          status: 'online'
        },
        $setOnInsert: {
          passwordHash: SYSTEM_PASSWORD_HASH
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );
  } catch (error) {
    if (error?.code === 11000) {
      return User.findOne({ systemKey: AI_BOT_SYSTEM_KEY });
    }
    throw error;
  }
}

async function ensureAiWelcomeMessage(chatId, aiBotId) {
  const existing = await Message.findOne({
    chat: chatId,
    sender: aiBotId,
    'systemEvent.type': 'ai_welcome'
  }).select('_id');
  if (existing) return existing;

  const message = await Message.create({
    chat: chatId,
    sender: aiBotId,
    type: 'text',
    text: AI_WELCOME_TEXT,
    systemEvent: { type: 'ai_welcome' },
    readBy: [{ user: aiBotId }]
  });

  await message.populate('sender', 'name phone avatarUrl isSystem systemKey');
  await Chat.findByIdAndUpdate(chatId, {
    $set: {
      lastMessage: buildLastMessagePayload(message),
      updatedAt: message.createdAt
    }
  });

  return message;
}

async function ensureSupportChatForUser({ app, userId }) {
  const aiBot = await ensureAiBotUser();
  const { chat } = await Chat.findOrCreatePrivateChat(userId, aiBot._id);

  if (!chat.isAiChat || !chat.isSystemChat || chat.systemChatKey !== AI_BOT_SYSTEM_KEY || chat.name !== AI_CHAT_TITLE) {
    chat.isAiChat = true;
    chat.isSystemChat = true;
    chat.systemChatKey = AI_BOT_SYSTEM_KEY;
    chat.name = AI_CHAT_TITLE;
    await chat.save();
  }

  await ensureAiWelcomeMessage(chat._id, aiBot._id);
  await chat.populate('participants.user', 'name phone avatarUrl status lastSeen isSystem systemKey');

  return { chat, aiBot };
}

function emitChatCreatedToUser({ app, userId, chat }) {
  const { io, userSockets } = getSocketHelpers(app);
  if (!io || !userSockets?.has?.(String(userId))) return;

  const payload = formatChatForUser({
    app,
    chat,
    viewerUserId: userId
  });

  userSockets.get(String(userId)).forEach((socketId) => {
    io.to(socketId).emit('chat:new', payload);
    io.to(socketId).emit('chat:created', { chat: payload, created: true });
    io.to(socketId).emit('new_chat', payload);
  });
}

function checkAiRateLimit({ userId, chatId }) {
  const userKey = String(userId);
  const chatKey = `${String(userId)}:${String(chatId)}`;
  const now = Date.now();
  const lastUserRequestAt = Number(messageCooldownByUser.get(userKey)?.lastSeenAt || 0);
  const lastChatRequestAt = Number(messageCooldownByUserChat.get(chatKey)?.lastSeenAt || 0);

  if (lastUserRequestAt && now - lastUserRequestAt < AI_USER_RATE_LIMIT_WINDOW_MS) {
    return false;
  }

  if (lastChatRequestAt && now - lastChatRequestAt < AI_RATE_LIMIT_WINDOW_MS) {
    return false;
  }

  touchState(messageCooldownByUser, userKey, now);
  touchState(messageCooldownByUserChat, chatKey, now);
  return true;
}

function ensureAiTextLimit(text) {
  const normalized = String(text || '').trim();
  if (normalized.length <= AI_MESSAGE_MAX_LENGTH) return normalized;

  const error = new Error(`Сообщение слишком длинное. Лимит для поддержки: ${AI_MESSAGE_MAX_LENGTH} символов.`);
  error.code = 'AI_CHAT_MESSAGE_TOO_LONG';
  throw error;
}

function emitAiTyping(io, chatId, aiBot, isTyping) {
  if (!io || !chatId || !aiBot?._id) return;

  io.to(`chat:${chatId}`).emit('typing:update', {
    chatId: String(chatId),
    userId: String(aiBot._id),
    userName: aiBot.name,
    isTyping
  });
}

async function buildAiContext({ chatId, aiBotId, upToMessageId }) {
  const query = {
    chat: chatId,
    deleted: { $ne: true }
  };

  if (mongoose.Types.ObjectId.isValid(String(upToMessageId || ''))) {
    query._id = { $lte: upToMessageId };
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(AI_CONTEXT_SCAN_LIMIT)
    .lean();

  const selected = [];
  let totalChars = 0;

  for (const message of messages) {
    const entry = toContextEntry(message, aiBotId);
    const contentLength = entry.content.length;
    const nextCount = selected.length + 1;
    const nextTotalChars = totalChars + contentLength;

    if (nextCount > AI_CONTEXT_LIMIT) break;
    if (selected.length > 0 && nextTotalChars > AI_CONTEXT_MAX_CHARS) break;

    selected.push(entry);
    totalChars = nextTotalChars;
  }

  return selected.reverse();
}

function normalizeAiReply(text) {
  const normalized = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return normalized.slice(0, 4000) || AI_UNAVAILABLE_TEXT;
}

function resolveAiMessageStage({ systemType, systemStage, text }) {
  const normalizedStage = String(systemStage || '').trim().toLowerCase();
  if (normalizedStage === 'progress' || normalizedStage === 'final') {
    return normalizedStage;
  }

  const normalizedText = String(text || '').trim();
  if (
    /^Выполняю\s+несколько\s+действий/i.test(normalizedText)
    || /^Шаг\s+\d+\/\d+\s+выполнен/i.test(normalizedText)
    || /^Ошибка\s+на\s+шаге/i.test(normalizedText)
  ) {
    return 'progress';
  }

  const normalizedType = String(systemType || '').trim().toLowerCase();
  if (normalizedType && normalizedType !== 'ai_response' && normalizedType !== 'ai_confirmation') {
    return 'final';
  }

  return 'final';
}

function buildAiSystemPromptWithMemory(memory) {
  const memoryPrompt = buildMemoryPrompt(memory);
  if (!memoryPrompt) {
    return getAiSystemPrompt();
  }

  return `${getAiSystemPrompt()} Память о пользователе: ${memoryPrompt}`;
}

async function findExistingAiTerminalMessage({ chatId, aiBotId, sourceMessageId }) {
  if (!mongoose.Types.ObjectId.isValid(String(sourceMessageId || ''))) {
    return null;
  }

  return Message.findOne({
    chat: chatId,
    sender: aiBotId,
    'systemEvent.sourceMessageId': sourceMessageId,
    $or: [
      {
        'systemEvent.type': 'ai_response',
        'systemEvent.stage': 'final'
      },
      {
        'systemEvent.type': 'ai_confirmation',
        'systemEvent.stage': 'final'
      },
      {
        'systemEvent.type': 'ai_unavailable',
        'systemEvent.stage': 'final'
      }
    ]
  })
    .select('_id')
    .lean();
}

function toActionPlan(parsed) {
  if (!parsed) return null;

  if (parsed.type === 'actions' && Array.isArray(parsed.actions) && parsed.actions.length > 0) {
    const actions = parsed.actions
      .map((step) => ({
        action: String(step?.action || '').trim(),
        params: step?.params || {}
      }))
      .filter((step) => step.action && AI_TOOLS[step.action]);

    return actions.length === parsed.actions.length
      ? actions
      : null;
  }

  if (parsed.type === 'action' && parsed.action && AI_TOOLS[String(parsed.action).trim()]) {
    return [{
      action: parsed.action,
      params: parsed.params || {}
    }];
  }

  return null;
}

async function createAiMessage({
  chatId,
  aiBot,
  text,
  sourceMessageId = null,
  planId = null,
  systemType = 'ai_response',
  systemStage = null
}) {
  const chat = await Chat.findById(chatId).select('_id isAiChat aiState.processingMessageId');
  if (!chat?.isAiChat) {
    return null;
  }

  const resolvedSourceMessageId = mongoose.Types.ObjectId.isValid(String(sourceMessageId || ''))
    ? sourceMessageId
    : chat?.aiState?.processingMessageId || null;

  const systemEvent = {
    type: systemType,
    stage: resolveAiMessageStage({ systemType, systemStage, text })
  };
  if (mongoose.Types.ObjectId.isValid(String(resolvedSourceMessageId || ''))) {
    systemEvent.sourceMessageId = resolvedSourceMessageId;
  }
  if (planId) {
    systemEvent.planId = String(planId).slice(0, 120);
  }

  const message = await Message.create({
    chat: chatId,
    sender: aiBot._id,
    type: 'text',
    text,
    systemEvent,
    readBy: [{ user: aiBot._id }]
  });

  await message.populate('sender', 'name phone avatarUrl isSystem systemKey');
  await Chat.findByIdAndUpdate(chatId, {
    $set: {
      lastMessage: buildLastMessagePayload(message),
      updatedAt: message.createdAt
    }
  });

  return message;
}

function emitAiMessage(io, chatId, message) {
  if (!io || !message) return;

  const payload = {
    chatId: String(chatId),
    message: message.toObject()
  };

  io.to(`chat:${chatId}`).emit('message:new', payload);
  io.to(`chat:${chatId}`).emit('new_message', payload);
}

async function createAndEmitAiMessage({
  io,
  chatId,
  aiBot,
  text,
  sourceMessageId = null,
  planId = null,
  systemType = 'ai_response',
  systemStage = null
}) {
  const message = await createAiMessage({
    chatId,
    aiBot,
    text,
    sourceMessageId,
    planId,
    systemType,
    systemStage
  });

  emitAiMessage(io, chatId, message);
  return message;
}

function shouldSendFallbackMessage(error) {
  const status = Number(error?.status || error?.response?.status || 0);
  const code = String(error?.code || '').toUpperCase();

  if (status === 429) return true;
  if (status === 401 || status === 403) return true;
  if (status >= 500) return true;

  return [
    'ECONNABORTED',
    'ETIMEDOUT',
    'ECONNRESET',
    'ERR_NETWORK',
    'OPENROUTER_API_KEY_MISSING',
    'OPENROUTER_EMPTY_RESPONSE',
    'OPENROUTER_REQUEST_FAILED',
    'OPENROUTER_ABORTED',
    'AI_ABORTED',
    'AI_DELAY_ABORTED'
  ].includes(code);
}

async function maybeSendFallbackMessage({ io, chatId, aiBot, error, sourceMessageId = null }) {
  if (!shouldSendFallbackMessage(error)) {
    throw error;
  }

  await createAndEmitAiMessage({
    io,
    chatId,
    aiBot,
    text: AI_UNAVAILABLE_TEXT,
    sourceMessageId,
    systemType: 'ai_unavailable'
  });
}

function resolveAiActorUserId(chat, aiBotId) {
  const participant = (chat?.participants || []).find((item) => {
    const participantId = item?.user?._id?.toString?.() || item?.user?.toString?.() || '';
    return participantId && participantId !== String(aiBotId);
  });

  return participant?.user?._id?.toString?.() || participant?.user?.toString?.() || null;
}

function describeActionForConfirmation(step) {
  const action = String(step?.action || '').trim();
  if (action === 'start_call') {
    return 'запуск звонка';
  }
  if (action === 'add_user') {
    return 'добавление участника';
  }
  if (action === 'create_group') {
    return 'создание группы';
  }
  return action || 'действие';
}

function buildConfirmationSummary(actions) {
  const items = (Array.isArray(actions) ? actions : [])
    .map(describeActionForConfirmation)
    .filter(Boolean);
  return items.join(', ');
}

const STRICT_CONFIRMATION_MESSAGES = new Set([
  '\u0434\u0430',
  '\u0434\u0430.',
  '\u043e\u043a',
  '\u043e\u043a.',
  '\u043e\u043a\u0435\u0439',
  '\u043e\u043a\u0435\u0439.',
  '\u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u044e',
  '\u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u044e.',
  '\u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c',
  '\u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c.',
  '\u0437\u0430\u043f\u0443\u0441\u043a\u0430\u0439',
  '\u0437\u0430\u043f\u0443\u0441\u043a\u0430\u0439.',
  '\u0432\u044b\u043f\u043e\u043b\u043d\u044f\u0439',
  '\u0432\u044b\u043f\u043e\u043b\u043d\u044f\u0439.'
]);

const STRICT_CANCELLATION_MESSAGES = new Set([
  '\u043d\u0435\u0442',
  '\u043d\u0435\u0442.',
  '\u043e\u0442\u043c\u0435\u043d\u0430',
  '\u043e\u0442\u043c\u0435\u043d\u0430.',
  '\u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c',
  '\u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c.',
  '\u043d\u0435 \u043d\u0430\u0434\u043e',
  '\u043d\u0435 \u043d\u0430\u0434\u043e.',
  '\u0441\u0442\u043e\u043f',
  '\u0441\u0442\u043e\u043f.'
]);

function normalizePendingReplyText(text) {
  return String(text || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function isStrictConfirmationMessage(text) {
  return STRICT_CONFIRMATION_MESSAGES.has(normalizePendingReplyText(text));
}

function isStrictCancellationMessage(text) {
  return STRICT_CANCELLATION_MESSAGES.has(normalizePendingReplyText(text));
}

function isConfirmationMessage(text) {
  return /\b(подтвердить|подтверждаю|да|ок|запускай|выполняй)\b/i.test(String(text || '').trim());
}

function isCancellationMessage(text) {
  return /\b(отмена|отменить|не надо|стоп|нет)\b/i.test(String(text || '').trim());
}

async function expirePendingActions({ userId, chatId }) {
  await AiPendingAction.updateMany(
    {
      userId,
      chatId,
      status: 'pending',
      expiresAt: { $lte: new Date() }
    },
    {
      $set: {
        status: 'expired'
      }
    }
  );
}

async function getPendingAction({ userId, chatId }) {
  await expirePendingActions({ userId, chatId });
  return AiPendingAction.findOne({
    userId,
    chatId,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });
}

async function rememberPendingAction({ userId, chatId, messageId, actions }) {
  const existingPendingAction = await getPendingAction({ userId, chatId });
  if (existingPendingAction && String(existingPendingAction.messageId) !== String(messageId)) {
    const error = new Error('AI already has a pending confirmation for this chat');
    error.code = 'AI_PENDING_ACTION_EXISTS';
    error.pendingAction = existingPendingAction;
    throw error;
  }

  const planId = String(new mongoose.Types.ObjectId());
  const summary = buildConfirmationSummary(actions);
  const expiresAt = new Date(Date.now() + AI_CONFIRMATION_TTL_MS);

  const payload = {
    messageId,
    planId,
    actions: Array.isArray(actions) ? actions : [],
    summary,
    status: 'pending',
    expiresAt
  };

  try {
    return await AiPendingAction.findOneAndUpdate(
      {
        userId,
        chatId,
        status: 'pending'
      },
      {
        $set: payload,
        $setOnInsert: {
          userId,
          chatId
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );
  } catch (error) {
    if (error?.code === 11000) {
      return AiPendingAction.findOne({
        userId,
        chatId,
        status: 'pending'
      });
    }
    throw error;
  }
}

async function createConfirmationMessage({ io, chatId, aiBot, pendingAction }) {
  const summary = pendingAction?.summary || 'опасное действие';
  const expiresAt = pendingAction?.expiresAt instanceof Date
    ? pendingAction.expiresAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : null;
  const text = [
    `Нужно подтверждение: ${summary}.`,
    'Ответьте "подтвердить" или "отмена".',
    expiresAt ? `Запрос активен до ${expiresAt}.` : null
  ].filter(Boolean).join(' ');

  await createAndEmitAiMessage({
    io,
    chatId,
    aiBot,
    text,
    sourceMessageId: pendingAction?.messageId || null,
    planId: pendingAction?.planId || null,
    systemType: 'ai_confirmation'
  });
}

async function executeAndReportAiPlan({
  app,
  io,
  chatId,
  aiBot,
  actorUserId,
  actions,
  messageId = null,
  planId = null
}) {
  const total = Array.isArray(actions) ? actions.length : 0;
  if (total === 0) return null;

  if (total > 1) {
    await createAndEmitAiMessage({
      io,
      chatId,
      aiBot,
      text: 'Выполняю несколько действий...'
    });
  } else {
    await createAndEmitAiMessage({
      io,
      chatId,
      aiBot,
      text: getAiToolProgressText(actions[0].action),
      systemStage: 'progress'
    });
  }

  return executeAiPlan({
    app,
    actorUserId,
    chatId,
    actions,
    messageId,
    planId,
    onStepSuccess: async ({ index, total: stepTotal, action }) => {
      if (stepTotal <= 1) return;

      await createAndEmitAiMessage({
        io,
        chatId,
        aiBot,
        text: `Шаг ${index + 1}/${stepTotal} выполнен: ${action}.`
      });
    },
    onStepError: async ({ index, total: stepTotal, error }) => {
      if (stepTotal <= 1) return;

      await createAndEmitAiMessage({
        io,
        chatId,
        aiBot,
        text: normalizeAiReply(`Ошибка на шаге ${index + 1}: ${error?.message || 'неизвестная ошибка'}.`)
      });
    }
  });
}

async function resolveConfirmationReply({ app, io, chat, aiBot, actorUserId, message }) {
  const pendingAction = await getPendingAction({
    userId: actorUserId,
    chatId: chat._id
  });

  if (!pendingAction) {
    return false;
  }

  if (
    pendingAction?.messageId
    && compareMessageIds(message?._id, pendingAction.messageId) <= 0
  ) {
    return false;
  }

  const text = String(message?.text || '').trim();
  if (isStrictCancellationMessage(text)) {
    pendingAction.status = 'cancelled';
    await pendingAction.save();
    await createAndEmitAiMessage({
      io,
      chatId: chat._id,
      aiBot,
      text: 'Ок, отменяю запрошенное действие.'
    });
    return true;
  }

  if (!isStrictConfirmationMessage(text)) {
    return false;
  }

  pendingAction.status = 'confirmed';
  await pendingAction.save();

  try {
    const result = await executeAndReportAiPlan({
      app,
      io,
      chatId: chat._id,
      aiBot,
      actorUserId,
      actions: pendingAction.actions,
      messageId: pendingAction.messageId,
      planId: pendingAction.planId
    });

    pendingAction.status = 'executed';
    await pendingAction.save();

    await createAndEmitAiMessage({
      io,
      chatId: chat._id,
      aiBot,
      text: normalizeAiReply(result?.responseText || 'Готово.')
    });
  } catch (error) {
    pendingAction.status = 'cancelled';
    await pendingAction.save();

    const partialText = error?.partialResult?.responseText || error?.message || 'Не удалось выполнить действие.';
    await createAndEmitAiMessage({
      io,
      chatId: chat._id,
      aiBot,
      text: normalizeAiReply(partialText)
    });
  }

  return true;
}

async function releaseStaleProcessingLock(chatId) {
  if (!mongoose.Types.ObjectId.isValid(String(chatId || ''))) {
    return false;
  }

  const result = await Chat.updateOne(
    {
      _id: chatId,
      'aiState.processingMessageId': { $ne: null },
      ...buildStaleProcessingQuery()
    },
    {
      $set: {
        'aiState.processingMessageId': null,
        'aiState.processingStartedAt': null
      }
    }
  );

  return Boolean(result?.modifiedCount);
}

async function recoverQueuedAiMessagesFromDb(state) {
  const chat = await Chat.findById(state.chatId)
    .select('aiState.lastProcessedMessageId aiState.lastQueuedMessageId aiState.processingMessageId aiState.processingStartedAt')
    .lean();
  if (!chat?.aiState) {
    return 0;
  }

  if (chat.aiState.processingMessageId && isProcessingLockStale(chat.aiState)) {
    await releaseStaleProcessingLock(state.chatId);
  }

  const lastQueuedMessageId = String(chat.aiState.lastQueuedMessageId || '').trim();
  const lastProcessedMessageId = String(chat.aiState.lastProcessedMessageId || '').trim();
  if (!lastQueuedMessageId) {
    return 0;
  }

  if (lastProcessedMessageId && compareMessageIds(lastQueuedMessageId, lastProcessedMessageId) <= 0) {
    state.recoveryRequired = false;
    return 0;
  }

  const aiBot = await ensureAiBotUser();
  const query = {
    chat: state.chatId,
    deleted: { $ne: true },
    sender: { $ne: aiBot._id },
    _id: { $lte: lastQueuedMessageId }
  };

  if (lastProcessedMessageId) {
    query._id.$gt = lastProcessedMessageId;
  }

  const messages = await Message.find(query)
    .select('_id')
    .sort({ _id: 1 })
    .limit(AI_QUEUE_RECOVERY_BATCH_SIZE)
    .lean();

  let added = 0;
  for (const message of messages) {
    if (enqueueQueuedMessage(state, message._id)) {
      added += 1;
    }
  }

  state.recoveryRequired = messages.length >= AI_QUEUE_RECOVERY_BATCH_SIZE || state.queue.length >= AI_MAX_PENDING_RESPONSES_PER_CHAT;
  return added;
}

async function markProcessingStarted({ chatId, messageId }) {
  const updated = await Chat.findOneAndUpdate(
    {
      _id: chatId,
      $or: [
        { 'aiState.processingMessageId': null },
        { 'aiState.processingMessageId': messageId },
        {
          'aiState.processingMessageId': { $ne: null },
          ...buildStaleProcessingQuery()
        }
      ]
    },
    {
      $set: {
        'aiState.processingMessageId': messageId,
        'aiState.processingStartedAt': new Date()
      }
    },
    {
      new: true
    }
  ).select('_id aiState');

  return updated;
}

async function markProcessingFinished({ chatId, messageId, completed }) {
  const update = {
    $set: {
      'aiState.processingMessageId': null,
      'aiState.processingStartedAt': null
    }
  };

  if (completed) {
    update.$set['aiState.lastProcessedMessageId'] = messageId;
    update.$set['aiState.lastResponseAt'] = new Date();
  }

  await Chat.findOneAndUpdate(
    {
      _id: chatId,
      'aiState.processingMessageId': messageId
    },
    update
  );
}

async function handleAiResponseNow({ app, chatId, messageId, signal }) {
  const { io } = getSocketHelpers(app);
  const [chat, aiBot] = await Promise.all([
    Chat.findById(chatId).select('_id isAiChat participants aiState'),
    ensureAiBotUser()
  ]);

  if (!chat || !chat.isAiChat) {
    await markProcessingFinished({ chatId, messageId, completed: true });
    return;
  }

  if (
    chat.aiState?.lastProcessedMessageId
    && compareMessageIds(messageId, chat.aiState.lastProcessedMessageId) <= 0
  ) {
    await markProcessingFinished({ chatId, messageId, completed: false });
    return;
  }

  const processingLock = await markProcessingStarted({ chatId, messageId });
  if (!processingLock) {
    return;
  }

  emitAiTyping(io, chatId, aiBot, true);

  const responseDelayMs = 500 + Math.floor(Math.random() * 1000);
  const startedAt = Date.now();
  let completed = false;

  try {
    const message = await Message.findOne({
      _id: messageId,
      chat: chatId,
      deleted: { $ne: true }
    }).lean();

    if (!message) {
      completed = true;
      return;
    }

    if (String(message.sender) === String(aiBot._id)) {
      completed = true;
      return;
    }

    const contextEntries = await buildAiContext({
      chatId,
      aiBotId: aiBot._id,
      upToMessageId: messageId
    });

    const userEntry = contextEntries.find((entry) => entry.messageId === String(messageId))
      || toContextEntry(message, aiBot._id);

    if (!userEntry?.content) {
      completed = true;
      return;
    }

    const actorUserId = resolveAiActorUserId(chat, aiBot._id);
    if (!actorUserId) {
      throw new Error('AI actor user was not resolved');
    }

    const existingTerminalMessage = await findExistingAiTerminalMessage({
      chatId,
      aiBotId: aiBot._id,
      sourceMessageId: messageId
    });
    if (existingTerminalMessage) {
      completed = true;
      return;
    }

    if (await resolveConfirmationReply({
      app,
      io,
      chat,
      aiBot,
      actorUserId,
      message
    })) {
      completed = true;
      return;
    }

    const memory = await getMemory(actorUserId);
    const supportShortcut = resolveSupportShortcut(userEntry.content);
    let responseText = '';
    let parsed = null;
    let actionPlan = supportShortcut?.actions || null;

    if (!actionPlan) {
      responseText = await generateAiResponse(
        userEntry.content,
        contextEntries
          .filter((entry) => entry.messageId !== String(messageId))
          .map(({ role, content }) => ({ role, content })),
        {
          signal,
          user: `chat:${String(chatId)}`,
          systemPrompt: buildAiSystemPromptWithMemory(memory)
        }
      );

      if (signal?.aborted) {
        throw createAbortError('AI response timed out', 'AI_ABORTED');
      }

      parsed = parseAiAction(responseText);
      actionPlan = toActionPlan(parsed);

      if (!actionPlan) {
        const fallbackPlan = resolveFallbackAiPlan({
          text: userEntry.content
        });
        actionPlan = toActionPlan(fallbackPlan);
      }
    }

    const remainingDelay = responseDelayMs - (Date.now() - startedAt);
    if (remainingDelay > 0) {
      await sleep(remainingDelay, signal);
    }

    if (actionPlan?.length) {
      if (planRequiresConfirmation(actionPlan)) {
        try {
          const pendingAction = await rememberPendingAction({
            userId: actorUserId,
            chatId,
            messageId,
            actions: actionPlan
          });

          await createConfirmationMessage({
            io,
            chatId,
            aiBot,
            pendingAction
          });
        } catch (pendingError) {
          if (pendingError?.code !== 'AI_PENDING_ACTION_EXISTS') {
            throw pendingError;
          }

          await createAndEmitAiMessage({
            io,
            chatId,
            aiBot,
            text: 'Сначала подтвердите или отмените предыдущий запрос, а потом отправьте новый.',
            sourceMessageId: messageId,
            systemType: 'ai_response'
          });
        }
        completed = true;
        return;
      }

      try {
        const result = await executeAndReportAiPlan({
          app,
          io,
          chatId,
          aiBot,
          actorUserId,
          actions: actionPlan,
          messageId
        });

        await createAndEmitAiMessage({
          io,
          chatId,
          aiBot,
          text: normalizeAiReply(result?.responseText || 'Готово.')
        });
      } catch (actionError) {
        console.warn('[AI] action execution failed:', {
          chatId: String(chatId),
          messageId: String(messageId),
          actions: actionPlan.map((item) => item.action),
          code: actionError?.code || null,
          message: actionError?.message || actionError
        });

        await createAndEmitAiMessage({
          io,
          chatId,
          aiBot,
          text: normalizeAiReply(
            actionError?.partialResult?.responseText
            || actionError?.message
            || 'Не удалось выполнить действие.'
          )
        });
      }

      completed = true;
      return;
    }

    await createAndEmitAiMessage({
      io,
      chatId,
      aiBot,
      text: normalizeAiReply(parsed?.text || responseText)
    });

    completed = true;
  } catch (error) {
    console.warn('[AI] response failed:', {
      chatId: String(chatId),
      messageId: String(messageId),
      code: error?.code || null,
      status: error?.status || error?.response?.status || null,
      message: error?.message || error
    });

    try {
      await maybeSendFallbackMessage({
        io,
        chatId,
        aiBot,
        error
      });
    } catch (fallbackError) {
      await createAndEmitAiMessage({
        io,
        chatId,
        aiBot,
        text: AI_UNAVAILABLE_TEXT
      });
      console.warn('[AI] fallback message escalation:', {
        chatId: String(chatId),
        messageId: String(messageId),
        code: fallbackError?.code || null,
        message: fallbackError?.message || fallbackError
      });
    }

    completed = true;
  } finally {
    emitAiTyping(io, chatId, aiBot, false);
    await markProcessingFinished({ chatId, messageId, completed });
  }
}

async function runAiResponseJob({ app, chatId, messageId }) {
  return withAiConcurrencyLimit(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, AI_QUEUE_TIMEOUT_MS);
    timeout.unref?.();

    try {
      await handleAiResponseNow({
        app,
        chatId,
        messageId,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  });
}

async function drainAiQueue(state) {
  const key = String(state.chatId);

  try {
    while (state.queue.length > 0) {
      state.running = true;
      const messageId = state.queue.shift();
      state.queuedIds.delete(String(messageId));
      state.lastTouchedAt = Date.now();

      if (!messageId) {
        continue;
      }

      try {
        await runAiResponseJob({
          app: state.app,
          chatId: state.chatId,
          messageId
        });
      } catch (error) {
        console.warn('[AI] queue job failed:', {
          chatId: key,
          messageId: String(messageId),
          code: error?.code || null,
          message: error?.message || error
        });
      } finally {
        state.lastTouchedAt = Date.now();
      }
    }
  } finally {
    state.running = false;
    state.promise = null;

    if (state.queue.length > 0) {
      state.promise = drainAiQueue(state);
      return state.promise;
    }

    const recoveredCount = await recoverQueuedAiMessagesFromDb(state);
    if (recoveredCount > 0 && !state.promise) {
      state.promise = drainAiQueue(state);
      return state.promise;
    }

    if (responseQueueByChat.get(key) === state) {
      responseQueueByChat.delete(key);
    }
  }

  return undefined;
}

async function queueAiResponse({ app, chatId, messageId }) {
  if (!mongoose.Types.ObjectId.isValid(String(chatId || '')) || !mongoose.Types.ObjectId.isValid(String(messageId || ''))) {
    return undefined;
  }

  const normalizedMessageId = String(messageId);
  const state = getOrCreateQueueState({ app, chatId });

  await Chat.findByIdAndUpdate(chatId, {
    $set: {
      'aiState.lastQueuedMessageId': messageId
    }
  });

  const persistedState = await Chat.findById(chatId).select('aiState.lastProcessedMessageId').lean();
  if (
    persistedState?.aiState?.lastProcessedMessageId
    && compareMessageIds(normalizedMessageId, persistedState.aiState.lastProcessedMessageId) <= 0
  ) {
    return state.promise;
  }

  enqueueQueuedMessage(state, normalizedMessageId);

  if (!state.promise) {
    state.promise = drainAiQueue(state);
  }

  return state.promise;
}

async function recoverPendingAiResponses({ app, limit = 100 } = {}) {
  const chats = await Chat.find({
    isAiChat: true,
    $or: [
      {
        $expr: {
          $gt: ['$aiState.lastQueuedMessageId', '$aiState.lastProcessedMessageId']
        }
      },
      { 'aiState.processingMessageId': { $ne: null } }
    ]
  })
    .select('_id aiState.lastQueuedMessageId aiState.processingMessageId aiState.processingStartedAt')
    .sort({ updatedAt: -1, _id: -1 })
    .limit(Math.max(Number(limit || 0), 1))
    .lean();

  for (const chat of chats) {
    if (chat?.aiState?.processingMessageId && isProcessingLockStale(chat.aiState)) {
      await releaseStaleProcessingLock(chat._id);
    }

    const state = getOrCreateQueueState({ app, chatId: chat._id });
    await recoverQueuedAiMessagesFromDb(state);

    if (!state.promise && state.queue.length > 0) {
      state.promise = drainAiQueue(state);
    }
  }
}

let aiQueueWatchdogStarted = false;

function startAiQueueWatchdog({ app, intervalMs = AI_QUEUE_WATCHDOG_MS } = {}) {
  if (!app || aiQueueWatchdogStarted) return;
  aiQueueWatchdogStarted = true;

  const handle = setInterval(() => {
    recoverPendingAiResponses({ app }).catch((error) => {
      console.warn('[AI] watchdog recovery failed:', error?.message || error);
    });
  }, Math.max(Number(intervalMs || 0), 10_000));

  handle.unref?.();
}

module.exports = {
  AI_BOT_SYSTEM_KEY,
  AI_BOT_NAME,
  AI_CHAT_TITLE,
  AI_MESSAGE_MAX_LENGTH,
  createAppFacade,
  ensureAiBotUser,
  ensureSupportChatForUser,
  emitChatCreatedToUser,
  checkAiRateLimit,
  ensureAiTextLimit,
  queueAiResponse,
  recoverPendingAiResponses,
  startAiQueueWatchdog,
  rememberAiUserMessage: rememberUserMessage
};
