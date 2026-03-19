const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const { buildLastMessagePayload } = require('./messageStateService');
const { formatChatForUser } = require('../social/services/chatService');
const { generateAiResponse } = require('./aiService');

const AI_BOT_SYSTEM_KEY = 'ai-bot';
const AI_BOT_NAME = 'Поддержка GovChat';
const AI_CHAT_TITLE = 'Поддержка';
const AI_WELCOME_TEXT = 'Привет! Я помощник GovChat. Могу подсказать по сообщениям, звонкам, вложениям и основным функциям приложения.';
const AI_UNAVAILABLE_TEXT = 'Сейчас поддержка временно недоступна. Попробуйте написать чуть позже.';
const AI_BOT_PHONE = String(process.env.AI_BOT_PHONE || '+79990000001').trim();
const AI_BOT_AVATAR_URL = String(process.env.AI_BOT_AVATAR_URL || '/uploads/avatar-default.png').trim();
const AI_MESSAGE_MAX_LENGTH = Math.max(Number(process.env.AI_CHAT_MAX_INPUT_LENGTH || 2000), 1);
const AI_RATE_LIMIT_WINDOW_MS = Math.max(Number(process.env.AI_CHAT_RATE_LIMIT_MS || 1000), 250);
const AI_USER_RATE_LIMIT_WINDOW_MS = Math.max(Number(process.env.AI_CHAT_USER_RATE_LIMIT_MS || AI_RATE_LIMIT_WINDOW_MS), AI_RATE_LIMIT_WINDOW_MS);
const AI_CONTEXT_LIMIT = Math.max(Number(process.env.AI_CHAT_CONTEXT_LIMIT || 10), 1);
const AI_CONTEXT_MAX_CHARS = Math.max(Number(process.env.AI_CHAT_CONTEXT_MAX_CHARS || 4000), 500);
const AI_CONTEXT_SCAN_LIMIT = Math.max(Number(process.env.AI_CHAT_CONTEXT_SCAN_LIMIT || Math.max(AI_CONTEXT_LIMIT * 3, 30)), AI_CONTEXT_LIMIT);
const AI_QUEUE_TIMEOUT_MS = Math.max(Number(process.env.AI_CHAT_QUEUE_TIMEOUT_MS || 30000), 5000);
const AI_QUEUE_IDLE_TTL_MS = Math.max(Number(process.env.AI_CHAT_QUEUE_IDLE_TTL_MS || Math.max(AI_QUEUE_TIMEOUT_MS * 2, 120000)), AI_QUEUE_TIMEOUT_MS);
const AI_CLEANUP_INTERVAL_MS = Math.max(Number(process.env.AI_CHAT_CLEANUP_INTERVAL_MS || 60000), 10000);
const AI_STATE_TTL_MS = Math.max(Number(process.env.AI_CHAT_STATE_TTL_MS || Math.max(AI_QUEUE_IDLE_TTL_MS, 300000)), AI_QUEUE_IDLE_TTL_MS);
const AI_MAX_PARALLEL_RESPONSES = Math.max(Number(process.env.AI_CHAT_MAX_PARALLEL_RESPONSES || 8), 1);
const AI_MAX_PENDING_RESPONSES_PER_CHAT = Math.max(Number(process.env.AI_CHAT_MAX_PENDING_PER_CHAT || 1), 1);
const SYSTEM_PASSWORD_HASH = bcrypt.hashSync(`system:${AI_BOT_SYSTEM_KEY}:govchat`, 10);

const messageCooldownByUser = new Map();
const messageCooldownByUserChat = new Map();
const responseQueueByChat = new Map();

let activeAiJobs = 0;
const aiConcurrencyWaiters = [];

function normalizePhone(phone) {
  return String(phone || '').replace(/[\s\-()]/g, '');
}

function createAppFacade({ io, userSockets }) {
  return {
    get(key) {
      if (key === 'io') return io;
      if (key === 'socketData') return { userSockets };
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
  store.set(String(key), {
    lastSeenAt: now
  });
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
    systemEvent: {
      type: 'ai_welcome'
    },
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

async function buildAiContext({ chatId, aiBotId }) {
  const messages = await Message.find({
    chat: chatId,
    deleted: { $ne: true }
  })
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

    if (nextCount > AI_CONTEXT_LIMIT) {
      break;
    }

    if (selected.length > 0 && nextTotalChars > AI_CONTEXT_MAX_CHARS) {
      break;
    }

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

async function createAiMessage({ chatId, aiBot, text }) {
  const chat = await Chat.findById(chatId).select('_id isAiChat');
  if (!chat?.isAiChat) {
    return null;
  }

  const message = await Message.create({
    chat: chatId,
    sender: aiBot._id,
    type: 'text',
    text,
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

async function maybeSendFallbackMessage({ io, chatId, aiBot, error }) {
  if (!shouldSendFallbackMessage(error)) {
    throw error;
  }

  const fallbackMessage = await createAiMessage({
    chatId,
    aiBot,
    text: AI_UNAVAILABLE_TEXT
  });

  emitAiMessage(io, chatId, fallbackMessage);
}

async function handleAiResponseNow({ app, chatId, signal }) {
  const { io } = getSocketHelpers(app);
  const [chat, aiBot] = await Promise.all([
    Chat.findById(chatId).select('_id isAiChat'),
    ensureAiBotUser()
  ]);

  if (!chat || !chat.isAiChat) return;

  emitAiTyping(io, chatId, aiBot, true);

  const responseDelayMs = 500 + Math.floor(Math.random() * 1000);
  const startedAt = Date.now();

  try {
    const context = await buildAiContext({ chatId, aiBotId: aiBot._id });
    const lastUserMessage = [...context].reverse().find((entry) => entry.role === 'user');
    if (!lastUserMessage?.content) {
      return;
    }

    const responseText = await generateAiResponse(
      lastUserMessage.content,
      context.slice(0, -1),
      {
        signal,
        user: `chat:${String(chatId)}`
      }
    );

    if (signal?.aborted) {
      throw createAbortError('AI response timed out', 'AI_ABORTED');
    }

    const remainingDelay = responseDelayMs - (Date.now() - startedAt);
    if (remainingDelay > 0) {
      await sleep(remainingDelay, signal);
    }

    const message = await createAiMessage({
      chatId,
      aiBot,
      text: normalizeAiReply(responseText)
    });

    emitAiMessage(io, chatId, message);
  } catch (error) {
    console.warn('[AI] response failed:', {
      chatId: String(chatId),
      code: error?.code || null,
      status: error?.status || error?.response?.status || null,
      message: error?.message || error
    });

    await maybeSendFallbackMessage({
      io,
      chatId,
      aiBot,
      error
    });
  } finally {
    emitAiTyping(io, chatId, aiBot, false);
  }
}

async function runAiResponseJob({ app, chatId }) {
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
    while (state.pendingRuns > 0) {
      state.running = true;
      state.pendingRuns -= 1;
      state.lastTouchedAt = Date.now();

      try {
        await runAiResponseJob({
          app: state.app,
          chatId: state.chatId
        });
      } catch (error) {
        console.warn('[AI] queue job failed:', {
          chatId: key,
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

    if (state.pendingRuns > 0) {
      state.promise = drainAiQueue(state);
      return state.promise;
    }

    if (responseQueueByChat.get(key) === state) {
      responseQueueByChat.delete(key);
    }
  }

  return undefined;
}

function queueAiResponse({ app, chatId }) {
  const key = String(chatId);
  const now = Date.now();
  let state = responseQueueByChat.get(key);

  if (!state) {
    state = {
      app,
      chatId: key,
      running: false,
      pendingRuns: 0,
      promise: null,
      lastTouchedAt: now
    };
    responseQueueByChat.set(key, state);
  }

  state.app = app;
  state.lastTouchedAt = now;
  state.pendingRuns = Math.min(state.pendingRuns + 1, AI_MAX_PENDING_RESPONSES_PER_CHAT);

  if (!state.promise) {
    state.promise = drainAiQueue(state);
  }

  return state.promise;
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
  queueAiResponse
};
