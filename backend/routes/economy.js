const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getBalanceHrumString, listWalletTransactions } = require('../economy/walletService');
const { claimDailyLogin } = require('../economy/rewardsService');
const { listShopItemsForUser, buyShopItem } = require('../economy/shopService');
const { listTasks, claimTask } = require('../economy/tasksService');

router.use(authMiddleware);

router.get('/wallet', async (req, res) => {
  try {
    const balanceHrum = await getBalanceHrumString({ userId: req.userId });
    res.json({ balanceHrum });
  } catch (_err) {
    res.status(500).json({ error: 'wallet_failed' });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const { limit, before } = req.query;
    const items = await listWalletTransactions({ userId: req.userId, limit, before });
    res.json({ items });
  } catch (_err) {
    res.status(500).json({ error: 'transactions_failed' });
  }
});

router.post('/earn/daily-login', async (req, res) => {
  try {
    const deviceId = req.header('X-Device-Id') || null;
    const ip = req.headers['x-forwarded-for']?.split(',')?.[0]?.trim() || req.socket?.remoteAddress || null;
    const userAgent = req.header('User-Agent') || null;

    const result = await claimDailyLogin({ userId: req.userId, ip, userAgent, deviceId });
    res.json(result);
  } catch (err) {
    if (err?.code === 'COOLDOWN_ACTIVE') return res.status(429).json({ error: 'cooldown_active' });
    console.error('[Economy] daily-login failed:', {
      userId: req.userId,
      code: err?.code,
      message: err?.message
    });
    if (err?.stack) console.error(err.stack);
    res.status(500).json({ error: 'daily_login_failed' });
  }
});

router.get('/shop/items', async (_req, res) => {
  try {
    const out = await listShopItemsForUser({ userId: _req.userId });
    res.json(out);
  } catch (_err) {
    res.status(500).json({ error: 'shop_failed' });
  }
});

router.post('/shop/buy', async (req, res) => {
  try {
    const { sku } = req.body || {};
    const out = await buyShopItem({ userId: req.userId, sku });
    res.json(out);
  } catch (err) {
    if (err?.code === 'ITEM_NOT_FOUND') return res.status(404).json({ error: 'item_not_found' });
    if (err?.code === 'INSUFFICIENT_HRUM') return res.status(400).json({ error: 'insufficient_hrum' });
    res.status(500).json({ error: 'buy_failed' });
  }
});

router.get('/tasks', async (req, res) => {
  try {
    const out = await listTasks({ userId: req.userId });
    res.json(out);
  } catch (_err) {
    res.status(500).json({ error: 'tasks_failed' });
  }
});

router.post('/tasks/claim', async (req, res) => {
  try {
    const { taskId } = req.body || {};
    const deviceId = req.header('X-Device-Id') || null;
    const ip = req.headers['x-forwarded-for']?.split(',')?.[0]?.trim() || req.socket?.remoteAddress || null;
    const userAgent = req.header('User-Agent') || null;

    const out = await claimTask({ userId: req.userId, taskId, deviceId, ip, userAgent });
    res.json(out);
  } catch (err) {
    if (err?.code === 'TASK_NOT_FOUND') return res.status(404).json({ error: 'task_not_found' });
    if (err?.code === 'TASK_NOT_COMPLETED') return res.status(400).json({ error: 'task_not_completed' });
    if (err?.code === 'TASK_ALREADY_CLAIMED') return res.status(200).json({ ok: true, claimed: false, reason: 'already_claimed' });
    if (err?.code === 'COOLDOWN_ACTIVE') return res.status(429).json({ error: 'cooldown_active' });
    res.status(500).json({ error: 'task_claim_failed' });
  }
});

module.exports = router;
