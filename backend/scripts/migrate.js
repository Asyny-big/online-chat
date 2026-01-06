// Скрипт миграции (запускать отдельно)
const mongoose = require('mongoose');
const config = require('../config.local');

// Старые модели (если есть)
// const OldUser = require('./old-models/User');
// const OldChannel = require('./old-models/Channel');
// const OldMessage = require('./old-models/Message');

// Новые модели
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');

async function migrate() {
  await mongoose.connect(config.MONGODB_URI);
  console.log('Connected to MongoDB');

  // 1. Миграция пользователей
  // - Добавить поле phone (можно сгенерировать временный)
  // - Нормализовать данные

  // 2. Миграция каналов -> чаты
  // - Конвертировать каналы в групповые чаты
  // - Назначить создателя админом

  // 3. Миграция сообщений
  // - Привязать к новым chatId

  console.log('Migration completed');
  process.exit(0);
}

migrate().catch(console.error);
