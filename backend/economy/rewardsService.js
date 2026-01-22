const { Long } = require('./long');
const { withMongoTransaction } = require('./tx');
const { nowUtcDayKey, ensureWallet, applyWalletDeltaInSession, incrementDailyCounter } = require('./walletService');
const mongoose = require('mongoose');
const { recordEvent } = require('./missionsService');

const DEFAULTS = {
  message: { minLen: 20, dailyCap: 20, amountHrum: 1 },
  callStart: { dailyCap: 5, amountHrum: 3 }
};

function utcDayStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dailyLoginRewardForStreak(streak) {
  const s = Math.max(1, Number(streak) || 1);
  return 10 + (s - 1) * 5;
}

function getWalletsCollection() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected');
  return db.collection('wallets');
}

async function claimDailyLogin({ userId, ip, userAgent, deviceId }) {
  return withMongoTransaction(async (session) => {
    const wallets = getWalletsCollection();
    const now = new Date();
    const todayStart = utcDayStart(now);
    const computedNextDailyAt = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const todayKey = nowUtcDayKey(now);

    const wallet = await ensureWallet({ userId, session });
    if (!wallet?._id) throw new Error('WALLET_ENSURE_FAILED');

    const lastDailyAt = wallet.lastDailyAt ? new Date(wallet.lastDailyAt) : null;
    const nextDailyAtFromWallet = wallet.nextDailyAt ? new Date(wallet.nextDailyAt) : null;
    const alreadyClaimed =
      (nextDailyAtFromWallet && now.getTime() < nextDailyAtFromWallet.getTime()) ||
      (lastDailyAt && lastDailyAt.getTime() >= todayStart.getTime());
    if (alreadyClaimed) {
      const nextDailyAt = nextDailyAtFromWallet || computedNextDailyAt;
      console.warn('[Economy] daily-login already claimed:', { userId: String(userId), nextDailyAt });
      const err = new Error('DAILY_ALREADY_CLAIMED');
      err.code = 'DAILY_ALREADY_CLAIMED';
      err.nextDailyAt = nextDailyAt;
      throw err;
    }

    let nextStreak = 1;
    if (lastDailyAt) {
      const lastStart = utcDayStart(lastDailyAt);
      const diffDays = Math.floor((todayStart.getTime() - lastStart.getTime()) / (24 * 60 * 60 * 1000));
      if (diffDays === 1) {
        const prevStreak = Math.max(1, Number(wallet.dailyStreak) || 1);
        nextStreak = prevStreak + 1;
      }
    }

    const reward = dailyLoginRewardForStreak(nextStreak);
    const nextDailyAt = computedNextDailyAt;

    // Guarded update: only one concurrent txn can claim for the day.
    const metaRes = await wallets.findOneAndUpdate(
      { _id: wallet._id, $or: [{ lastDailyAt: null }, { lastDailyAt: { $lt: todayStart } }] },
      { $set: { lastDailyAt: now, dailyStreak: nextStreak, nextDailyAt, updatedAt: now } },
      { upsert: false, returnDocument: 'after', returnOriginal: false, session }
    );
    const metaDoc = metaRes?.value ?? metaRes;
    if (!metaDoc?._id) {
      const latest = await wallets.findOne({ _id: wallet._id }, { session });
      console.warn('[Economy] daily-login race: already claimed by concurrent request:', {
        userId: String(userId),
        nextDailyAt: latest?.nextDailyAt || nextDailyAt
      });
      const err = new Error('DAILY_ALREADY_CLAIMED');
      err.code = 'DAILY_ALREADY_CLAIMED';
      err.nextDailyAt = latest?.nextDailyAt || nextDailyAt;
      throw err;
    }

    const res = await applyWalletDeltaInSession({
      session,
      userId,
      deltaHrum: reward,
      reasonCode: 'earn:daily_login',
      dedupeKey: `daily_login:${todayKey}`,
      idempotencyKey: `earn:daily_login:${userId}:${todayKey}`,
      meta: { streak: nextStreak, dayKey: todayKey }
    });

    if (res?.idempotent) {
      console.warn('[Economy] daily-login idempotent hit (treated as already claimed):', { userId: String(userId), todayKey });
      const err = new Error('DAILY_ALREADY_CLAIMED');
      err.code = 'DAILY_ALREADY_CLAIMED';
      err.nextDailyAt = metaDoc.nextDailyAt || nextDailyAt;
      throw err;
    }

    console.info('[Economy] daily-login granted:', { userId: String(userId), reward, streak: nextStreak });

    // Missions: progress/reward must be in the same transaction.
    try {
      await recordEvent({ userId, eventKey: 'daily_login', amount: 1, eventId: todayKey, session });
    } catch (e) {
      console.error('[Missions] daily_login hook failed:', { userId: String(userId), message: e?.message });
      throw e;
    }

    const balance = Number(res.balanceHrum);
    if (!Number.isFinite(balance)) {
      console.error('[Economy] daily-login produced non-finite balance:', { userId: String(userId), balanceHrum: res.balanceHrum });
    }
    return {
      success: true,
      reward,
      balance: Number.isFinite(balance) ? balance : 0,
      balanceHrum: res.balanceHrum,
      streak: nextStreak,
      nextDailyAt: metaDoc.nextDailyAt
    };
  });
}

async function maybeRewardMessage({ userId, messageId, chatId, text }) {
  const messageText = typeof text === 'string' ? text : '';
  if (messageText.trim().length < DEFAULTS.message.minLen) return { ok: true, granted: false, reason: 'min_len' };

  const dayKey = nowUtcDayKey(new Date());
  const dedupeKey = `message:${messageId}`;
  const idempotencyKey = `earn:message:${messageId}`;

  try {
    return await withMongoTransaction(async (session) => {
      await ensureWallet({ userId, session });
      await incrementDailyCounter({ session, userId, key: 'earn:message', dayKey, limit: DEFAULTS.message.dailyCap });

      const res = await applyWalletDeltaInSession({
        session,
        userId,
        deltaHrum: Long.fromNumber(DEFAULTS.message.amountHrum),
        reasonCode: 'earn:message',
        dedupeKey,
        idempotencyKey,
        meta: { chatId: String(chatId), messageId: String(messageId), dayKey }
      });
      if (res?.idempotent) {
        const err = new Error('DUPLICATE_REWARD');
        err.code = 'DUPLICATE_REWARD';
        throw err;
      }
      return { ok: true, granted: true, amountHrum: String(DEFAULTS.message.amountHrum), balanceHrum: res.balanceHrum };
    });
  } catch (err) {
    if (err?.code === 'DAILY_LIMIT_REACHED') return { ok: true, granted: false, reason: 'daily_cap' };
    if (err?.code === 'DUPLICATE_REWARD') return { ok: true, granted: false, reason: 'dup' };
    if (err?.code === 11000) return { ok: true, granted: false, reason: 'dup' };
    return { ok: false, error: String(err?.message || err) };
  }
}

async function maybeRewardCallStart({ userId, callId, chatId, callType }) {
  const dayKey = nowUtcDayKey(new Date());
  const dedupeKey = `call_start:${callId}:${userId}`;
  const idempotencyKey = `earn:call_start:${callId}:${userId}`;

  try {
    return await withMongoTransaction(async (session) => {
      await ensureWallet({ userId, session });
      await incrementDailyCounter({ session, userId, key: 'earn:call_start', dayKey, limit: DEFAULTS.callStart.dailyCap });

      const res = await applyWalletDeltaInSession({
        session,
        userId,
        deltaHrum: Long.fromNumber(DEFAULTS.callStart.amountHrum),
        reasonCode: 'earn:call_start',
        dedupeKey,
        idempotencyKey,
        meta: { chatId: String(chatId), callId: String(callId), callType: String(callType), dayKey }
      });
      if (res?.idempotent) {
        const err = new Error('DUPLICATE_REWARD');
        err.code = 'DUPLICATE_REWARD';
        throw err;
      }
      return { ok: true, granted: true, amountHrum: String(DEFAULTS.callStart.amountHrum), balanceHrum: res.balanceHrum };
    });
  } catch (err) {
    if (err?.code === 'DAILY_LIMIT_REACHED') return { ok: true, granted: false, reason: 'daily_cap' };
    if (err?.code === 'DUPLICATE_REWARD') return { ok: true, granted: false, reason: 'dup' };
    if (err?.code === 11000) return { ok: true, granted: false, reason: 'dup' };
    return { ok: false, error: String(err?.message || err) };
  }
}

module.exports = { claimDailyLogin, maybeRewardMessage, maybeRewardCallStart };
