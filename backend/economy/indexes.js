async function ensureEconomyIndexes(db) {
  const wallets = db.collection('wallets');
  const walletTransactions = db.collection('wallet_transactions');
  const rewards = db.collection('rewards');
  const shopItems = db.collection('shop_items');
  const userItems = db.collection('user_items');
  const adminActions = db.collection('admin_actions');
  const economyLimits = db.collection('economy_limits');

  await wallets.createIndex({ userId: 1 }, { unique: true, name: 'uniq_wallet_userId' });
  await wallets.createIndex({ updatedAt: -1 }, { name: 'wallet_updatedAt' });

  await walletTransactions.createIndex({ idempotencyKey: 1 }, { unique: true, name: 'uniq_tx_idempotencyKey' });
  await walletTransactions.createIndex(
    { userId: 1, dedupeKey: 1 },
    {
      unique: true,
      name: 'uniq_tx_user_dedupeKey',
      partialFilterExpression: { dedupeKey: { $type: 'string' } }
    }
  );
  await walletTransactions.createIndex({ userId: 1, createdAt: -1 }, { name: 'tx_user_createdAt' });
  await walletTransactions.createIndex({ walletId: 1, createdAt: -1 }, { name: 'tx_wallet_createdAt' });
  await walletTransactions.createIndex({ reasonCode: 1, createdAt: -1 }, { name: 'tx_reason_createdAt' });

  await rewards.createIndex({ key: 1 }, { unique: true, name: 'uniq_reward_key' });
  await rewards.createIndex({ enabled: 1 }, { name: 'reward_enabled' });

  await shopItems.createIndex({ sku: 1 }, { unique: true, name: 'uniq_shop_sku' });
  await shopItems.createIndex({ enabled: 1, type: 1 }, { name: 'shop_enabled_type' });

  await userItems.createIndex({ userId: 1, itemId: 1 }, { unique: true, name: 'uniq_user_item' });
  await userItems.createIndex({ userId: 1, acquiredAt: -1 }, { name: 'user_items_user_acquiredAt' });

  await adminActions.createIndex({ idempotencyKey: 1 }, { unique: true, name: 'uniq_admin_idempotencyKey' });
  await adminActions.createIndex({ adminUserId: 1, createdAt: -1 }, { name: 'admin_actions_admin_createdAt' });
  await adminActions.createIndex({ targetUserId: 1, createdAt: -1 }, { name: 'admin_actions_target_createdAt' });

  await economyLimits.createIndex(
    { scope: 1, scopeId: 1, key: 1, bucket: 1 },
    { unique: true, name: 'uniq_limits_scope_key_bucket' }
  );
  await economyLimits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_limits_expiresAt' });
}

module.exports = { ensureEconomyIndexes };

