const { toLong } = require('./long');
const { withMongoTransaction } = require('./tx');
const { sha256Base64Url, nowUtcDayKey, incrementDailyCounter } = require('./walletService');
const { ObjectId } = require('mongodb');
const mongoose = require('mongoose');

const DEFAULTS = {
  dailyLogin: { maxStreakDays: 7, cooldownMs: 24 * 60 * 60 * 1000, baseHrum: 10, perStreakBonusHrum: 2 },
  message: { minLen: 20, dailyCap: 20, amountHrum: 1 },
  callStart: { dailyCap: 5, amountHrum: 3 }
};

function dailyLoginAmountForStreak(streak) {
  const s = Math.max(1, Math.min(DEFAULTS.dailyLogin.maxStreakDays, Number(streak) || 1));
  return toLong(DEFAULTS.dailyLogin.baseHrum + (s - 1) * DEFAULTS.dailyLogin.perStreakBonusHrum);
}

async function claimDailyLogin({ userId, ip, userAgent, deviceId }) {
  return withMongoTransaction(async (session) => {
    await ensureWallet({ userId, session });

    const db = mongoose.connection.db;
    const economyLimits = db.collection('economy_limits');
    const now = new Date();
    const todayKey = nowUtcDayKey(now);

    const stateId = {
      scope: 'user',
      scopeId: new ObjectId(userId),
      key: 'daily_login_state',
      bucket: 'singleton'
    };

    const state = await economyLimits.findOne(stateId, { session });
    if (state?.lastClaimDayKey === todayKey) {
      return { ok: true, claimed: false, streak: state.streak || 1 };
    }

    if (state?.lastClaimAt) {
      const last = new Date(state.lastClaimAt).getTime();
      if (Number.isFinite(last) && now.getTime() - last < DEFAULTS.dailyLogin.cooldownMs) {
        const err = new Error('COOLDOWN_ACTIVE');
        err.code = 'COOLDOWN_ACTIVE';
        throw err;
      }
    }

    const yesterdayKey = nowUtcDayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const nextStreak =
      state?.lastClaimDayKey === yesterdayKey ? Math.min((state?.streak || 1) + 1, DEFAULTS.dailyLogin.maxStreakDays) : 1;

    await economyLimits.updateOne(
      stateId,
      {
        $setOnInsert: { ...stateId, createdAt: now },
        $set: { updatedAt: now, lastClaimAt: now, lastClaimDayKey: todayKey, streak: nextStreak }
      },
      { upsert: true, session }
    );

    const amount = dailyLoginAmountForStreak(nextStreak);
    const idempotencyKey = `earn:daily_login:${userId}:${todayKey}`;
    const dedupeKey = `daily_login:${todayKey}`;

    const ipHash = ip ? sha256Base64Url(`ip:${ip}`) : null;
    const uaHash = userAgent ? sha256Base64Url(`ua:${userAgent}`) : null;
    const deviceHash = deviceId ? sha256Base64Url(`device:${deviceId}`) : null;

    const res = await applyWalletDeltaInSession({
      session,
      userId,
      deltaHrum: amount,
      reasonCode: 'earn:daily_login',
      dedupeKey,
      idempotencyKey,
      meta: { streak: nextStreak, ipHash, uaHash, deviceHash }
    });

    if (res?.idempotent) {
      return { ok: true, claimed: false, streak: nextStreak, balanceHrum: res.balanceHrum };
    }

    return { ok: true, claimed: true, streak: nextStreak, amountHrum: amount.toString(), balanceHrum: res.balanceHrum };
  });
}

async function maybeRewardMessage({ userId, messageId, chatId, text }) {
  const messageText = typeof text === 'string' ? text : '';
  if (messageText.trim().length < DEFAULTS.message.minLen) return { ok: true, granted: false, reason: 'min_len' };

  const dayKey = nowUtcDayKey(new Date());
  const dedupeBucket = `message:${messageId}`;

  try {
    return await withMongoTransaction(async (session) => {
      // IMPORTANT: task rewards are claimed manually; message/call events only update progress counters.
      const db = mongoose.connection.db;
      const economyLimits = db.collection('economy_limits');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      try {
        await economyLimits.insertOne(
          {
            scope: 'user',
            scopeId: new ObjectId(userId),
            key: 'dedupe:earn:message',
            bucket: String(dedupeBucket),
            createdAt: now,
            updatedAt: now,
            expiresAt,
            meta: { chatId: String(chatId), messageId: String(messageId), dayKey }
          },
          { session }
        );
      } catch (e) {
        if (e?.code === 11000) return { ok: true, granted: false, reason: 'dup' };
        throw e;
      }

      await incrementDailyCounter({ session, userId, key: 'earn:message', dayKey, limit: DEFAULTS.message.dailyCap });
      return { ok: true, granted: false, reason: 'progress_updated' };
    });
  } catch (err) {
    if (err?.code === 'DAILY_LIMIT_REACHED') return { ok: true, granted: false, reason: 'daily_cap' };
    if (err?.code === 11000) return { ok: true, granted: false, reason: 'dup' };
    return { ok: false, error: String(err?.message || err) };
  }
}

async function maybeRewardCallStart({ userId, callId, chatId, callType }) {
  const dayKey = nowUtcDayKey(new Date());
  const dedupeBucket = `call_start:${callId}:${userId}`;

  try {
    return await withMongoTransaction(async (session) => {
      // IMPORTANT: task rewards are claimed manually; call events only update progress counters.
      const db = mongoose.connection.db;
      const economyLimits = db.collection('economy_limits');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      try {
        await economyLimits.insertOne(
          {
            scope: 'user',
            scopeId: new ObjectId(userId),
            key: 'dedupe:earn:call_start',
            bucket: String(dedupeBucket),
            createdAt: now,
            updatedAt: now,
            expiresAt,
            meta: { chatId: String(chatId), callId: String(callId), callType: String(callType), dayKey }
          },
          { session }
        );
      } catch (e) {
        if (e?.code === 11000) return { ok: true, granted: false, reason: 'dup' };
        throw e;
      }

      await incrementDailyCounter({ session, userId, key: 'earn:call_start', dayKey, limit: DEFAULTS.callStart.dailyCap });
      return { ok: true, granted: false, reason: 'progress_updated' };
    });
  } catch (err) {
    if (err?.code === 'DAILY_LIMIT_REACHED') return { ok: true, granted: false, reason: 'daily_cap' };
    if (err?.code === 11000) return { ok: true, granted: false, reason: 'dup' };
    return { ok: false, error: String(err?.message || err) };
  }
}

module.exports = { claimDailyLogin, maybeRewardMessage, maybeRewardCallStart };
