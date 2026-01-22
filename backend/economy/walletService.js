const mongoose = require('mongoose');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { toLong, longIsZero, longToString } = require('./long');
const { withMongoTransaction } = require('./tx');

function getDb() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected');
  return db;
}

function sha256Base64Url(input) {
  const buf = crypto.createHash('sha256').update(String(input)).digest();
  return buf.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function nowUtcDayKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function ensureWallet({ userId, session }) {
  const db = getDb();
  const wallets = db.collection('wallets');
  const now = new Date();
  const res = await wallets.findOneAndUpdate(
    { userId: new ObjectId(userId) },
    {
      $setOnInsert: {
        userId: new ObjectId(userId),
        balanceHrum: toLong(0),
        status: 'active',
        createdAt: now
      },
      $set: { updatedAt: now }
    },
    { upsert: true, returnDocument: 'after', session }
  );
  return res.value;
}

async function getWallet({ userId }) {
  const db = getDb();
  const wallets = db.collection('wallets');
  return wallets.findOne({ userId: new ObjectId(userId) });
}

async function getBalanceHrumString({ userId }) {
  const wallet = await getWallet({ userId });
  if (!wallet) return '0';
  return longToString(wallet.balanceHrum);
}

async function listWalletTransactions({ userId, limit = 50, before }) {
  const db = getDb();
  const walletTransactions = db.collection('wallet_transactions');
  const query = { userId: new ObjectId(userId) };
  if (before) query.createdAt = { $lt: new Date(before) };

  const docs = await walletTransactions
    .find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(Math.min(Math.max(Number(limit) || 50, 1), 200))
    .toArray();

  return docs.map((t) => ({
    id: String(t._id),
    deltaHrum: longToString(t.deltaHrum),
    reasonCode: t.reasonCode,
    createdAt: t.createdAt,
    meta: t.meta || {}
  }));
}

async function applyWalletDeltaInSession({ session, userId, deltaHrum, reasonCode, dedupeKey, idempotencyKey, meta = {} }) {
  const delta = toLong(deltaHrum);
  if (longIsZero(delta)) throw new Error('deltaHrum must not be 0');
  if (!reasonCode || typeof reasonCode !== 'string') throw new Error('reasonCode is required');
  if (!idempotencyKey || typeof idempotencyKey !== 'string') throw new Error('idempotencyKey is required');

  const db = getDb();
  const wallets = db.collection('wallets');
  const walletTransactions = db.collection('wallet_transactions');

  const wallet = await ensureWallet({ userId, session });
  const now = new Date();

  const txId = new ObjectId();
  const txDoc = {
    _id: txId,
    userId: new ObjectId(userId),
    walletId: wallet._id,
    deltaHrum: delta,
    reasonCode,
    idempotencyKey,
    dedupeKey: typeof dedupeKey === 'string' ? dedupeKey : undefined,
    meta,
    createdAt: now
  };

  try {
    await walletTransactions.insertOne(txDoc, { session });
  } catch (err) {
    if (err?.code === 11000) {
      const existing =
        (await walletTransactions.findOne({ idempotencyKey }, { session })) ||
        (typeof dedupeKey === 'string'
          ? await walletTransactions.findOne({ userId: new ObjectId(userId), dedupeKey }, { session })
          : null);

      const walletNow = await wallets.findOne({ _id: wallet._id }, { session });
      return {
        walletId: String(wallet._id),
        balanceHrum: longToString(walletNow?.balanceHrum || 0),
        txId: existing ? String(existing._id) : null,
        idempotent: true
      };
    }
    throw err;
  }

  const filter = { _id: wallet._id };
  const update = { $inc: { balanceHrum: delta }, $set: { updatedAt: now } };
  if (delta.isNegative()) {
    filter.balanceHrum = { $gte: delta.negate() };
  }

  const updated = await wallets.findOneAndUpdate(filter, update, { returnDocument: 'after', session });
  if (!updated.value) {
    const err = new Error('INSUFFICIENT_HRUM');
    err.code = 'INSUFFICIENT_HRUM';
    throw err;
  }

  return {
    walletId: String(wallet._id),
    balanceHrum: longToString(updated.value.balanceHrum),
    txId: String(txId),
    idempotent: false
  };
}

async function applyWalletDelta(args) {
  return withMongoTransaction((session) => applyWalletDeltaInSession({ ...args, session }));
}

async function incrementDailyCounter({ session, userId, key, dayKey, limit, ttlDays = 3 }) {
  const db = getDb();
  const economyLimits = db.collection('economy_limits');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

  const res = await economyLimits.findOneAndUpdate(
    { scope: 'user', scopeId: new ObjectId(userId), key, bucket: dayKey },
    [
      {
        $setOnInsert: {
          scope: 'user',
          scopeId: new ObjectId(userId),
          key,
          bucket: dayKey,
          count: 0,
          createdAt: now,
          expiresAt
        }
      },
      { $set: { updatedAt: now } },
      { $set: { count: { $add: ['$count', 1] } } }
    ],
    { upsert: true, returnDocument: 'after', session }
  );

  const count = res.value?.count ?? 0;
  if (typeof limit === 'number' && count > limit) {
    const err = new Error('DAILY_LIMIT_REACHED');
    err.code = 'DAILY_LIMIT_REACHED';
    throw err;
  }
  return { count };
}

module.exports = {
  sha256Base64Url,
  nowUtcDayKey,
  ensureWallet,
  getWallet,
  getBalanceHrumString,
  listWalletTransactions,
  applyWalletDeltaInSession,
  applyWalletDelta,
  incrementDailyCounter
};
