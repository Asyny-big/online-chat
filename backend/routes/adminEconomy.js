const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const { toLong } = require('../economy/long');
const { applyWalletDeltaInSession } = require('../economy/walletService');
const { withMongoTransaction } = require('../economy/tx');

router.use(authMiddleware);
router.use(adminOnly);

function getDb() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected');
  return db;
}

// ЭТАП 1: frontend НЕ передаёт количество Хрумов — только ключ операции.
// Произвольные суммы для админа — будущий этап (иначе легко ошибиться/взломать UI).
const ADMIN_AMOUNT_BY_KEY = Object.freeze({
  grant_10: toLong(10),
  grant_50: toLong(50),
  grant_200: toLong(200),
  grant_1000: toLong(1000),
  revoke_10: toLong(10),
  revoke_50: toLong(50),
  revoke_200: toLong(200),
  revoke_1000: toLong(1000)
});

router.post('/grant', async (req, res) => {
  try {
    const { targetUserId, amountKey, reason, idempotencyKey } = req.body || {};
    if (!targetUserId || !amountKey || !reason || !idempotencyKey) {
      return res.status(400).json({ error: 'bad_request' });
    }

    const amount = ADMIN_AMOUNT_BY_KEY[String(amountKey)];
    if (!amount || String(amountKey).startsWith('revoke_')) {
      return res.status(400).json({ error: 'invalid_amount_key' });
    }

    const out = await withMongoTransaction(async (session) => {
      const walletRes = await applyWalletDeltaInSession({
        session,
        userId: String(targetUserId),
        deltaHrum: amount,
        reasonCode: 'admin:grant',
        dedupeKey: `admin_grant:${idempotencyKey}`,
        idempotencyKey: `admin:grant:${idempotencyKey}`,
        meta: { byAdminUserId: String(req.userId), reason: String(reason), amountKey: String(amountKey) }
      });

      try {
        await getDb().collection('admin_actions').insertOne(
          {
            idempotencyKey: `admin_action:grant:${idempotencyKey}`,
            adminUserId: new ObjectId(req.userId),
            action: 'wallet_grant',
            targetUserId: new ObjectId(targetUserId),
            createdAt: new Date(),
            meta: { amountKey: String(amountKey), amountHrum: amount.toString(), reason: String(reason) }
          },
          { session }
        );
      } catch (e) {
        if (e?.code !== 11000) throw e;
      }

      return walletRes;
    });

    res.json({ ok: true, balanceHrum: out.balanceHrum, idempotent: out.idempotent === true });
  } catch (_err) {
    res.status(500).json({ error: 'grant_failed' });
  }
});

router.post('/revoke', async (req, res) => {
  try {
    const { targetUserId, amountKey, reason, idempotencyKey } = req.body || {};
    if (!targetUserId || !amountKey || !reason || !idempotencyKey) {
      return res.status(400).json({ error: 'bad_request' });
    }

    const amount = ADMIN_AMOUNT_BY_KEY[String(amountKey)];
    if (!amount || String(amountKey).startsWith('grant_')) {
      return res.status(400).json({ error: 'invalid_amount_key' });
    }

    const out = await withMongoTransaction(async (session) => {
      const walletRes = await applyWalletDeltaInSession({
        session,
        userId: String(targetUserId),
        deltaHrum: amount.negate(),
        reasonCode: 'admin:revoke',
        dedupeKey: `admin_revoke:${idempotencyKey}`,
        idempotencyKey: `admin:revoke:${idempotencyKey}`,
        meta: { byAdminUserId: String(req.userId), reason: String(reason), amountKey: String(amountKey) }
      });

      try {
        await getDb().collection('admin_actions').insertOne(
          {
            idempotencyKey: `admin_action:revoke:${idempotencyKey}`,
            adminUserId: new ObjectId(req.userId),
            action: 'wallet_revoke',
            targetUserId: new ObjectId(targetUserId),
            createdAt: new Date(),
            meta: { amountKey: String(amountKey), amountHrum: amount.toString(), reason: String(reason) }
          },
          { session }
        );
      } catch (e) {
        if (e?.code !== 11000) throw e;
      }

      return walletRes;
    });

    res.json({ ok: true, balanceHrum: out.balanceHrum, idempotent: out.idempotent === true });
  } catch (err) {
    if (err?.code === 'INSUFFICIENT_HRUM') return res.status(400).json({ error: 'insufficient_hrum' });
    res.status(500).json({ error: 'revoke_failed' });
  }
});

module.exports = router;
