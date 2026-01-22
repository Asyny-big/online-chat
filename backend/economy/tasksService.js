const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const { toLong, longToString } = require('./long');
const { withMongoTransaction } = require('./tx');
const { nowUtcDayKey, ensureWallet, applyWalletDeltaInSession } = require('./walletService');
const { claimDailyLogin } = require('./rewardsService');

function getDb() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected');
  return db;
}

const DEFAULTS = Object.freeze({
  ttlDays: 3,
  dailyLogin: { maxStreakDays: 7, cooldownMs: 24 * 60 * 60 * 1000, baseHrum: 10, perStreakBonusHrum: 2 }
});

function dailyLoginAmountForStreak(streak) {
  const s = Math.max(1, Math.min(DEFAULTS.dailyLogin.maxStreakDays, Number(streak) || 1));
  return toLong(DEFAULTS.dailyLogin.baseHrum + (s - 1) * DEFAULTS.dailyLogin.perStreakBonusHrum);
}

const TASK_DEFS = Object.freeze([
  {
    id: 'daily_login',
    kind: 'daily_login',
    title: 'Ежедневный вход',
    description: 'Заходите каждый день, чтобы увеличить серию и получать больше Хрумов.',
    enabled: true
  },
  {
    id: 'daily_messages_5',
    kind: 'daily_counter',
    title: 'Написать 5 сообщений',
    description: 'Сообщения учитываются, если текст достаточно длинный.',
    enabled: true,
    counterKey: 'earn:message',
    target: 5,
    rewardHrum: toLong(12)
  },
  {
    id: 'daily_call_start_2',
    kind: 'daily_counter',
    title: 'Начать 2 звонка',
    description: 'Любой тип звонка (аудио/видео).',
    enabled: true,
    counterKey: 'earn:call_start',
    target: 2,
    rewardHrum: toLong(10)
  }
]);

function statusForProgress({ claimed, current, total, canClaim }) {
  if (claimed) return 'claimed';
  if (canClaim) return 'completed';
  if (current > 0 && total > 0 && current < total) return 'in_progress';
  return 'available';
}

async function listTasks({ userId }) {
  const db = getDb();
  const economyLimits = db.collection('economy_limits');
  const now = new Date();
  const todayKey = nowUtcDayKey(now);
  const yesterdayKey = nowUtcDayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const scopeId = new ObjectId(userId);

  const defs = TASK_DEFS.filter((t) => t.enabled !== false);

  const counterKeys = defs.map((t) => t.counterKey).filter(Boolean);
  const claimKeys = defs.filter((t) => t.kind !== 'daily_login').map((t) => `task_claim:${t.id}`);

  const docs = await economyLimits
    .find({ scope: 'user', scopeId, bucket: todayKey, key: { $in: [...new Set([...counterKeys, ...claimKeys])] } })
    .toArray();

  const byKey = new Map(docs.map((d) => [String(d?.key), d]));

  const dailyLoginStateId = { scope: 'user', scopeId, key: 'daily_login_state', bucket: 'singleton' };
  const dailyLoginState = await economyLimits.findOne(dailyLoginStateId);

  const tasks = defs.map((t) => {
    if (t.kind === 'daily_login') {
      const claimedToday = dailyLoginState?.lastClaimDayKey === todayKey;
      const lastClaimAt = dailyLoginState?.lastClaimAt ? new Date(dailyLoginState.lastClaimAt).getTime() : null;
      const cooldownRemainingMs =
        !claimedToday && Number.isFinite(lastClaimAt) ? Math.max(0, DEFAULTS.dailyLogin.cooldownMs - (now.getTime() - lastClaimAt)) : 0;

      const prevStreak = Number(dailyLoginState?.streak) || 1;
      const nextStreak = dailyLoginState?.lastClaimDayKey === yesterdayKey ? Math.min(prevStreak + 1, DEFAULTS.dailyLogin.maxStreakDays) : 1;
      const rewardHrum = longToString(dailyLoginAmountForStreak(nextStreak));

      const canClaim = !claimedToday && cooldownRemainingMs === 0;
      const status = claimedToday ? 'claimed' : cooldownRemainingMs > 0 ? 'in_progress' : 'available';

      return {
        id: t.id,
        title: t.title,
        description: t.description,
        kind: t.kind,
        rewardHrum,
        progressCurrent: claimedToday ? 1 : 0,
        progressTotal: 1,
        status,
        canClaim,
        claimed: claimedToday,
        meta: { streak: prevStreak, nextStreak, cooldownRemainingMs }
      };
    }

    const counterDoc = byKey.get(String(t.counterKey));
    const claimDoc = byKey.get(`task_claim:${t.id}`);
    const rawCount = Number(counterDoc?.count) || 0;
    const total = Number(t.target) || 1;
    const current = Math.max(0, Math.min(rawCount, total));
    const claimed = !!claimDoc?.claimedAt;
    const canClaim = !claimed && rawCount >= total;

    return {
      id: t.id,
      title: t.title,
      description: t.description,
      kind: t.kind,
      rewardHrum: longToString(t.rewardHrum),
      progressCurrent: current,
      progressTotal: total,
      status: statusForProgress({ claimed, current, total, canClaim }),
      canClaim,
      claimed
    };
  });

  return { tasks, dayKey: todayKey, serverTime: now.toISOString() };
}

async function claimTask({ userId, taskId, ip, userAgent, deviceId }) {
  const id = String(taskId || '').trim();
  if (!id) {
    const err = new Error('TASK_NOT_FOUND');
    err.code = 'TASK_NOT_FOUND';
    throw err;
  }

  if (id === 'daily_login') {
    const out = await claimDailyLogin({ userId, ip, userAgent, deviceId });
    return { ...out, taskId: 'daily_login' };
  }

  const def = TASK_DEFS.find((t) => t.enabled !== false && t.id === id);
  if (!def) {
    const err = new Error('TASK_NOT_FOUND');
    err.code = 'TASK_NOT_FOUND';
    throw err;
  }
  if (def.kind !== 'daily_counter') {
    const err = new Error('TASK_NOT_FOUND');
    err.code = 'TASK_NOT_FOUND';
    throw err;
  }

  const db = getDb();
  const economyLimits = db.collection('economy_limits');
  const now = new Date();
  const dayKey = nowUtcDayKey(now);
  const scopeId = new ObjectId(userId);

  return withMongoTransaction(async (session) => {
    await ensureWallet({ userId, session });

    const counter = await economyLimits.findOne({ scope: 'user', scopeId, key: def.counterKey, bucket: dayKey }, { session });
    const count = Number(counter?.count) || 0;
    if (count < Number(def.target)) {
      const err = new Error('TASK_NOT_COMPLETED');
      err.code = 'TASK_NOT_COMPLETED';
      throw err;
    }

    const claimId = { scope: 'user', scopeId, key: `task_claim:${def.id}`, bucket: dayKey };
    const existingClaim = await economyLimits.findOne(claimId, { session });
    if (existingClaim?.claimedAt) {
      const err = new Error('TASK_ALREADY_CLAIMED');
      err.code = 'TASK_ALREADY_CLAIMED';
      throw err;
    }

    const expiresAt = new Date(now.getTime() + DEFAULTS.ttlDays * 24 * 60 * 60 * 1000);
    await economyLimits.updateOne(
      claimId,
      {
        $setOnInsert: { ...claimId, createdAt: now, expiresAt },
        $set: { updatedAt: now, claimedAt: now }
      },
      { upsert: true, session }
    );

    const amount = toLong(def.rewardHrum);
    const res = await applyWalletDeltaInSession({
      session,
      userId,
      deltaHrum: amount,
      reasonCode: 'earn:task',
      dedupeKey: `task:${def.id}:${dayKey}`,
      idempotencyKey: `earn:task:${userId}:${def.id}:${dayKey}`,
      meta: { taskId: def.id, dayKey }
    });

    return {
      ok: true,
      taskId: def.id,
      claimed: res?.idempotent ? false : true,
      amountHrum: longToString(amount),
      balanceHrum: res.balanceHrum
    };
  });
}

module.exports = { listTasks, claimTask };

