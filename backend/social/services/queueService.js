const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const SOCIAL_QUEUE_NAME = process.env.SOCIAL_QUEUE_NAME || 'social_background';

const JOB = {
  FEED_FANOUT_POST: 'feed_fanout_post',
  FEED_REBUILD_POST: 'feed_rebuild_post',
  FEED_REBUILD_ALL: 'feed_rebuild_all',
  FEED_REMOVE_POST: 'feed_remove_post',
  NOTIFICATION_CREATE: 'notification_create',
  NOTIFICATION_BULK_CREATE: 'notification_bulk_create',
  POST_CLEANUP: 'post_cleanup'
};

let queue = null;
let redis = null;

function getRedisConfig() {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: true
  };
}

function getRedisConnection() {
  if (redis) return redis;
  const redisConfig = getRedisConfig();
  redis = typeof redisConfig === 'string'
    ? new IORedis(redisConfig, { lazyConnect: true, maxRetriesPerRequest: null })
    : new IORedis({ ...redisConfig, lazyConnect: true });
  redis.on('error', (error) => {
    console.error('[Social][Queue] Redis error:', error?.message || error);
  });
  return redis;
}

function getSocialQueue() {
  if (queue) return queue;
  queue = new Queue(SOCIAL_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 500 },
      removeOnComplete: 1000,
      removeOnFail: 1000
    }
  });
  return queue;
}

async function enqueueJob(name, data, opts = {}) {
  try {
    const q = getSocialQueue();
    await q.add(name, data, opts);
    return true;
  } catch (error) {
    console.error(`[Social][Queue] enqueue ${name} failed:`, error?.message || error);
    return false;
  }
}

function safeJobIdPart(value) {
  return String(value ?? '').replace(/:/g, '-');
}

function enqueueFeedFanoutPost(postId) {
  const postPart = safeJobIdPart(postId);
  return enqueueJob(JOB.FEED_FANOUT_POST, { postId }, {
    jobId: `${JOB.FEED_FANOUT_POST}-${postPart}`
  });
}

function enqueueFeedRebuildPost(postId) {
  const postPart = safeJobIdPart(postId);
  return enqueueJob(JOB.FEED_REBUILD_POST, { postId }, {
    jobId: `${JOB.FEED_REBUILD_POST}-${postPart}`
  });
}

function enqueueFeedRebuildAll(payload = {}) {
  const batchSize = Number(payload.batchSize || 200);
  return enqueueJob(JOB.FEED_REBUILD_ALL, { batchSize });
}

function enqueueFeedRemovePost(postId) {
  const postPart = safeJobIdPart(postId);
  return enqueueJob(JOB.FEED_REMOVE_POST, { postId }, {
    jobId: `${JOB.FEED_REMOVE_POST}-${postPart}`
  });
}

function enqueueNotificationCreate(payload) {
  const targetPart = safeJobIdPart(payload?.targetId || '');
  const userPart = safeJobIdPart(payload?.userId || '');
  const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return enqueueJob(JOB.NOTIFICATION_CREATE, payload, {
    jobId: `${JOB.NOTIFICATION_CREATE}-${userPart}-${targetPart}-${uniquePart}`
  });
}

function enqueueNotificationBulkCreate(payload) {
  const targetPart = safeJobIdPart(payload?.targetId || '');
  const actorPart = safeJobIdPart(payload?.actorId || '');
  const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return enqueueJob(JOB.NOTIFICATION_BULK_CREATE, payload, {
    jobId: `${JOB.NOTIFICATION_BULK_CREATE}-${actorPart}-${targetPart}-${uniquePart}`
  });
}

function enqueuePostCleanup(payload) {
  return enqueueJob(JOB.POST_CLEANUP, payload, {
    jobId: `${JOB.POST_CLEANUP}:${String(payload?.postId || '')}`
  });
}

module.exports = {
  SOCIAL_QUEUE_NAME,
  JOB,
  getRedisConnection,
  enqueueFeedFanoutPost,
  enqueueFeedRebuildPost,
  enqueueFeedRebuildAll,
  enqueueFeedRemovePost,
  enqueueNotificationCreate,
  enqueueNotificationBulkCreate,
  enqueuePostCleanup
};
