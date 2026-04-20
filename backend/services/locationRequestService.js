const crypto = require('crypto');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const LocationPermission = require('../models/LocationPermission');
const UserDevice = require('../models/UserDevice');
const { buildLastMessagePayload } = require('./messageStateService');

const LOCATION_REQUEST_TTL_MS = Number(process.env.LOCATION_REQUEST_TTL_MS || 45_000);
const LOCATION_REQUEST_RATE_LIMIT_MS = Number(process.env.LOCATION_REQUEST_RATE_LIMIT_MS || 60_000);
const MAX_LOCATION_AGE_MS = Number(process.env.LOCATION_MAX_AGE_MS || 30_000);
const MAX_ACCEPTED_ACCURACY_METERS = Number(process.env.LOCATION_MAX_ACCURACY_METERS || 500);

const pendingRequests = new Map();
const lastRequestAtByPair = new Map();

const LOCATION_FAILURES = {
  LOCATION_PERMISSION_DENIED: 'Location access is not granted',
  LOCATION_TARGET_OFFLINE: 'Target user has no online Android client',
  LOCATION_REQUEST_CONFLICT: 'Location request is already pending',
  LOCATION_RATE_LIMIT: 'Too many location requests'
};

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
  console.info('[Location] request cleanup', {
    requestId,
    reason,
    chatId: entry.chatId,
    requesterUserId: entry.requesterUserId,
    targetUserId: entry.targetUserId
  });
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

function buildFetchPayload(entry) {
  return {
    requestId: entry.requestId,
    chatId: entry.chatId,
    requester: {
      _id: entry.requesterUserId,
      name: entry.requesterName || 'Contact'
    },
    expiresAt: entry.expiresAt,
    requestedAt: entry.createdAt
  };
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

async function hasAndroidDeliveryTarget({ io, userSockets, userId }) {
  const liveSocketIds = getLiveAndroidSocketIdsForUser({ io, userSockets, userId });
  if (liveSocketIds.length > 0) {
    return {
      targetAvailable: true,
      targetSocketIds: liveSocketIds,
      hasPushTarget: true
    };
  }

  const hasPushTarget = Boolean(await UserDevice.exists({
    userId: normalizeId(userId),
    platform: 'android'
  }));

  return {
    targetAvailable: hasPushTarget,
    targetSocketIds: [],
    hasPushTarget
  };
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

function mapDeviceFailureCode(rawCode) {
  const code = normalizeId(rawCode);
  switch (code) {
    case 'DEVICE_LOCATION_PERMISSION_DENIED':
      return 'LOCATION_PERMISSION_DENIED';
    case 'DEVICE_LOCATION_DISABLED':
      return 'LOCATION_SERVICES_DISABLED';
    case 'DEVICE_LOCATION_LOW_ACCURACY':
      return 'LOCATION_ACCURACY_TOO_LOW';
    case 'DEVICE_LOCATION_UNAVAILABLE':
      return 'LOCATION_UNAVAILABLE';
    default:
      return code || 'LOCATION_UNAVAILABLE';
  }
}

function buildRequestFailure(status, code, extra = {}) {
  return {
    ok: false,
    status,
    body: {
      error: extra.error || LOCATION_FAILURES[code] || code,
      code,
      ...extra
    }
  };
}

async function getLocationRequestAvailability({
  io,
  userSockets,
  requesterUserId,
  targetUserId
}) {
  const requester = normalizeId(requesterUserId);
  const target = normalizeId(targetUserId);
  const permission = await LocationPermission.findOne({
    ownerUser: target,
    allowedUser: requester,
    enabled: true,
    revokedAt: null
  }).lean();

  const existingPending = findPendingPair(requester, target);
  const pairKey = makePairKey(requester, target);
  const previousRequestAt = lastRequestAtByPair.get(pairKey) || 0;
  const retryAfterMs = previousRequestAt + LOCATION_REQUEST_RATE_LIMIT_MS - Date.now();
  const delivery = await hasAndroidDeliveryTarget({ io, userSockets, userId: target });

  let requestDisabledReason = '';
  if (existingPending) {
    requestDisabledReason = 'LOCATION_REQUEST_CONFLICT';
  } else if (retryAfterMs > 0) {
    requestDisabledReason = 'LOCATION_RATE_LIMIT';
  } else if (!delivery.targetAvailable) {
    requestDisabledReason = 'LOCATION_TARGET_OFFLINE';
  }

  return {
    canRequestTarget: Boolean(permission),
    requiresPermissionApproval: !permission,
    targetAvailable: delivery.targetAvailable,
    targetSocketCount: delivery.targetSocketIds.length,
    targetRealtimeAvailable: delivery.targetSocketIds.length > 0,
    targetHasPushTarget: delivery.hasPushTarget,
    hasPendingRequest: Boolean(existingPending),
    pendingRequestId: existingPending?.requestId || null,
    pendingExpiresAt: existingPending?.expiresAt || null,
    retryAfterSeconds: retryAfterMs > 0 ? Math.ceil(retryAfterMs / 1000) : 0,
    requestAllowed: !requestDisabledReason,
    requestDisabledReason: requestDisabledReason || null,
    requestDisabledMessage: requestDisabledReason ? (LOCATION_FAILURES[requestDisabledReason] || requestDisabledReason) : null
  };
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

  const availability = await getLocationRequestAvailability({
    io,
    userSockets,
    requesterUserId,
    targetUserId
  });

  if (availability.hasPendingRequest) {
    console.warn('[Location] request rejected', {
      reason: 'conflict',
      chatId,
      requesterUserId,
      targetUserId,
      requestId: availability.pendingRequestId,
      expiresAt: availability.pendingExpiresAt
    });
    return buildRequestFailure(409, 'LOCATION_REQUEST_CONFLICT', {
      requestId: availability.pendingRequestId,
      expiresAt: availability.pendingExpiresAt
    });
  }

  if (availability.retryAfterSeconds > 0) {
    console.warn('[Location] request rejected', {
      reason: 'rate_limit',
      chatId,
      requesterUserId,
      targetUserId,
      retryAfterSeconds: availability.retryAfterSeconds
    });
    return buildRequestFailure(429, 'LOCATION_RATE_LIMIT', {
      retryAfterSeconds: availability.retryAfterSeconds
    });
  }

  if (!availability.targetAvailable) {
    console.warn('[Location] request rejected', {
      reason: 'target_offline',
      chatId,
      requesterUserId,
      targetUserId
    });
    return buildRequestFailure(409, 'LOCATION_TARGET_OFFLINE');
  }

  const requestId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCATION_REQUEST_TTL_MS).toISOString();
  const requesterName = requesterUser?.name || 'Contact';
  const pairKey = makePairKey(requesterUserId, targetUserId);

  const entry = {
    requestId,
    chatId,
    requesterUserId,
    targetUserId,
    requesterName,
    createdAt: now.toISOString(),
    expiresAt,
    io,
    deliveredSocketIds: new Set(),
    timeout: setTimeout(() => cleanupPendingRequest(requestId, 'expired'), LOCATION_REQUEST_TTL_MS)
  };
  pendingRequests.set(requestId, entry);
  lastRequestAtByPair.set(pairKey, now.getTime());
  console.info('[Location] request created', {
    requestId,
    chatId,
    requesterUserId,
    targetUserId,
    expiresAt,
    targetSocketCount: availability.targetSocketCount,
    requiresPermissionApproval: availability.requiresPermissionApproval,
    targetRealtimeAvailable: availability.targetRealtimeAvailable
  });

  await LocationPermission.updateOne(
    { ownerUser: targetUserId, allowedUser: requesterUserId },
    {
      $set: { lastRequestedAt: now },
      $inc: { requestCount: 1 }
    }
  );

  await flushPendingLocationRequestsForUser({
    io,
    userSockets,
    userId: targetUserId
  });

  io.to(`user:${requesterUserId}`).emit('location:request:started', {
    requestId,
    chatId,
    targetUserId,
    expiresAt,
    requiresPermissionApproval: availability.requiresPermissionApproval,
    targetRealtimeAvailable: availability.targetRealtimeAvailable
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
    body: {
      success: true,
      requestId,
      expiresAt,
      requiresPermissionApproval: availability.requiresPermissionApproval,
      targetRealtimeAvailable: availability.targetRealtimeAvailable
    }
  };
}

async function flushPendingLocationRequestsForUser({
  io,
  userSockets,
  userId,
  socketId = null
}) {
  const normalizedUserId = normalizeId(userId);
  if (!normalizedUserId) return [];

  const liveSocketIds = getLiveAndroidSocketIdsForUser({ io, userSockets, userId: normalizedUserId });
  const targetSocketIds = socketId
    ? liveSocketIds.filter((candidate) => candidate === socketId)
    : liveSocketIds;

  if (targetSocketIds.length === 0) return [];

  const deliveredRequestIds = [];
  for (const entry of pendingRequests.values()) {
    if (entry.targetUserId !== normalizedUserId) continue;
    if (Date.parse(entry.expiresAt || '') <= Date.now()) {
      cleanupPendingRequest(entry.requestId, 'expired');
      continue;
    }

    const fetchPayload = buildFetchPayload(entry);
    targetSocketIds.forEach((targetSocketId) => {
      if (entry.deliveredSocketIds?.has?.(targetSocketId)) return;
      entry.deliveredSocketIds?.add?.(targetSocketId);
      console.info('[Location] request emitted', {
        requestId: entry.requestId,
        socketId: targetSocketId,
        targetUserId: normalizedUserId,
        replay: true
      });
      io.to(targetSocketId).emit('location:fetch', fetchPayload);
      deliveredRequestIds.push(entry.requestId);
    });
  }

  return deliveredRequestIds;
}

async function handleLocationResponse({ io, socket, userId, payload }) {
  const requestId = normalizeId(payload?.requestId);
  console.info('[Location] response received', {
    requestId,
    responderUserId: normalizeId(userId),
    success: payload?.success !== false,
    code: payload?.code || payload?.reason || null
  });
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
    const code = mapDeviceFailureCode(payload?.code || payload?.reason).slice(0, 80);
    console.warn('[Location] response failed', {
      requestId,
      chatId: entry.chatId,
      requesterUserId: entry.requesterUserId,
      targetUserId: entry.targetUserId,
      code
    });
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
    console.warn('[Location] response validation failed', {
      requestId,
      chatId: entry.chatId,
      requesterUserId: entry.requesterUserId,
      targetUserId: entry.targetUserId,
      code: validation.code
    });
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
  console.info('[Location] response accepted', {
    requestId,
    chatId: entry.chatId,
    requesterUserId: entry.requesterUserId,
    targetUserId: entry.targetUserId
  });

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
  findPendingPair,
  getLocationRequestAvailability,
  getParticipantUserId,
  getLiveAndroidSocketIdsForUser,
  flushPendingLocationRequestsForUser,
  startLocationRequest,
  handleLocationResponse
};
