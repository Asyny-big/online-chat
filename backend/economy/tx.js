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
        const msg = String(err?.message || '');
        if (
          msg.includes('Transaction numbers are only allowed on a replica set member or mongos') ||
          msg.includes('transactions are not supported') ||
          msg.includes('Transaction is not supported') ||
          msg.includes('IllegalOperation') ||
          err?.code === 20
        ) {
          const e = new Error('TRANSACTIONS_NOT_SUPPORTED');
          e.code = 'TRANSACTIONS_NOT_SUPPORTED';
          throw e;
        }
        if (attempt < maxRetries && (isTransientTxnError(err) || isUnknownCommitResult(err))) continue;
        throw err;
      }
    }
  } finally {
    await session.endSession();
  }
}

module.exports = { withMongoTransaction };
