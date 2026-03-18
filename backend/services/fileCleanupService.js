const fs = require('fs');
const path = require('path');

const FileCleanupTask = require('../models/FileCleanupTask');

const uploadsDir = path.join(__dirname, '..', 'uploads');
const CLEANUP_DELAY_MS = 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 20;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

let cleanupTimer = null;
let cleanupInFlight = false;

function resolveUploadPath(fileUrl) {
  if (!fileUrl) return null;
  const filename = String(fileUrl).split('/').pop();
  if (!filename) return null;
  return path.join(uploadsDir, filename);
}

async function scheduleFileCleanup(fileUrl, {
  reason = 'message_deleted',
  entityType = 'message',
  entityId = null,
  delayMs = CLEANUP_DELAY_MS
} = {}) {
  if (!fileUrl) return null;

  return FileCleanupTask.findOneAndUpdate(
    {
      fileUrl,
      status: { $in: ['pending', 'processing'] }
    },
    {
      $setOnInsert: {
        fileUrl,
        reason,
        entityType,
        entityId,
        executeAfter: new Date(Date.now() + delayMs)
      }
    },
    {
      new: true,
      upsert: true
    }
  );
}

async function processPendingFileCleanupBatch() {
  if (cleanupInFlight) return 0;
  cleanupInFlight = true;

  try {
    const now = new Date();
    const tasks = await FileCleanupTask.find({
      status: 'pending',
      executeAfter: { $lte: now }
    })
      .sort({ executeAfter: 1, createdAt: 1 })
      .limit(CLEANUP_BATCH_SIZE);

    for (const task of tasks) {
      const filePath = resolveUploadPath(task.fileUrl);

      try {
        task.status = 'processing';
        task.attempts += 1;
        await task.save();

        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        task.status = 'completed';
        task.completedAt = new Date();
        task.lastError = '';
        await task.save();
      } catch (error) {
        task.status = 'failed';
        task.lastError = error?.message || String(error);
        await task.save();
      }
    }

    return tasks.length;
  } finally {
    cleanupInFlight = false;
  }
}

function startFileCleanupWorker() {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    processPendingFileCleanupBatch().catch((error) => {
      console.error('[FileCleanup] batch failed:', error);
    });
  }, CLEANUP_INTERVAL_MS);

  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }
}

module.exports = {
  CLEANUP_DELAY_MS,
  processPendingFileCleanupBatch,
  scheduleFileCleanup,
  startFileCleanupWorker
};
