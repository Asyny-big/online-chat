const express = require('express');
const mongoose = require('mongoose');

const Chat = require('../models/Chat');
const Message = require('../models/Message');
const authMiddleware = require('../middleware/auth');
const { checkChatAccess } = require('../middleware/checkChatAccess');
const { scheduleFileCleanup } = require('../services/fileCleanupService');
const { syncChatLastMessage } = require('../services/messageStateService');
const { markMessagesRead } = require('../services/messageReceiptService');

const router = express.Router();

const MESSAGE_UPDATED_EVENT = 'message:updated';
const MESSAGE_DELETED_EVENT = 'message:deleted';
const EDIT_WINDOW_MS = 15 * 60 * 1000;

router.use(authMiddleware);

function toObjectId(value) {
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function normalizeScope(rawScope) {
  const scope = String(rawScope || 'for_all').trim().toLowerCase();
  if (scope === 'self' || scope === 'local' || scope === 'for_me') return 'for_me';
  return 'for_all';
}

function parseExpectedRevision(req) {
  const rawValue = req.body?.expectedRevision ?? req.body?.revision ?? req.query.expectedRevision ?? req.query.revision;
  if (rawValue === undefined || rawValue === null || rawValue === '') return null;

  const value = Number(rawValue);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function parseExpectedUpdatedAt(req) {
  const rawValue = req.body?.expectedUpdatedAt ?? req.body?.updatedAt ?? req.query.expectedUpdatedAt ?? req.query.updatedAt;
  if (!rawValue) return null;

  const value = new Date(rawValue);
  return Number.isNaN(value.getTime()) ? null : value;
}

function getMutationGuard(req) {
  return {
    expectedRevision: parseExpectedRevision(req),
    expectedUpdatedAt: parseExpectedUpdatedAt(req)
  };
}

function applyMutationGuard(query, guard) {
  if (guard.expectedRevision !== null) {
    query.revision = guard.expectedRevision;
  }
  if (guard.expectedUpdatedAt) {
    query.updatedAt = guard.expectedUpdatedAt;
  }
}

function buildEventId(messageId, revision, action) {
  return `${messageId}:${revision}:${action}`;
}

function buildMutationPayload({ action, chatId, userId, scope = 'for_all', message, messageId }) {
  const normalizedMessageId = String(messageId || message?._id || '');
  const revision = Number(message?.revision || 0);
  const updatedAt = message?.updatedAt || null;

  return {
    eventId: buildEventId(normalizedMessageId, revision, action),
    action,
    scope,
    chatId: String(chatId),
    messageId: normalizedMessageId,
    actorUserId: String(userId),
    revision,
    updatedAt,
    message: message?.toObject?.() || message || null
  };
}

function emitMessageUpdated(io, payload, userId) {
  io.to(`chat:${payload.chatId}`)
    .to(`user:${userId}`)
    .emit(MESSAGE_UPDATED_EVENT, payload);
}

function emitMessageDeleted(io, payload, userId, { includeChatRoom = true } = {}) {
  let emitter = io.to(`user:${userId}`);
  if (includeChatRoom) {
    emitter = emitter.to(`chat:${payload.chatId}`);
  }
  emitter.emit(MESSAGE_DELETED_EVENT, payload);
}

function isEditWindowExpired(message) {
  const createdAtMs = new Date(message.createdAt).getTime();
  if (Number.isNaN(createdAtMs)) return false;
  return Date.now() - createdAtMs > EDIT_WINDOW_MS;
}

async function populateMessage(messageId) {
  return Message.findById(messageId)
    .populate('sender', 'name phone avatarUrl')
    .populate('systemEvent.targetUser', 'name')
    .populate('systemEvent.actorUser', 'name');
}

async function loadAuthorizedMessage(messageId, userId) {
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return {
      error: {
        status: 400,
        body: { error: 'Некорректный идентификатор сообщения', code: 'INVALID_MESSAGE_ID' }
      }
    };
  }

  const message = await Message.findById(messageId);
  if (!message) {
    return {
      error: {
        status: 404,
        body: { error: 'Сообщение не найдено', code: 'MESSAGE_NOT_FOUND' }
      }
    };
  }

  const chat = await Chat.findById(message.chat);
  if (!chat) {
    return {
      error: {
        status: 404,
        body: { error: 'Чат не найден', code: 'CHAT_NOT_FOUND' }
      }
    };
  }

  if (!chat.isParticipant(userId)) {
    return {
      error: {
        status: 403,
        body: { error: 'Нет доступа к этому чату', code: 'CHAT_ACCESS_DENIED' }
      }
    };
  }

  return { chat, message };
}

async function resolveMutationFailure(messageId, userId, guard, { allowDeletedIdempotent = false, editWindow = false } = {}) {
  const currentMessage = await Message.findById(messageId);
  if (!currentMessage) {
    return {
      status: 404,
      body: { error: 'Сообщение не найдено', code: 'MESSAGE_NOT_FOUND' }
    };
  }

  if (String(currentMessage.sender) !== String(userId)) {
    return {
      status: 403,
      body: { error: 'Редактировать и удалять можно только свои сообщения', code: 'MESSAGE_AUTHOR_ONLY' }
    };
  }

  if (currentMessage.type === 'system') {
    return {
      status: 400,
      body: { error: 'Системные сообщения нельзя редактировать', code: 'SYSTEM_MESSAGE_IMMUTABLE' }
    };
  }

  if (editWindow && isEditWindowExpired(currentMessage)) {
    return {
      status: 409,
      body: { error: 'Срок редактирования сообщения истёк', code: 'EDIT_WINDOW_EXPIRED' }
    };
  }

  if (currentMessage.deleted) {
    if (allowDeletedIdempotent) {
      const populated = await populateMessage(messageId);
      return {
        status: 200,
        body: {
          success: true,
          unchanged: true,
          scope: 'for_all',
          messageId: String(messageId),
          message: populated?.toObject?.() || null
        }
      };
    }

    return {
      status: 409,
      body: { error: 'Нельзя редактировать удалённое сообщение', code: 'MESSAGE_ALREADY_DELETED' }
    };
  }

  if (guard.expectedRevision !== null && Number(currentMessage.revision || 0) !== guard.expectedRevision) {
    const populated = await populateMessage(messageId);
    return {
      status: 409,
      body: {
        error: 'Сообщение уже изменилось на другом устройстве',
        code: 'MESSAGE_VERSION_CONFLICT',
        message: populated?.toObject?.() || null
      }
    };
  }

  if (guard.expectedUpdatedAt) {
    const currentUpdatedAt = currentMessage.updatedAt ? new Date(currentMessage.updatedAt).getTime() : 0;
    const expectedUpdatedAt = new Date(guard.expectedUpdatedAt).getTime();
    if (currentUpdatedAt !== expectedUpdatedAt) {
      const populated = await populateMessage(messageId);
      return {
        status: 409,
        body: {
          error: 'Сообщение уже изменилось на другом устройстве',
          code: 'MESSAGE_VERSION_CONFLICT',
          message: populated?.toObject?.() || null
        }
      };
    }
  }

  return {
    status: 409,
    body: { error: 'Не удалось применить изменение сообщения', code: 'MESSAGE_MUTATION_FAILED' }
  };
}

router.get('/:chatId', checkChatAccess, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { before, limit = 50 } = req.query;
    const userId = req.userId;
    const userObjectId = toObjectId(userId);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    const query = { chat: chatId };
    if (userObjectId) {
      query.deletedFor = { $ne: userObjectId };
    }
    if (before) {
      const beforeDate = new Date(before);
      if (!Number.isNaN(beforeDate.getTime())) {
        query.createdAt = { $lt: beforeDate };
      }
    }

    await markMessagesRead({
      app: req.app,
      userId,
      chatId,
      extraQuery: userObjectId
        ? { deletedFor: { $ne: userObjectId } }
        : {}
    });

    const messages = await Message.find(query)
      .populate('sender', 'name phone avatarUrl')
      .populate('systemEvent.targetUser', 'name')
      .populate('systemEvent.actorUser', 'name')
      .sort({ createdAt: -1, _id: -1 })
      .limit(safeLimit)
      .lean();

    return res.json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    return res.status(500).json({ error: 'Ошибка получения сообщений', code: 'MESSAGES_FETCH_FAILED' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const nextText = String(req.body?.text || '').trim();
    const guard = getMutationGuard(req);

    const { chat, message, error } = await loadAuthorizedMessage(id, userId);
    if (error) {
      return res.status(error.status).json(error.body);
    }

    if (String(message.sender) !== String(userId)) {
      return res.status(403).json({
        error: 'Редактировать и удалять можно только свои сообщения',
        code: 'MESSAGE_AUTHOR_ONLY'
      });
    }

    if (message.type === 'system') {
      return res.status(400).json({
        error: 'Системные сообщения нельзя редактировать',
        code: 'SYSTEM_MESSAGE_IMMUTABLE'
      });
    }

    if (message.deleted) {
      return res.status(409).json({
        error: 'Нельзя редактировать удалённое сообщение',
        code: 'MESSAGE_ALREADY_DELETED'
      });
    }

    if (isEditWindowExpired(message)) {
      return res.status(409).json({
        error: 'Срок редактирования сообщения истёк',
        code: 'EDIT_WINDOW_EXPIRED'
      });
    }

    if (!nextText && !message.attachment?.url) {
      return res.status(400).json({
        error: 'Текст сообщения не может быть пустым',
        code: 'MESSAGE_TEXT_EMPTY'
      });
    }

    if (nextText.length > 10000) {
      return res.status(400).json({
        error: 'Текст сообщения слишком длинный',
        code: 'MESSAGE_TEXT_TOO_LONG'
      });
    }

    if (nextText === String(message.text || '')) {
      const currentMessage = await populateMessage(message._id);
      return res.json({
        success: true,
        unchanged: true,
        message: currentMessage?.toObject?.() || null
      });
    }

    const now = new Date();
    const query = {
      _id: id,
      chat: chat._id,
      sender: userId,
      deleted: { $ne: true },
      type: { $ne: 'system' },
      createdAt: { $gte: new Date(Date.now() - EDIT_WINDOW_MS) }
    };
    applyMutationGuard(query, guard);

    const updatedMessageDoc = await Message.findOneAndUpdate(
      query,
      {
        $set: {
          text: nextText,
          edited: true,
          editedAt: now,
          updatedAt: now
        },
        $inc: { revision: 1 }
      },
      { new: true }
    );

    if (!updatedMessageDoc) {
      const failure = await resolveMutationFailure(id, userId, guard, { editWindow: true });
      return res.status(failure.status).json(failure.body);
    }

    await syncChatLastMessage(chat._id);
    const updatedMessage = await populateMessage(updatedMessageDoc._id);
    const payload = buildMutationPayload({
      action: 'updated',
      chatId: chat._id,
      userId,
      message: updatedMessage
    });

    emitMessageUpdated(req.app.get('io'), payload, userId);

    return res.json({
      success: true,
      eventId: payload.eventId,
      message: payload.message
    });
  } catch (error) {
    console.error('Edit message error:', error);
    return res.status(500).json({ error: 'Ошибка редактирования сообщения', code: 'MESSAGE_EDIT_FAILED' });
  }
});

async function handleDeleteMessage(req, res) {
  try {
    const messageId = req.params.messageId || req.params.id;
    const userId = req.userId;
    const requestedChatId = req.params.chatId || '';
    const scope = normalizeScope(req.body?.scope || req.query.scope);
    const guard = getMutationGuard(req);

    const { chat, message, error } = await loadAuthorizedMessage(messageId, userId);
    if (error) {
      return res.status(error.status).json(error.body);
    }

    if (requestedChatId && requestedChatId !== String(chat._id)) {
      return res.status(404).json({
        error: 'Сообщение не найдено в этом чате',
        code: 'MESSAGE_CHAT_MISMATCH'
      });
    }

    if (String(message.sender) !== String(userId)) {
      return res.status(403).json({
        error: 'Редактировать и удалять можно только свои сообщения',
        code: 'MESSAGE_AUTHOR_ONLY'
      });
    }

    if (scope === 'for_me') {
      const userObjectId = toObjectId(userId);
      const alreadyHidden = (message.deletedFor || []).some((entry) => String(entry) === String(userId));

      if (!userObjectId) {
        return res.status(400).json({ error: 'Некорректный пользователь', code: 'INVALID_USER_ID' });
      }

      if (message.deleted || alreadyHidden) {
        const currentMessage = await populateMessage(message._id);
        return res.json({
          success: true,
          unchanged: true,
          scope: message.deleted ? 'for_all' : 'for_me',
          messageId: String(message._id),
          message: currentMessage?.toObject?.() || null
        });
      }

      const now = new Date();
      const query = {
        _id: messageId,
        chat: chat._id,
        sender: userId,
        deleted: { $ne: true },
        deletedFor: { $ne: userObjectId }
      };
      applyMutationGuard(query, guard);

      const hiddenMessageDoc = await Message.findOneAndUpdate(
        query,
        {
          $addToSet: { deletedFor: userObjectId },
          $set: { updatedAt: now },
          $inc: { revision: 1 }
        },
        { new: true }
      );

      if (!hiddenMessageDoc) {
        const latestMessage = await Message.findById(messageId);
        if (latestMessage?.deleted) {
          const currentMessage = await populateMessage(messageId);
          return res.json({
            success: true,
            unchanged: true,
            scope: 'for_all',
            messageId: String(messageId),
            message: currentMessage?.toObject?.() || null
          });
        }

        if ((latestMessage?.deletedFor || []).some((entry) => String(entry) === String(userId))) {
          const currentMessage = await populateMessage(messageId);
          return res.json({
            success: true,
            unchanged: true,
            scope: 'for_me',
            messageId: String(messageId),
            message: currentMessage?.toObject?.() || null
          });
        }

        const failure = await resolveMutationFailure(messageId, userId, guard);
        return res.status(failure.status).json(failure.body);
      }

      const hiddenMessage = await populateMessage(hiddenMessageDoc._id);
      const payload = buildMutationPayload({
        action: 'deleted',
        chatId: chat._id,
        userId,
        scope: 'for_me',
        message: hiddenMessage
      });

      emitMessageDeleted(req.app.get('io'), payload, userId, { includeChatRoom: false });

      return res.json({
        success: true,
        eventId: payload.eventId,
        scope: 'for_me',
        messageId: String(hiddenMessageDoc._id),
        message: payload.message
      });
    }

    if (message.deleted) {
      const currentMessage = await populateMessage(message._id);
      return res.json({
        success: true,
        unchanged: true,
        scope: 'for_all',
        messageId: String(message._id),
        message: currentMessage?.toObject?.() || null
      });
    }

    const now = new Date();
    const query = {
      _id: messageId,
      chat: chat._id,
      sender: userId,
      deleted: { $ne: true }
    };
    applyMutationGuard(query, guard);

    const deletedMessageDoc = await Message.findOneAndUpdate(
      query,
      {
        $set: {
          deleted: true,
          deletedFor: [],
          text: '',
          edited: false,
          editedAt: null,
          attachment: null,
          updatedAt: now
        },
        $inc: { revision: 1 }
      },
      { new: true }
    );

    if (!deletedMessageDoc) {
      const failure = await resolveMutationFailure(messageId, userId, guard, { allowDeletedIdempotent: true });
      return res.status(failure.status).json(failure.body);
    }

    if (message.attachment?.url) {
      await scheduleFileCleanup(message.attachment.url, {
        reason: 'message_deleted',
        entityType: 'message',
        entityId: deletedMessageDoc._id
      });
    }

    await syncChatLastMessage(chat._id);
    const deletedMessage = await populateMessage(deletedMessageDoc._id);
    const payload = buildMutationPayload({
      action: 'deleted',
      chatId: chat._id,
      userId,
      scope: 'for_all',
      message: deletedMessage
    });

    emitMessageDeleted(req.app.get('io'), payload, userId, { includeChatRoom: true });

    return res.json({
      success: true,
      eventId: payload.eventId,
      scope: 'for_all',
      messageId: String(deletedMessageDoc._id),
      message: payload.message
    });
  } catch (error) {
    console.error('Delete message error:', error);
    return res.status(500).json({ error: 'Ошибка удаления сообщения', code: 'MESSAGE_DELETE_FAILED' });
  }
}

router.delete('/:id', handleDeleteMessage);
router.delete('/:chatId/:messageId', checkChatAccess, handleDeleteMessage);

module.exports = router;
