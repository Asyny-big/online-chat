require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const config = require('./config.local');

// Роуты
const authRoutes = require('./routes/auth');
const chatsRoutes = require('./routes/chats');
const messagesRoutes = require('./routes/messages');
const usersRoutes = require('./routes/users');
const webrtcRoutes = require('./routes/webrtc');
const livekitRoutes = require('./routes/livekit');
const meRoutes = require('./routes/me');
const economyRoutes = require('./routes/economy');
const adminEconomyRoutes = require('./routes/adminEconomy');

// Socket.IO
const setupSocket = require('./socket');

const app = express();
const server = http.createServer(app);

// CORS
app.use(cors({
  origin: config.CORS_ORIGINS || ['http://localhost:3000', 'https://govchat.ru', 'https://frutin.me'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Создание папки uploads если не существует
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// MIME-типы для корректного воспроизведения
const mimeTypes = {
  '.webm': 'audio/webm',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
};

// Роут для скачивания файлов с правильными заголовками
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);

  // Проверка существования файла
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Файл не найден' });
  }

  // Получение расширения и MIME-типа
  const ext = path.extname(filename).toLowerCase();
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  // Установка заголовков
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Accept-Ranges', 'bytes');

  // Для аудио/видео - inline, для остальных - attachment
  const isMedia = mimeType.startsWith('audio/') || mimeType.startsWith('video/') || mimeType.startsWith('image/');
  if (isMedia) {
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  } else {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  }

  // Поддержка Range requests для аудио/видео
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range && (mimeType.startsWith('audio/') || mimeType.startsWith('video/'))) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize);
    res.status(206);

    const stream = fs.createReadStream(filePath, { start, end });
    stream.pipe(res);
  } else {
    res.setHeader('Content-Length', fileSize);
    fs.createReadStream(filePath).pipe(res);
  }
});

// Middleware для авторизации (нужен для download endpoint)
const authMiddleware = require('./middleware/auth');

// Endpoint для скачивания файлов с оригинальным именем
app.get('/api/download/:filename', authMiddleware, (req, res) => {
  const { filename } = req.params;
  const originalName = req.query.name || filename;

  const filePath = path.join(uploadsDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Файл не найден' });
  }

  const ext = path.extname(filename).toLowerCase();
  const mimeType = mimeTypes[ext] || 'application/octet-stream';
  const stat = fs.statSync(filePath);

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', stat.size);
  // RFC 5987: filename*=UTF-8'' для поддержки Unicode в именах файлов
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName).replace(/%20/g, ' ')}"; filename*=UTF-8''${encodeURIComponent(originalName)}`);

  fs.createReadStream(filePath).pipe(res);
});

// Загрузка файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// API роуты
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/me', meRoutes);
app.use('/api/webrtc', webrtcRoutes);
app.use('/api/livekit', livekitRoutes);
app.use('/api/economy', economyRoutes);
app.use('/api/admin/economy', adminEconomyRoutes);

// Загрузка файлов
app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }
  res.json({
    url: `/uploads/${req.file.filename}`,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size
  });
});

// SPA fallback (только если есть build)
const frontendBuild = path.join(__dirname, '../frontend/build');
if (fs.existsSync(frontendBuild)) {
  // ВАЖНО: правильная стратегия кеширования для SPA.
  // - index.html НЕ кешируем (иначе браузер будет грузить старые ссылки на чанки)
  // - хэшированные ассеты (js/css/media) можно кешировать долго (immutable)
  app.use(express.static(frontendBuild, {
    setHeaders: (res, filePath) => {
      try {
        const normalized = String(filePath || '').replace(/\\/g, '/');
        const isHtml = normalized.endsWith('/index.html') || normalized.endsWith('.html');
        const isServiceWorker = /service-worker\.js$|sw\.js$/i.test(normalized);
        const isHashedAsset = /\/static\/(css|js)\/.+\.[0-9a-f]{8,}\.(css|js)$/i.test(normalized);

        if (isHtml || isServiceWorker) {
          // Обновления UI должны применяться сразу на всех браузерах.
          res.setHeader('Cache-Control', 'no-store, must-revalidate');
          return;
        }

        if (isHashedAsset) {
          // CRA генерирует хэш в имени файла — это безопасно кешировать надолго.
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          return;
        }

        // Прочие файлы (manifest, icons и т.п.) — умеренный кеш.
        res.setHeader('Cache-Control', 'public, max-age=300');
      } catch (e) {
        // no-op
      }
    }
  }));
  app.get('*', (req, res) => {
    // Никогда не отдаём SPA вместо API.
    if (req.path && req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
}

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: config.CORS_ORIGINS || ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const socketData = setupSocket(io);
app.set('io', io);
app.set('socketData', socketData);

// Подключение к MongoDB
mongoose.connect(config.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

mongoose.connection.once('open', async () => {
  try {
    const { ensureEconomyIndexes } = require('./economy/indexes');
    await ensureEconomyIndexes(mongoose.connection.db);
    console.log('Economy indexes ensured');

    const { ensureEconomySeed } = require('./economy/seed');
    await ensureEconomySeed(mongoose.connection.db);
    console.log('Economy seed ensured');
  } catch (e) {
    console.error('Economy indexes ensure failed:', e);
  }
});

// Запуск сервера
const PORT = config.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    mongoose.connection.close(false, () => {
      process.exit(0);
    });
  });
});
