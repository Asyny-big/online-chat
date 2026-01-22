const mongoose = require('mongoose');

function isTransientTxnError(err) {
  if (typeof err?.hasErrorLabel === 'function' && err.hasErrorLabel('TransientTransactionError')) return true;
  const labels = err?.errorLabels || err?.labels;
  return Array.isArray(labels) && labels.includes('TransientTransactionError');
}

function isUnknownCommitResult(err) {
  if (typeof err?.hasErrorLabel === 'function' && err.hasErrorLabel('UnknownTransactionCommitResult')) return true;
  const labels = err?.errorLabels || err?.labels;
  return Array.isArray(labels) && labels.includes('UnknownTransactionCommitResult');
}

async function withMongoTransaction(fn, { maxRetries = 3 } = {}) {
  const session = await mongoose.startSession();
  try {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        let result;
        await session.withTransaction(
          async () => {
            result = await fn(session);
          },
          {
            readPreference: 'primary',
            readConcern: { level: 'snapshot' },
            writeConcern: { w: 'majority' }
          }
        );
        return result;
      } catch (err) {
        if (attempt < maxRetries && (isTransientTxnError(err) || isUnknownCommitResult(err))) continue;
        throw err;
      }
    }
  } finally {
    await session.endSession();
  }
}

module.exports = { withMongoTransaction };

