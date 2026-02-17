require('dotenv').config();

const mongoose = require('mongoose');
const { Worker, QueueEvents } = require('bullmq');
const config = require('../../config.local');
const Comment = require('../../models/Comment');
const Reaction = require('../../models/Reaction');
const { deletePostCommentCounter } = require('../services/postCommentCounterService');
const {
  SOCIAL_QUEUE_NAME,
  JOB,
  getRedisConnection
} = require('../services/queueService');
const {
  fanOutPostById,
  rebuildPostFeedById,
  rebuildFeedInBatches,
  removePostFromFeed
} = require('../services/feedService');
const {
  persistNotification,
  persistBulkNotifications
} = require('../services/notificationService');

async function cleanupPostArtifacts(postId) {
  if (!mongoose.Types.ObjectId.isValid(postId)) return { success: false };
  const postObjectId = new mongoose.Types.ObjectId(String(postId));

  const commentIds = [];
  const cursor = Comment.find({ postId: postObjectId })
    .select('_id')
    .lean()
    .cursor();

  for await (const row of cursor) {
    commentIds.push(row._id);
    if (commentIds.length >= 2000) {
      // eslint-disable-next-line no-await-in-loop
      await Reaction.deleteMany({
        targetType: 'comment',
        targetId: { $in: commentIds.splice(0, commentIds.length) }
      });
    }
  }

  if (commentIds.length) {
    await Reaction.deleteMany({
      targetType: 'comment',
      targetId: { $in: commentIds }
    });
  }

  await Comment.deleteMany({ postId: postObjectId });
  await Reaction.deleteMany({ targetType: 'post', targetId: postObjectId });
  await removePostFromFeed(postObjectId);
  await deletePostCommentCounter(postObjectId);

  return { success: true };
}

async function processJob(job) {
  switch (job.name) {
    case JOB.FEED_FANOUT_POST:
      return fanOutPostById(job.data?.postId);
    case JOB.FEED_REBUILD_POST:
      return rebuildPostFeedById(job.data?.postId);
    case JOB.FEED_REBUILD_ALL:
      return rebuildFeedInBatches({ batchSize: Number(job.data?.batchSize || 200) });
    case JOB.FEED_REMOVE_POST:
      return removePostFromFeed(job.data?.postId);
    case JOB.NOTIFICATION_CREATE:
      return persistNotification(job.data || {});
    case JOB.NOTIFICATION_BULK_CREATE:
      return persistBulkNotifications(job.data || {});
    case JOB.POST_CLEANUP:
      return cleanupPostArtifacts(job.data?.postId);
    default:
      return { skipped: true, reason: 'unknown_job' };
  }
}

async function run() {
  await mongoose.connect(config.MONGODB_URI);
  console.log('[SocialWorker] MongoDB connected');

  const connection = getRedisConnection();
  await connection.connect();
  console.log('[SocialWorker] Redis connected');

  const queueEvents = new QueueEvents(SOCIAL_QUEUE_NAME, { connection });
  queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error('[SocialWorker] job failed:', { jobId, failedReason });
  });
  await queueEvents.waitUntilReady();

  const worker = new Worker(
    SOCIAL_QUEUE_NAME,
    async (job) => processJob(job),
    {
      connection,
      concurrency: Number(process.env.SOCIAL_WORKER_CONCURRENCY || 8)
    }
  );

  worker.on('completed', (job) => {
    if (process.env.SOCIAL_WORKER_VERBOSE === '1') {
      console.log('[SocialWorker] completed:', job.id, job.name);
    }
  });

  worker.on('failed', (job, error) => {
    console.error('[SocialWorker] failed:', {
      id: job?.id,
      name: job?.name,
      error: error?.message || error
    });
  });

  const shutdown = async () => {
    console.log('[SocialWorker] shutdown...');
    await worker.close();
    await queueEvents.close();
    await mongoose.disconnect();
    await connection.quit();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

run().catch((error) => {
  console.error('[SocialWorker] fatal:', error);
  process.exit(1);
});
