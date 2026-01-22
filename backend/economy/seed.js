const { toLong } = require('./long');

async function ensureEconomySeed(db) {
  const rewards = db.collection('rewards');
  const shopItems = db.collection('shop_items');
  const now = new Date();

  await rewards.updateOne(
    { key: 'daily_login' },
    {
      $setOnInsert: {
        key: 'daily_login',
        title: 'Ежедневный вход',
        enabled: true,
        amountHrum: toLong(10),
        meta: { maxStreakDays: 7, cooldownHours: 24, perStreakBonusHrum: 2 },
        createdAt: now,
        updatedAt: now
      }
    },
    { upsert: true }
  );

  await rewards.updateOne(
    { key: 'message' },
    {
      $setOnInsert: {
        key: 'message',
        title: 'Сообщения',
        enabled: true,
        amountHrum: toLong(1),
        meta: { minLen: 20, dailyCap: 20 },
        createdAt: now,
        updatedAt: now
      }
    },
    { upsert: true }
  );

  await rewards.updateOne(
    { key: 'call_start' },
    {
      $setOnInsert: {
        key: 'call_start',
        title: 'Начало звонка',
        enabled: true,
        amountHrum: toLong(3),
        meta: { dailyCap: 5 },
        createdAt: now,
        updatedAt: now
      }
    },
    { upsert: true }
  );

  const items = [
    {
      sku: 'theme_neon_blue',
      type: 'theme',
      title: 'Тема: Неон',
      description: 'Косметическая тема интерфейса',
      priceHrum: toLong(120),
      enabled: true,
      sort: 10,
      meta: { themeId: 'neon_blue' }
    },
    {
      sku: 'theme_dark_graphite',
      type: 'theme',
      title: 'Тема: Графит',
      description: 'Косметическая тема интерфейса',
      priceHrum: toLong(90),
      enabled: true,
      sort: 20,
      meta: { themeId: 'dark_graphite' }
    },
    {
      sku: 'sticker_pack_basic',
      type: 'sticker_pack',
      title: 'Стикер‑пак: Базовый',
      description: 'Набор стикеров для чатов',
      priceHrum: toLong(80),
      enabled: true,
      sort: 30,
      meta: { packId: 'basic' }
    },
    {
      sku: 'profile_frame_minimal',
      type: 'cosmetic',
      title: 'Рамка профиля: Минимал',
      description: 'Косметическая рамка для аватара',
      priceHrum: toLong(60),
      enabled: true,
      sort: 40,
      meta: { cosmeticId: 'profile_frame_minimal' }
    }
  ];

  for (const item of items) {
    await shopItems.updateOne(
      { sku: item.sku },
      { $setOnInsert: { ...item, createdAt: now, updatedAt: now } },
      { upsert: true }
    );
  }
}

module.exports = { ensureEconomySeed };

