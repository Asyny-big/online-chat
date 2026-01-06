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

// Статические файлы
app.use('/uploads', express.static(uploadsDir));

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

// Загрузка файлов
const authMiddleware = require('./middleware/auth');
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
  app.use(express.static(frontendBuild));
  app.get('*', (req, res) => {
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