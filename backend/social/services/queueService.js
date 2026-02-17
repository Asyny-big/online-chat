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

function enqueueFeedFanoutPost(postId) {
  return enqueueJob(JOB.FEED_FANOUT_POST, { postId }, {
    jobId: `${JOB.FEED_FANOUT_POST}:${String(postId)}`
  });
}

function enqueueFeedRebuildPost(postId) {
  return enqueueJob(JOB.FEED_REBUILD_POST, { postId }, {
    jobId: `${JOB.FEED_REBUILD_POST}:${String(postId)}`
  });
}

function enqueueFeedRebuildAll(payload = {}) {
  const batchSize = Number(payload.batchSize || 200);
  return enqueueJob(JOB.FEED_REBUILD_ALL, { batchSize });
}

function enqueueFeedRemovePost(postId) {
  return enqueueJob(JOB.FEED_REMOVE_POST, { postId }, {
    jobId: `${JOB.FEED_REMOVE_POST}:${String(postId)}`
  });
}

function enqueueNotificationCreate(payload) {
  const targetPart = String(payload?.targetId || '');
  const userPart = String(payload?.userId || '');
  return enqueueJob(JOB.NOTIFICATION_CREATE, payload, {
    jobId: `${JOB.NOTIFICATION_CREATE}:${userPart}:${targetPart}:${Date.now()}`
  });
}

function enqueueNotificationBulkCreate(payload) {
  return enqueueJob(JOB.NOTIFICATION_BULK_CREATE, payload);
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
