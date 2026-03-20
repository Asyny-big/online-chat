const { monitorEventLoopDelay } = require('perf_hooks');

const REQUEST_SAMPLE_LIMIT = Math.max(Number(process.env.AI_REQUEST_SAMPLE_LIMIT || 200), 50);
const REQUEST_ROUTE_LIMIT = Math.max(Number(process.env.AI_REQUEST_ROUTE_LIMIT || 120), 20);
const REQUEST_SLOW_THRESHOLD_MS = Math.max(Number(process.env.AI_REQUEST_SLOW_THRESHOLD_MS || 800), 100);
const REQUEST_ERROR_SAMPLE_LIMIT = Math.max(Number(process.env.AI_REQUEST_ERROR_SAMPLE_LIMIT || 40), 10);
const RECENT_EVENT_LIMIT = Math.max(Number(process.env.AI_DIAGNOSTIC_EVENT_LIMIT || 200), 50);
const RECENT_EVENT_WINDOW_MS = Math.max(Number(process.env.AI_DIAGNOSTIC_EVENT_WINDOW_MS || 60 * 60 * 1000), 60 * 1000);
const SOCKET_RECONNECT_WINDOW_MS = Math.max(Number(process.env.AI_SOCKET_RECONNECT_WINDOW_MS || 90 * 1000), 5 * 1000);

const requestSamples = [];
const requestErrors = [];
const requestRoutes = new Map();
const recentEvents = [];
const lastDisconnectByUser = new Map();

const realtimeCounters = {
  connections: 0,
  disconnections: 0,
  reconnects: 0,
  droppedEvents: 0,
  activeSocketLeakWarnings: 0
};

const callCounters = {
  signalingDrops: 0,
  groupSignalingDrops: 0,
  livekitTokenErrors: 0
};

let eventLoopMonitor = null;
try {
  eventLoopMonitor = monitorEventLoopDelay({ resolution: 20 });
  eventLoopMonitor.enable();
} catch (_) {
  eventLoopMonitor = null;
}

function appendLimited(list, item, limit) {
  list.push(item);
  if (list.length > limit) {
    list.splice(0, list.length - limit);
  }
}

function normalizeNumber(value, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Number(number.toFixed(digits));
}

function nsToMs(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return normalizeNumber(number / 1e6, 1);
}

function sanitizePath(path) {
  const normalized = String(path || '').trim();
  if (!normalized) return '/unknown';
  return normalized.split('?')[0] || '/unknown';
}

function trimRoutesIfNeeded() {
  if (requestRoutes.size <= REQUEST_ROUTE_LIMIT) return;

  const sorted = Array.from(requestRoutes.entries())
    .sort((left, right) => Number(left[1]?.lastSeenAt || 0) - Number(right[1]?.lastSeenAt || 0));

  while (sorted.length > REQUEST_ROUTE_LIMIT) {
    const oldest = sorted.shift();
    if (!oldest) break;
    requestRoutes.delete(oldest[0]);
  }
}

function getRecentWindowEvents(type) {
  const cutoff = Date.now() - RECENT_EVENT_WINDOW_MS;
  return recentEvents.filter((entry) => entry.type === type && entry.atMs >= cutoff);
}

function recordEvent(type, payload = {}) {
  appendLimited(recentEvents, {
    type: String(type || 'unknown'),
    atMs: Date.now(),
    payload: payload && typeof payload === 'object' ? payload : {}
  }, RECENT_EVENT_LIMIT);
}

function buildRouteKey({ method, route }) {
  const normalizedMethod = String(method || 'GET').trim().toUpperCase();
  return `${normalizedMethod} ${sanitizePath(route)}`;
}

function recordRequest({ method, route, status, durationMs }) {
  const normalizedDurationMs = Math.max(Number(durationMs || 0), 0);
  const normalizedStatus = Math.max(Number(status || 0), 0);
  const routeKey = buildRouteKey({ method, route });
  const now = Date.now();
  const isError = normalizedStatus >= 500;
  const isSlow = normalizedDurationMs >= REQUEST_SLOW_THRESHOLD_MS;

  appendLimited(requestSamples, {
    routeKey,
    status: normalizedStatus,
    durationMs: normalizeNumber(normalizedDurationMs, 1),
    atMs: now
  }, REQUEST_SAMPLE_LIMIT);

  if (isError) {
    appendLimited(requestErrors, {
      routeKey,
      status: normalizedStatus,
      durationMs: normalizeNumber(normalizedDurationMs, 1),
      atMs: now
    }, REQUEST_ERROR_SAMPLE_LIMIT);
  }

  const existing = requestRoutes.get(routeKey) || {
    routeKey,
    count: 0,
    errorCount: 0,
    slowCount: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
    lastStatus: null,
    lastSeenAt: 0
  };

  existing.count += 1;
  existing.totalDurationMs += normalizedDurationMs;
  existing.maxDurationMs = Math.max(existing.maxDurationMs, normalizedDurationMs);
  existing.lastStatus = normalizedStatus || null;
  existing.lastSeenAt = now;
  if (isError) existing.errorCount += 1;
  if (isSlow) existing.slowCount += 1;

  requestRoutes.set(routeKey, existing);
  trimRoutesIfNeeded();
}

function createRequestMetricsMiddleware() {
  return function requestMetricsMiddleware(req, res, next) {
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const routePath = req.route?.path
        ? `${req.baseUrl || ''}${req.route.path}`
        : req.originalUrl || req.url || '/unknown';

      recordRequest({
        method: req.method,
        route: routePath,
        status: res.statusCode,
        durationMs
      });
    });

    next();
  };
}

function recordSocketConnect(userId) {
  realtimeCounters.connections += 1;
  const normalizedUserId = String(userId || '').trim();
  const lastDisconnectedAt = normalizedUserId ? Number(lastDisconnectByUser.get(normalizedUserId) || 0) : 0;
  const now = Date.now();

  if (lastDisconnectedAt && now - lastDisconnectedAt <= SOCKET_RECONNECT_WINDOW_MS) {
    realtimeCounters.reconnects += 1;
    recordEvent('socket_reconnect', { userId: normalizedUserId });
  } else {
    recordEvent('socket_connect', { userId: normalizedUserId });
  }
}

function recordSocketDisconnect(userId) {
  realtimeCounters.disconnections += 1;
  const normalizedUserId = String(userId || '').trim();
  if (normalizedUserId) {
    lastDisconnectByUser.set(normalizedUserId, Date.now());
  }
  recordEvent('socket_disconnect', { userId: normalizedUserId });
}

function recordSocketLeakWarning(userId, activeSockets) {
  realtimeCounters.activeSocketLeakWarnings += 1;
  recordEvent('socket_leak_warning', {
    userId: String(userId || '').trim(),
    activeSockets: Math.max(Number(activeSockets || 0), 0)
  });
}

function recordDroppedRealtimeEvent(type, payload = {}) {
  realtimeCounters.droppedEvents += 1;
  recordEvent(`realtime_${String(type || 'unknown')}`, payload);
}

function recordCallMetric(type, payload = {}) {
  const normalizedType = String(type || '').trim();
  if (!normalizedType) return;

  if (normalizedType === 'signaling_drop') {
    callCounters.signalingDrops += 1;
  } else if (normalizedType === 'group_signaling_drop') {
    callCounters.groupSignalingDrops += 1;
  } else if (normalizedType === 'livekit_token_error') {
    callCounters.livekitTokenErrors += 1;
  }

  recordEvent(`call_${normalizedType}`, payload);
}

function getEventLoopSnapshot() {
  if (!eventLoopMonitor) {
    return {
      enabled: false,
      meanMs: null,
      maxMs: null,
      p95Ms: null
    };
  }

  return {
    enabled: true,
    meanMs: nsToMs(eventLoopMonitor.mean),
    maxMs: nsToMs(eventLoopMonitor.max),
    p95Ms: typeof eventLoopMonitor.percentile === 'function'
      ? nsToMs(eventLoopMonitor.percentile(95))
      : null
  };
}

function getSystemSnapshot() {
  const memory = process.memoryUsage();
  const cpu = process.cpuUsage();

  return {
    uptimeSec: Math.floor(process.uptime()),
    memory: {
      rssMb: normalizeNumber(memory.rss / 1024 / 1024),
      heapUsedMb: normalizeNumber(memory.heapUsed / 1024 / 1024),
      heapTotalMb: normalizeNumber(memory.heapTotal / 1024 / 1024),
      externalMb: normalizeNumber(memory.external / 1024 / 1024)
    },
    cpu: {
      userMs: normalizeNumber(cpu.user / 1000, 0),
      systemMs: normalizeNumber(cpu.system / 1000, 0)
    },
    eventLoop: getEventLoopSnapshot()
  };
}

function getSlowRequestSnapshot(limit = 5) {
  const routes = Array.from(requestRoutes.values())
    .map((entry) => ({
      routeKey: entry.routeKey,
      count: entry.count,
      errorCount: entry.errorCount,
      slowCount: entry.slowCount,
      avgDurationMs: normalizeNumber(entry.totalDurationMs / Math.max(entry.count, 1), 1),
      maxDurationMs: normalizeNumber(entry.maxDurationMs, 1),
      lastStatus: entry.lastStatus,
      lastSeenAt: entry.lastSeenAt
    }))
    .sort((left, right) => {
      const slowDelta = Number(right.slowCount || 0) - Number(left.slowCount || 0);
      if (slowDelta !== 0) return slowDelta;
      return Number(right.avgDurationMs || 0) - Number(left.avgDurationMs || 0);
    })
    .slice(0, limit);

  return {
    totalRequests: requestSamples.length,
    errorRequests: requestErrors.length,
    thresholdMs: REQUEST_SLOW_THRESHOLD_MS,
    topRoutes: routes,
    recentErrors: requestErrors.slice(-limit).reverse()
  };
}

function getRealtimeSnapshot({ activeUsers = 0, socketConnections = 0 } = {}) {
  const reconnectsRecent = getRecentWindowEvents('socket_reconnect').length;
  const disconnectsRecent = getRecentWindowEvents('socket_disconnect').length;
  const droppedRecent = recentEvents
    .filter((entry) => entry.type.startsWith('realtime_') && entry.atMs >= Date.now() - RECENT_EVENT_WINDOW_MS)
    .length;

  return {
    activeUsers: Math.max(Number(activeUsers || 0), 0),
    socketConnections: Math.max(Number(socketConnections || 0), 0),
    counters: { ...realtimeCounters },
    recentWindow: {
      reconnects: reconnectsRecent,
      disconnects: disconnectsRecent,
      droppedEvents: droppedRecent,
      windowMs: RECENT_EVENT_WINDOW_MS
    }
  };
}

function getCallSnapshot() {
  const signalingDropsRecent = getRecentWindowEvents('call_signaling_drop').length;
  const groupSignalingDropsRecent = getRecentWindowEvents('call_group_signaling_drop').length;
  const livekitErrorsRecent = getRecentWindowEvents('call_livekit_token_error').length;

  return {
    counters: { ...callCounters },
    recentWindow: {
      signalingDrops: signalingDropsRecent,
      groupSignalingDrops: groupSignalingDropsRecent,
      livekitTokenErrors: livekitErrorsRecent,
      windowMs: RECENT_EVENT_WINDOW_MS
    }
  };
}

module.exports = {
  REQUEST_SLOW_THRESHOLD_MS,
  createRequestMetricsMiddleware,
  recordRequest,
  recordSocketConnect,
  recordSocketDisconnect,
  recordSocketLeakWarning,
  recordDroppedRealtimeEvent,
  recordCallMetric,
  getSystemSnapshot,
  getSlowRequestSnapshot,
  getRealtimeSnapshot,
  getCallSnapshot
};
