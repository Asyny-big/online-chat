const mongoose = require('mongoose');
const Chat = require('../../models/Chat');

function toObjectIdOrFail(value, fieldName) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    const error = new Error(`Invalid ${fieldName}`);
    error.statusCode = 400;
    throw error;
  }
  return new mongoose.Types.ObjectId(value);
}

function isUserOnlineBySockets(app, candidateUserId) {
  const io = app?.get?.('io');
  const socketData = app?.get?.('socketData');
  const userSockets = socketData?.userSockets;
  const key = String(candidateUserId || '');
  if (!key) return false;

  const sockets = userSockets?.get?.(key);
  if (!sockets || sockets.size === 0) return false;

  let alive = 0;
  sockets.forEach((socketId) => {
    if (io?.sockets?.sockets?.get?.(socketId)) {
      alive += 1;
    } else {
      sockets.delete(socketId);
    }
  });

  if (sockets.size === 0) {
    userSockets?.delete?.(key);
  }

  return alive > 0;
}

function toPlainObject(chat) {
  if (!chat) return null;
  if (typeof chat.toObject === 'function') return chat.toObject();
  return { ...chat };
}

function resolveParticipantUser(participant) {
  if (!participant) return null;
  if (participant.user && typeof participant.user === 'object') return participant.user;
  return null;
}

function formatChatForUser({ app, chat, viewerUserId }) {
  const plain = toPlainObject(chat);
  if (!plain) return null;

  const viewerId = String(viewerUserId || '');
  const payload = {
    ...plain,
    dialogType: plain.type === 'private' ? 'direct' : plain.type,
    unreadCount: Number(plain.unreadCount || 0)
  };

  if (plain.type === 'private') {
    const otherParticipant = (plain.participants || []).find((item) => {
      const participantId = item?.user?._id?.toString?.() || item?.user?.toString?.() || '';
      return participantId && participantId !== viewerId;
    });
    const otherUser = resolveParticipantUser(otherParticipant);

    payload.displayName = otherUser?.name || plain.displayName || 'User';
    payload.displayPhone = otherUser?.phone || plain.displayPhone || '';
    payload.displayAvatar = otherUser?.avatarUrl || plain.displayAvatar || null;
    payload.displayStatus = otherUser?._id
      ? (isUserOnlineBySockets(app, otherUser._id) ? 'online' : 'offline')
      : 'offline';
    payload.displayLastSeen = otherUser?.lastSeen || null;
    return payload;
  }

  payload.displayName = plain.name || plain.displayName || 'Group';
  payload.displayAvatar = plain.avatarUrl || plain.displayAvatar || null;
  payload.participantCount = Array.isArray(plain.participants) ? plain.participants.length : 0;
  return payload;
}

async function ensureDirectChat({ userAId, userBId }) {
  const userA = toObjectIdOrFail(userAId, 'userAId');
  const userB = toObjectIdOrFail(userBId, 'userBId');

  const { chat, created } = await Chat.findOrCreatePrivateChat(userA, userB);
  await chat.populate('participants.user', '_id name phone avatarUrl status lastSeen');

  return { chat, created };
}

module.exports = {
  formatChatForUser,
  ensureDirectChat
};
