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

function isTransactionsNotSupported(err) {
  const msg = String(err?.message || '');
  return (
    msg.includes('Transaction numbers are only allowed on a replica set member or mongos') ||
    msg.includes('transactions are not supported') ||
    msg.includes('Transaction is not supported') ||
    msg.includes('IllegalOperation') ||
    err?.code === 20
  );
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
        // If MongoDB isn't a replica set/mongos, transactions will always fail.
        // Degrade gracefully instead of breaking economy endpoints entirely.
        if (isTransactionsNotSupported(err)) {
          console.warn('[Economy] MongoDB transactions not supported; running without transaction.');
          return await fn(undefined);
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
