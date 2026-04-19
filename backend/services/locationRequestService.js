const crypto = require('crypto');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const LocationPermission = require('../models/LocationPermission');
const { buildLastMessagePayload } = require('./messageStateService');

const LOCATION_REQUEST_TTL_MS = Number(process.env.LOCATION_REQUEST_TTL_MS || 45_000);
const LOCATION_REQUEST_RATE_LIMIT_MS = Number(process.env.LOCATION_REQUEST_RATE_LIMIT_MS || 60_000);
const MAX_LOCATION_AGE_MS = Number(process.env.LOCATION_MAX_AGE_MS || 30_000);
const MAX_ACCEPTED_ACCURACY_METERS = Number(process.env.LOCATION_MAX_ACCURACY_METERS || 500);

const pendingRequests = new Map();
const lastRequestAtByPair = new Map();

function normalizeId(value) {
  return String(value || '').trim();
}

function getParticipantUserId(participant) {
  return normalizeId(
    participant?.user?._id?.toString?.()
      || participant?.user?.toString?.()
      || participant?.user
  );
}

function makePairKey(requesterUserId, targetUserId) {
  return `${normalizeId(requesterUserId)}:${normalizeId(targetUserId)}`;
}

function cleanupPendingRequest(requestId, reason = 'expired') {
  const entry = pendingRequests.get(requestId);
  if (!entry) return null;
  if (entry.timeout) clearTimeout(entry.timeout);
  pendingRequests.delete(requestId);
  if (reason === 'expired') {
    entry.io.to(`user:${entry.requesterUserId}`).emit('location:request:failed', {
      requestId,
      chatId: entry.chatId,
      targetUserId: entry.targetUserId,
      code: 'LOCATION_REQUEST_EXPIRED',
      error: 'Location request expired'
    });
  }
  return entry;
}

function getLiveAndroidSocketIdsForUser({ io, userSockets, userId }) {
  const key = normalizeId(userId);
  if (!key) return [];

  const socketIds = userSockets?.get?.(key);
  if (!socketIds || socketIds.size === 0) return [];

  const liveAndroidSocketIds = [];
  socketIds.forEach((socketId) => {
    const socket = io.sockets?.sockets?.get?.(socketId);
    if (!socket) {
      socketIds.delete(socketId);
      return;
    }

    const platform = normalizeId(socket.data?.platform || socket.platform).toLowerCase();
    const supportsLocation = socket.data?.supportsOnDemandLocation === true
      || socket.supportsOnDemandLocation === true;
    if (platform === 'android' && supportsLocation) {
      liveAndroidSocketIds.push(socketId);
    }
  });

  if (socketIds.size === 0) {
    userSockets?.delete?.(key);
  }

  return liveAndroidSocketIds;
}

function findPendingPair(requesterUserId, targetUserId) {
  const requester = normalizeId(requesterUserId);
  const target = normalizeId(targetUserId);
  for (const entry of pendingRequests.values()) {
    if (entry.requesterUserId === requester && entry.targetUserId === target) {
      return entry;
    }
  }
  return null;
}

function validateLocationPayload(location) {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  const accuracyMeters = Number(location?.accuracyMeters ?? location?.accuracy);
  const capturedAtRaw = location?.capturedAt || location?.timestamp || null;
  const capturedAt = capturedAtRaw ? new Date(capturedAtRaw) : new Date();

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { ok: false, code: 'INVALID_LOCATION_LATITUDE' };
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, code: 'INVALID_LOCATION_LONGITUDE' };
  }
  if (!Number.isFinite(accuracyMeters) || accuracyMeters <= 0) {
    return { ok: false, code: 'INVALID_LOCATION_ACCURACY' };
  }
  if (accuracyMeters > MAX_ACCEPTED_ACCURACY_METERS) {
    return { ok: false, code: 'LOCATION_ACCURACY_TOO_LOW' };
  }
  if (Number.isNaN(capturedAt.getTime())) {
    return { ok: false, code: 'INVALID_LOCATION_CAPTURED_AT' };
  }
  if (Date.now() - capturedAt.getTime() > MAX_LOCATION_AGE_MS) {
    return { ok: false, code: 'LOCATION_TOO_OLD' };
  }

  const optionalNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return {
    ok: true,
    location: {
      latitude,
      longitude,
      accuracyMeters,
      altitudeMeters: optionalNumber(location?.altitudeMeters ?? location?.altitude),
      headingDegrees: optionalNumber(location?.headingDegrees ?? location?.bearing),
      speedMetersPerSecond: optionalNumber(location?.speedMetersPerSecond ?? location?.speed),
      provider: normalizeId(location?.provider || 'fused').slice(0, 40),
      capturedAt
    }
  };
}

async function startLocationRequest({
  io,
  userSockets,
  chat,
  requesterUser,
  targetUser,
  notificationService
}) {
  const requesterUserId = normalizeId(requesterUser?._id || requesterUser);
  const targetUserId = normalizeId(targetUser?._id || targetUser);
  const chatId = normalizeId(chat?._id || chat);

  if (!requesterUserId || !targetUserId || !chatId || requesterUserId === targetUserId) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Invalid location request', code: 'INVALID_LOCATION_REQUEST' }
    };
  }

  const permission = await LocationPermission.findOne({
    ownerUser: targetUserId,
    allowedUser: requesterUserId,
    enabled: true,
    revokedAt: null
  }).lean();
  if (!permission) {
    return {
      ok: false,
      status: 403,
      body: { error: 'Location access is not granted', code: 'LOCATION_ACCESS_DENIED' }
    };
  }

  const existingPending = findPendingPair(requesterUserId, targetUserId);
  if (existingPending) {
    return {
      ok: false,
      status: 409,
      body: {
        error: 'Location request is already pending',
        code: 'LOCATION_REQUEST_PENDING',
        requestId: existingPending.requestId,
        expiresAt: existingPending.expiresAt
      }
    };
  }

  const pairKey = makePairKey(requesterUserId, targetUserId);
  const previousRequestAt = lastRequestAtByPair.get(pairKey) || 0;
  const retryAfterMs = previousRequestAt + LOCATION_REQUEST_RATE_LIMIT_MS - Date.now();
  if (retryAfterMs > 0) {
    return {
      ok: false,
      status: 429,
      body: {
        error: 'Too many location requests',
        code: 'LOCATION_RATE_LIMITED',
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000)
      }
    };
  }

  const targetSocketIds = getLiveAndroidSocketIdsForUser({ io, userSockets, userId: targetUserId });
  if (targetSocketIds.length === 0) {
    return {
      ok: false,
      status: 409,
      body: {
        error: 'Target user has no online Android client',
        code: 'LOCATION_TARGET_UNAVAILABLE'
      }
    };
  }

  const requestId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCATION_REQUEST_TTL_MS).toISOString();
  const requesterName = requesterUser?.name || 'Contact';

  const entry = {
    requestId,
    chatId,
    requesterUserId,
    targetUserId,
    createdAt: now.toISOString(),
    expiresAt,
    io,
    timeout: setTimeout(() => cleanupPendingRequest(requestId, 'expired'), LOCATION_REQUEST_TTL_MS)
  };
  pendingRequests.set(requestId, entry);
  lastRequestAtByPair.set(pairKey, now.getTime());

  await LocationPermission.updateOne(
    { ownerUser: targetUserId, allowedUser: requesterUserId },
    {
      $set: { lastRequestedAt: now },
      $inc: { requestCount: 1 }
    }
  );

  const fetchPayload = {
    requestId,
    chatId,
    requester: {
      _id: requesterUserId,
      name: requesterName
    },
    expiresAt,
    requestedAt: now.toISOString()
  };
  targetSocketIds.forEach((socketId) => {
    io.to(socketId).emit('location:fetch', fetchPayload);
  });

  io.to(`user:${requesterUserId}`).emit('location:request:started', {
    requestId,
    chatId,
    targetUserId,
    expiresAt
  });

  Promise.resolve(
    notificationService?.sendLocationRequestNotification?.({
      targetUserId,
      requesterUserId,
      requesterName,
      chatId,
      requestId
    })
  ).catch((error) => {
    console.warn('[Location] push notification failed:', error?.message || error);
  });

  return {
    ok: true,
    status: 202,
    body: { success: true, requestId, expiresAt }
  };
}

async function handleLocationResponse({ io, socket, userId, payload }) {
  const requestId = normalizeId(payload?.requestId);
  if (!requestId) {
    socket.emit('location:response:ack', {
      success: false,
      code: 'LOCATION_REQUEST_ID_REQUIRED'
    });
    return;
  }

  const entry = pendingRequests.get(requestId);
  if (!entry) {
    socket.emit('location:response:ack', {
      success: false,
      requestId,
      code: 'LOCATION_REQUEST_NOT_FOUND'
    });
    return;
  }

  if (normalizeId(userId) !== entry.targetUserId) {
    socket.emit('location:response:ack', {
      success: false,
      requestId,
      code: 'LOCATION_RESPONSE_FORBIDDEN'
    });
    return;
  }

  if (payload?.success === false) {
    cleanupPendingRequest(requestId, 'failed');
    const code = normalizeId(payload?.code || payload?.reason || 'LOCATION_UNAVAILABLE').slice(0, 80);
    io.to(`user:${entry.requesterUserId}`).emit('location:request:failed', {
      requestId,
      chatId: entry.chatId,
      targetUserId: entry.targetUserId,
      code,
      error: payload?.error || 'Location unavailable'
    });
    socket.emit('location:response:ack', { success: true, requestId });
    return;
  }

  const validation = validateLocationPayload(payload?.location || payload);
  if (!validation.ok) {
    cleanupPendingRequest(requestId, 'failed');
    io.to(`user:${entry.requesterUserId}`).emit('location:request:failed', {
      requestId,
      chatId: entry.chatId,
      targetUserId: entry.targetUserId,
      code: validation.code,
      error: validation.code
    });
    socket.emit('location:response:ack', { success: false, requestId, code: validation.code });
    return;
  }

  cleanupPendingRequest(requestId, 'completed');

  const message = await Message.create({
    chat: entry.chatId,
    sender: entry.targetUserId,
    type: 'location',
    text: '',
    location: {
      ...validation.location,
      requestId,
      requestedBy: entry.requesterUserId
    },
    readBy: [{ user: entry.targetUserId }]
  });

  await message.populate('sender', 'name phone avatarUrl');

  const lastMessage = buildLastMessagePayload(message);
  await Chat.findByIdAndUpdate(entry.chatId, {
    $set: {
      lastMessage,
      updatedAt: new Date()
    }
  });

  const responseMessage = message.toObject();
  io.to(`chat:${entry.chatId}`).emit('message:new', {
    chatId: entry.chatId,
    message: responseMessage
  });
  io.to(`chat:${entry.chatId}`).emit('new_message', {
    chatId: entry.chatId,
    message: responseMessage
  });
  io.to(`user:${entry.requesterUserId}`).emit('location:request:completed', {
    requestId,
    chatId: entry.chatId,
    message: responseMessage
  });

  socket.emit('location:response:ack', {
    success: true,
    requestId,
    messageId: normalizeId(message._id)
  });
}

module.exports = {
  LOCATION_REQUEST_RATE_LIMIT_MS,
  LOCATION_REQUEST_TTL_MS,
  getParticipantUserId,
  getLiveAndroidSocketIdsForUser,
  startLocationRequest,
  handleLocationResponse
};
