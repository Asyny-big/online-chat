const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const { toLong, longNeg, longToString, longGte } = require('./long');
const { withMongoTransaction } = require('./tx');
const { ensureWallet, applyWalletDeltaInSession } = require('./walletService');

function getDb() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected');
  return db;
}

async function listShopItems() {
  const db = getDb();
  const shopItems = db.collection('shop_items');
  const items = await shopItems.find({ enabled: true }).sort({ sort: 1, sku: 1 }).toArray();
  return items.map((i) => ({
    sku: i.sku,
    type: i.type,
    title: i.title,
    description: i.description,
    priceHrum: longToString(i.priceHrum),
    meta: i.meta || {}
  }));
}

async function listOwnedSkus({ userId }) {
  const db = getDb();
  const userItems = db.collection('user_items');
  const docs = await userItems
    .find({ userId: new ObjectId(userId) }, { projection: { sku: 1 } })
    .sort({ acquiredAt: -1, _id: -1 })
    .toArray();
  return docs.map((d) => String(d?.sku || '')).filter(Boolean);
}

async function listShopItemsForUser({ userId }) {
  const db = getDb();
  const shopItems = db.collection('shop_items');

  // Ensure wallet exists, so "canPurchase" is meaningful for brand-new users.
  const wallet = await ensureWallet({ userId });
  const balance = toLong(wallet?.balanceHrum || 0);

  const ownedSkus = new Set(await listOwnedSkus({ userId }));
  const items = await shopItems.find({ enabled: true }).sort({ sort: 1, sku: 1 }).toArray();

  return {
    balanceHrum: longToString(balance),
    ownedSkus: Array.from(ownedSkus),
    items: items.map((i) => {
      const sku = String(i.sku);
      const owned = ownedSkus.has(sku);
      const price = toLong(i.priceHrum);
      const canPurchase = !owned && longGte(balance, price);
      return {
        sku,
        type: i.type,
        title: i.title,
        description: i.description,
        priceHrum: longToString(price),
        owned,
        canPurchase,
        meta: i.meta || {}
      };
    })
  };
}

async function buyShopItem({ userId, sku }) {
  if (!sku || typeof sku !== 'string') throw new Error('sku is required');

  const db = getDb();
  const shopItems = db.collection('shop_items');
  const userItems = db.collection('user_items');

  return withMongoTransaction(async (session) => {
    const item = await shopItems.findOne({ sku, enabled: true }, { session });
    if (!item) {
      const err = new Error('ITEM_NOT_FOUND');
      err.code = 'ITEM_NOT_FOUND';
      throw err;
    }

    const wallet = await ensureWallet({ userId, session });

    const existing = await userItems.findOne({ userId: new ObjectId(userId), itemId: item._id }, { session });
    if (existing) {
      return {
        ok: true,
        purchased: false,
        reason: 'already_owned',
        sku,
        balanceHrum: longToString(wallet?.balanceHrum || 0)
      };
    }

    const amount = toLong(item.priceHrum);

    const spendRes = await applyWalletDeltaInSession({
      session,
      userId,
      deltaHrum: longNeg(amount),
      reasonCode: 'spend:shop',
      dedupeKey: `shop:${sku}`,
      idempotencyKey: `spend:shop:${userId}:${sku}`,
      meta: { sku, itemId: String(item._id), type: item.type }
    });
    if (spendRes?.idempotent) {
      return { ok: true, purchased: false, reason: 'dup', sku, balanceHrum: spendRes.balanceHrum };
    }

    await userItems.insertOne(
      {
        userId: new ObjectId(userId),
        itemId: item._id,
        sku: item.sku,
        type: item.type,
        acquiredAt: new Date(),
        source: 'shop',
        meta: item.meta || {}
      },
      { session }
    );

    return { ok: true, purchased: true, sku, balanceHrum: spendRes.balanceHrum };
  });
}

module.exports = { listShopItems, listOwnedSkus, listShopItemsForUser, buyShopItem };
