const Message = require('../models/Message');

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function resolveIo(appOrIo) {
  if (appOrIo?.to && appOrIo?.emit) return appOrIo;
  return appOrIo?.get?.('io') || null;
}

function groupMessageIdsByChat(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    const chatId = String(row?.chat || '').trim();
    const messageId = String(row?._id || '').trim();
    if (!chatId || !messageId) return;

    if (!grouped.has(chatId)) {
      grouped.set(chatId, []);
    }

    grouped.get(chatId).push(messageId);
  });

  return grouped;
}

function emitGroupedReceiptEvent(io, eventName, grouped, userId) {
  if (!io || !grouped.size) return;

  grouped.forEach((messageIds, chatId) => {
    io.to(`chat:${chatId}`).emit(eventName, {
      chatId,
      userId: String(userId),
      messageIds
    });
  });
}

function buildReceiptScope({ chatId = null, chatIds = [], messageIds = [] } = {}) {
  const normalizedChatId = String(chatId || '').trim();
  const normalizedChatIds = normalizeStringArray(chatIds);
  const normalizedMessageIds = normalizeStringArray(messageIds);
  const scope = {};

  if (normalizedChatId) {
    scope.chat = normalizedChatId;
  } else if (normalizedChatIds.length > 0) {
    scope.chat = { $in: normalizedChatIds };
  }

  if (normalizedMessageIds.length > 0) {
    scope._id = { $in: normalizedMessageIds };
  }

  return scope;
}

async function collectUpdatedReceipts({ baseQuery, receiptField, receiptPayload }) {
  const updateQuery = {
    ...baseQuery,
    [`${receiptField}.user`]: { $ne: receiptPayload.user }
  };

  await Message.updateMany(updateQuery, {
    $push: { [receiptField]: receiptPayload }
  });

  return Message.find({
    ...baseQuery,
    [receiptField]: {
      $elemMatch: receiptPayload
    }
  })
    .select('_id chat')
    .lean();
}

async function markMessagesDelivered({
  app = null,
  io = null,
  userId,
  chatId = null,
  chatIds = [],
  messageIds = [],
  extraQuery = {},
  emit = true
} = {}) {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return new Map();

  const baseQuery = {
    sender: { $ne: normalizedUserId },
    deleted: { $ne: true },
    ...buildReceiptScope({ chatId, chatIds, messageIds }),
    ...extraQuery
  };
  const deliveredAt = new Date();
  const receiptPayload = { user: normalizedUserId, deliveredAt };
  const updatedRows = await collectUpdatedReceipts({
    baseQuery,
    receiptField: 'deliveredTo',
    receiptPayload
  });
  const grouped = groupMessageIdsByChat(updatedRows);

  if (emit && grouped.size > 0) {
    emitGroupedReceiptEvent(resolveIo(io || app), 'messages:delivered', grouped, normalizedUserId);
  }

  return grouped;
}

async function markMessagesRead({
  app = null,
  io = null,
  userId,
  chatId = null,
  chatIds = [],
  messageIds = [],
  extraQuery = {},
  emit = true
} = {}) {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return new Map();

  await markMessagesDelivered({
    app,
    io,
    userId: normalizedUserId,
    chatId,
    chatIds,
    messageIds,
    extraQuery,
    emit: false
  });

  const baseQuery = {
    sender: { $ne: normalizedUserId },
    deleted: { $ne: true },
    ...buildReceiptScope({ chatId, chatIds, messageIds }),
    ...extraQuery
  };
  const readAt = new Date();
  const receiptPayload = { user: normalizedUserId, readAt };
  const updatedRows = await collectUpdatedReceipts({
    baseQuery,
    receiptField: 'readBy',
    receiptPayload
  });
  const grouped = groupMessageIdsByChat(updatedRows);

  if (emit && grouped.size > 0) {
    emitGroupedReceiptEvent(resolveIo(io || app), 'messages:read', grouped, normalizedUserId);
  }

  return grouped;
}

module.exports = {
  markMessagesDelivered,
  markMessagesRead
};
