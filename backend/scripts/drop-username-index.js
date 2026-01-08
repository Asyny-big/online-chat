// Скрипт для удаления устаревшего индекса username_1
const mongoose = require('mongoose');
const config = require('../config.local');

async function dropIndex() {
  try {
    await mongoose.connect(config.MONGO_URI || config.MONGODB_URI);
    console.log('Connected to MongoDB');

    const indexes = await mongoose.connection.collection('users').indexes();
    console.log('Current indexes:', indexes.map(i => i.name));

    // Удаляем старый индекс username_1
    try {
      await mongoose.connection.collection('users').dropIndex('username_1');
      console.log('✅ Index username_1 dropped successfully');
    } catch (e) {
      if (e.codeName === 'IndexNotFound') {
        console.log('ℹ️ Index username_1 does not exist (already dropped)');
      } else {
        console.error('❌ Error dropping index:', e.message);
      }
    }

    // Показываем оставшиеся индексы
    const remainingIndexes = await mongoose.connection.collection('users').indexes();
    console.log('Remaining indexes:', remainingIndexes.map(i => i.name));

    await mongoose.disconnect();
    console.log('Done');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

dropIndex();
