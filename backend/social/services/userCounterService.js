const User = require('../../models/User');

const COUNTER_FIELDS = ['followers', 'following', 'friends', 'posts'];

function sanitizeDelta(delta) {
  const sanitized = {};
  COUNTER_FIELDS.forEach((field) => {
    const raw = delta?.[field];
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw === 0) return;
    sanitized[field] = Math.trunc(raw);
  });
  return sanitized;
}

async function incrementUserCounters(userId, delta) {
  const $inc = sanitizeDelta(delta);
  if (!userId || Object.keys($inc).length === 0) return { matchedCount: 0 };

  return User.updateOne(
    { _id: userId },
    { $inc }
  );
}

async function incrementManyCounters(ops) {
  const bulkOps = [];
  (ops || []).forEach((entry) => {
    const $inc = sanitizeDelta(entry?.delta);
    if (!entry?.userId || Object.keys($inc).length === 0) return;

    bulkOps.push({
      updateOne: {
        filter: { _id: entry.userId },
        update: { $inc }
      }
    });
  });

  if (!bulkOps.length) return { modifiedCount: 0 };
  return User.bulkWrite(bulkOps, { ordered: false });
}

module.exports = {
  incrementUserCounters,
  incrementManyCounters
};
