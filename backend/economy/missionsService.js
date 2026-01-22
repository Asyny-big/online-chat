const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const { withMongoTransaction } = require('./tx');
const { ensureWallet, applyWalletDeltaInSession, nowUtcDayKey } = require('./walletService');
const { getMissions, getMissionsByEvent } = require('./missionsConfig');

function getDb() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected');
  return db;
}

function utcDayStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function resolveScopeKey({ missionType, now }) {
  if (missionType === 'daily') return nowUtcDayKey(now);
  return 'lifetime';
}

function normalizeAmount(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return 1;
  return Math.floor(v);
}

function asObjectId(userId) {
  try {
    return new ObjectId(userId);
  } catch {
    const err = new Error('INVALID_USER_ID');
    err.code = 'INVALID_USER_ID';
    throw err;
  }
}

async function maybeDedupEvent({ session, userId, eventKey, eventId, ttlDays = 45 }) {
  const id = String(eventId || '').trim();
  if (!id) return true;

  const db = getDb();
  const dedupe = db.collection('mission_event_dedupe');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

  try {
    await dedupe.insertOne(
      { userId: asObjectId(userId), eventKey: String(eventKey), eventId: id, createdAt: now, expiresAt },
      session ? { session } : undefined
    );
    return true;
  } catch (e) {
    if (e?.code === 11000) return false;
    throw e;
  }
}

async function upsertProgress({ session, userId, mission, scopeKey, amount, now, currentOverride }) {
  const db = getDb();
  const progress = db.collection('mission_progress');

  const target = Math.max(1, Number(mission.target) || 1);
  const inc = normalizeAmount(amount);

  const pipeline = [
    {
      $setOnInsert: {
        userId: asObjectId(userId),
        missionId: mission.id,
        type: mission.type,
        eventKey: mission.eventKey,
        scopeKey,
        title: mission.title,
        description: mission.description,
        rewardHrum: String(mission.rewardHrum),
        target,
        current: 0,
        createdAt: now
      }
    },
    { $set: { updatedAt: now } }
  ];

  if (typeof currentOverride === 'number') {
    pipeline.push({ $set: { current: Math.min(target, Math.max(0, Math.floor(currentOverride))) } });
  } else {
    pipeline.push({
      $set: {
        current: {
          $let: {
            vars: { prev: { $ifNull: ['$current', 0] } },
            in: { $min: [target, { $add: ['$$prev', inc] }] }
          }
        }
      }
    });
  }

  pipeline.push({
    $set: {
      completedAt: {
        $cond: [
          { $and: [{ $gte: ['$current', target] }, { $eq: [{ $ifNull: ['$completedAt', null] }, null] }] },
          now,
          '$completedAt'
        ]
      }
    }
  });

  const res = await progress.findOneAndUpdate(
    { userId: asObjectId(userId), missionId: mission.id, scopeKey },
    pipeline,
    { upsert: true, returnDocument: 'after', returnOriginal: false, ...(session ? { session } : {}) }
  );
  const doc = res?.value ?? res;
  if (!doc?._id) {
    const err = new Error('MISSION_PROGRESS_UPSERT_FAILED');
    err.code = 'MISSION_PROGRESS_UPSERT_FAILED';
    throw err;
  }
  return doc;
}

async function maybeAward({ session, userId, mission, progressDoc }) {
  if (!progressDoc?.completedAt) return progressDoc;
  if (progressDoc.rewardTxId) return progressDoc;

  const scopeKey = String(progressDoc.scopeKey || 'lifetime');
  const idempotencyKey = `mission:${mission.id}:${scopeKey}:${userId}`;

  const res = await applyWalletDeltaInSession({
    session,
    userId,
    deltaHrum: String(mission.rewardHrum),
    reasonCode: 'earn:mission',
    idempotencyKey,
    dedupeKey: `mission:${mission.id}:${scopeKey}`,
    meta: { missionId: mission.id, missionType: mission.type, scopeKey }
  });

  const txId = res?.txId ? String(res.txId) : null;
  const db = getDb();
  const progress = db.collection('mission_progress');
  const now = new Date();

  await progress.updateOne(
    { _id: progressDoc._id },
    { $set: { rewardTxId: txId, rewardedAt: now, updatedAt: now } },
    session ? { session } : undefined
  );

  if (res?.idempotent) {
    console.warn('[Missions] reward idempotent:', { userId: String(userId), missionId: mission.id, scopeKey, txId });
  } else {
    console.info('[Missions] reward granted:', { userId: String(userId), missionId: mission.id, scopeKey, rewardHrum: mission.rewardHrum });
  }

  return { ...progressDoc, rewardTxId: txId, rewardedAt: now };
}

async function recordEventInSession({ session, userId, eventKey, amount, eventId, meta }) {
  const now = new Date();
  const missions = getMissionsByEvent(eventKey);
  if (missions.length === 0) return { ok: true, updated: 0 };

  const didProcess = await maybeDedupEvent({ session, userId, eventKey, eventId });
  if (!didProcess) {
    console.warn('[Missions] dedup event ignored:', { userId: String(userId), eventKey: String(eventKey), eventId: String(eventId) });
    return { ok: true, dedup: true, updated: 0 };
  }

  const wallet = await ensureWallet({ userId, session });
  if (!wallet?._id) throw new Error('WALLET_ENSURE_FAILED');

  let updated = 0;
  for (const m of missions) {
    const scopeKey = resolveScopeKey({ missionType: m.type, now });

    // streak missions use wallet.dailyStreak as the source of truth.
    const currentOverride = m.type === 'streak' ? Number(wallet.dailyStreak) || 0 : undefined;
    const doc = await upsertProgress({ session, userId, mission: m, scopeKey, amount, now, currentOverride });
    await maybeAward({ session, userId, mission: m, progressDoc: doc });
    updated += 1;
  }

  if (meta) {
    // Best-effort debug signal; do not store full payloads.
    console.debug?.('[Missions] event processed:', { userId: String(userId), eventKey: String(eventKey), amount: normalizeAmount(amount), metaKeys: Object.keys(meta || {}) });
  }

  return { ok: true, updated };
}

async function recordEvent({ userId, eventKey, amount = 1, eventId, meta, session }) {
  try {
    if (session) return await recordEventInSession({ session, userId, eventKey, amount, eventId, meta });
    return await withMongoTransaction((s) => recordEventInSession({ session: s, userId, eventKey, amount, eventId, meta }));
  } catch (e) {
    // Caller can decide whether to treat missions as best-effort.
    console.error('[Missions] recordEvent failed:', { userId: String(userId), eventKey: String(eventKey), message: e?.message, code: e?.code });
    throw e;
  }
}

async function listMissionsForUser({ userId }) {
  const db = getDb();
  const oid = asObjectId(userId);
  const now = new Date();
  const dayKey = nowUtcDayKey(now);

  const wallet = await db.collection('wallets').findOne({ userId: oid });
  const nextDailyAt = wallet?.nextDailyAt || null;
  const dailyStreak = typeof wallet?.dailyStreak === 'number' ? wallet.dailyStreak : 0;

  const defs = getMissions();
  const wantedScopeKeys = [dayKey, 'lifetime'];
  const progressDocs = await db
    .collection('mission_progress')
    .find({ userId: oid, missionId: { $in: defs.map((d) => d.id) }, scopeKey: { $in: wantedScopeKeys } })
    .toArray();

  const byKey = new Map();
  for (const p of progressDocs) {
    byKey.set(`${p.missionId}:${p.scopeKey}`, p);
  }

  const out = defs.map((m) => {
    const scopeKey = resolveScopeKey({ missionType: m.type, now });
    const p = byKey.get(`${m.id}:${scopeKey}`) || null;
    const target = Math.max(1, Number(m.target) || 1);

    const current =
      m.type === 'streak'
        ? Math.min(target, Math.max(0, dailyStreak))
        : Math.min(target, Math.max(0, Number(p?.current) || 0));

    const completed = m.type === 'streak' ? dailyStreak >= target : !!p?.completedAt;

    return {
      id: m.id,
      type: m.type,
      eventKey: m.eventKey,
      title: m.title,
      description: m.description,
      rewardHrum: String(m.rewardHrum),
      scopeKey,
      current,
      target,
      completed,
      completedAt: p?.completedAt || null,
      rewardedAt: p?.rewardedAt || null,
      rewardTxId: p?.rewardTxId || null,
      nextDailyAt: m.type === 'daily' ? nextDailyAt : null
    };
  });

  return { items: out, now, dayKey };
}

module.exports = { recordEvent, listMissionsForUser };
