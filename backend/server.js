const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios'); // axios для проверки reCAPTCHA

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use((_req, res, next) => {
  res.setHeader('Content-Language', 'ru');
  next();
});

// --- Модели ---
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true, trim: true },
  password: String,
  online: Boolean,
  age: { type: Number, default: null },
  city: { type: String, default: null },
  status: { type: String, default: null },
  avatarUrl: { type: String, default: null },
  theme: {
    pageBg: { type: String, default: "" },
    chatBg: { type: String, default: "" }
  }
});
const messageSchema = new mongoose.Schema({
  text: String,
  sender: String,
  channel: String,
  fileUrl: String,
  fileType: String, // добавлено
  originalName: String, // добавлено
  createdAt: { type: Date, default: Date.now },
});
const channelSchema = new mongoose.Schema({
  name: String,
  members: [String],
});
const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);
const Channel = mongoose.model('Channel', channelSchema);

// --- Аутентификация ---
const SECRET = 'jwt_secret';
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// --- Регистрация и вход ---
app.post('/api/register', async (req, res) => {
  let { username, password, recaptcha } = req.body;
  // Проверка reCAPTCHA только при регистрации
  if (!recaptcha) return res.status(400).json({ error: 'reCAPTCHA не пройдена' });
  try {
    const verifyRes = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify`,
      new URLSearchParams({
        secret: '6Lddfm0rAAAAAOcsDbF3F-f38QZQGeOUeI2EKGlE',
        response: recaptcha,
      })
    );
    if (!verifyRes.data.success) {
      console.log("reCAPTCHA fail:", verifyRes.data);
      return res.status(400).json({ error: 'Ошибка reCAPTCHA' });
    }
  } catch (e) {
    console.log("reCAPTCHA error:", e?.response?.data || e.message);
    return res.status(400).json({ error: 'Ошибка проверки reCAPTCHA' });
  }
  let uname = username;
  let pass = password;
  if (!uname) {
    return res.status(400).json({ error: 'Имя пользователя обязательно' });
  }
  uname = uname.trim();
  if (uname.length > 15) {
    return res.status(400).json({ error: 'Имя пользователя не должно превышать 15 символов' });
  }
  if (!pass) {
    return res.status(400).json({ error: 'Пароль обязателен' });
  }
  // Проверка уникальности 
  const exists = await User.findOne({ username: uname });
  if (exists) {
    return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
  }
  try {
    const hash = await bcrypt.hash(pass, 10);
    const fs = require('fs');
    const defaultSource = path.join(__dirname, 'avatar-default.png');
    const defaultDest = path.join(__dirname, 'uploads', 'avatar-default.png');
    if (!fs.existsSync(defaultDest)) {
      try {
        fs.copyFileSync(defaultSource, defaultDest);
      } catch (e) {
        // Если файла нет, просто не ставим аватар
      }
    }
    const defaultAvatar = "/uploads/avatar-default.png";
    const user = new User({
      username: uname,
      password: hash,
      online: false,
      avatarUrl: fs.existsSync(defaultDest) ? defaultAvatar : null,
      age: null,
      city: null,
      status: null,
      theme: { pageBg: "", chatBg: "" }
    });
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
    }
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  // Капча не требуется для входа
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: 'Неверные данные' });
  const token = jwt.sign({ username }, SECRET);
  user.online = true;
  await user.save();
  res.json({ token });
});

// --- Каналы ---
app.post('/api/channels', auth, async (req, res) => {
  const { name, members } = req.body;
  const channel = new Channel({ name, members });
  await channel.save();
  res.json(channel);
  //  уведомить всех клиентов о новом канале
  io.emit('new-channel');
});
app.get('/api/channels', auth, async (_req, res) => {
  //  все каналы для любого пользователя
  const channels = await Channel.find();
  res.json(channels);
});

// --- Сообщения ---
app.get('/api/messages/:channel', auth, async (req, res) => {
  const messages = await Message.find({ channel: req.params.channel });
  res.json(messages);
});

// --- Загрузка файлов ---
const upload = multer({ dest: path.join(__dirname, 'uploads') });
app.post('/api/upload', auth, upload.single('file'), async (req, res) => {
  // Если передан avatar=1, обновляем профиль пользователя (оставляем старое поведение)
  let url;
  let fileType = req.file.mimetype;
  let originalName = req.file.originalname;

  if (req.query.avatar === '1') {
    url = `/uploads/${req.file.filename}`;
    await User.updateOne(
      { username: req.user.username },
      { avatarUrl: url }
    );
    return res.json({ url, fileType, originalName });
  }

  // Для обычных файлов сохраняем в папку пользователя с оригинальным именем (UTF-8)
  const username = req.user.username;
  const uploadsDir = path.join(__dirname, 'uploads');
  const userDir = path.join(uploadsDir, username);

  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  // Попытка исправить некорректно декодированные имена (например, "Ð¡Ð½Ð¸Ð¼Ð¾Ðº ÑÐºÑÐ°Ð½Ð°")
  let fixedOriginalName = req.file.originalname;
  function fixCyrillic(str) {
    try {
      return Buffer.from(str, 'latin1').toString('utf8');
    } catch {
      return str;
    }
  }
  fixedOriginalName = fixCyrillic(fixedOriginalName);

  let baseName = path.basename(fixedOriginalName, path.extname(fixedOriginalName));
  let ext = path.extname(fixedOriginalName);
  let destName = fixedOriginalName;
  let destPath = path.join(userDir, destName);
  let counter = 1;
  while (fs.existsSync(destPath)) {
    destName = `${baseName}_${counter}${ext}`;
    destPath = path.join(userDir, destName);
    counter++;
  }

  // --- Исправление: корректное перемещение файла, чтобы не портить видео ---
  try {
    fs.renameSync(req.file.path, destPath);
  } catch (err) {
    // Если не удалось переименовать (например, разные диски), копируем потоками
    await new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(req.file.path);
      const writeStream = fs.createWriteStream(destPath);
      readStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('close', resolve);
      readStream.pipe(writeStream);
    });
    fs.unlinkSync(req.file.path);
  }
  // --- /Исправление ---

  url = `/uploads/${username}/${encodeURIComponent(destName)}`;
  // Возвращаем и оригинальное имя, и имя на сервере
  res.json({ url, fileType, originalName: fixedOriginalName, savedName: destName });
});

// --- Только express.static для отдачи файлов ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Раздача production фронтенда ---
// отдаём index.html если build существует, иначе показываем заглушку
const pathToFrontendBuild = path.join(__dirname, '..', 'frontend', 'build');
if (fs.existsSync(path.join(pathToFrontendBuild, 'index.html'))) {
  app.use(express.static(pathToFrontendBuild));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(pathToFrontendBuild, 'index.html'));
  });
} else {
  // Если build отсутствует, показываем простую заглушку
  app.get('*', (_req, res) => {
    res.send(`
      <html>
        <head>
          <title>ГоВЧат</title>
          <style>
            body { background: #232526; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .msg { background: #35363a; padding: 32px 48px; border-radius: 16px; box-shadow: 0 2px 16px #00c3ff33; }
          </style>
        </head>
        <body>
          <div class="msg">
            <h2>Фронтенд не собран</h2>
            <p>Соберите React-фронтенд командой <code>npm run build</code> в папке <b>frontend</b>.<br/>
            Или откройте <a href="http://localhost:3000" style="color:#00c3ff">http://localhost:3000</a> если используете dev-сервер.</p>
          </div>
        </body>
      </html>
    `);
  });
}

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  res.sendFile(path.join(pathToFrontendBuild, 'index.html'));
});

// --- Профиль пользователя ---
app.get('/api/profile', auth, async (req, res) => {
  const user = await User.findOne({ username: req.user.username });
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({
    username: user.username,
    age: user.age ?? null,
    city: user.city ?? null,
    status: user.status ?? null,
    avatarUrl: user.avatarUrl ?? null,
    theme: user.theme ?? { pageBg: "", chatBg: "" } // добавлено
  });
});

// PATCH /api/profile — изменение профиля
app.patch('/api/profile', auth, async (req, res) => {
  // Сохраняем старый username для поиска
  const oldUsername = req.user.username;
  const user = await User.findOne({ username: oldUsername });
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  const { username, password, city, status, age, avatarUrl, theme } = req.body;
  let token = null;
  // Проверка и изменение ника
  if (username && username !== user.username) {
    if (username.length > 15) return res.status(400).json({ error: 'Имя пользователя не должно превышать 15 символов' });
    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
    user.username = username.trim();
    token = jwt.sign({ username: user.username }, SECRET);
  }
  // Изменение пароля
  if (password && password.length > 0) {
    user.password = await bcrypt.hash(password, 10);
  }
  if (city !== undefined) user.city = city;
  if (status !== undefined) user.status = status;
  if (age !== undefined && age !== "" && !isNaN(Number(age))) user.age = Number(age);
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl; // обновление аватара
  if (theme !== undefined) user.theme = theme; // добавлено
  await user.save();
  const resp = {
    username: user.username,
    age: user.age ?? null,
    city: user.city ?? null,
    status: user.status ?? null,
    avatarUrl: user.avatarUrl ?? null,
    theme: user.theme ?? { pageBg: "", chatBg: "" } // добавлено
  };
  if (token) resp.token = token;
  res.json(resp);
});

// --- Socket.IO ---
const activeCalls = {}; // channelId: Set(socket.id)
const userChannels = {}; // socketId: Set(channelId) - отслеживаем в каких каналах находится пользователь

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Нет токена'));
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return next(new Error('Ошибка токена'));
    socket.user = user;
    next();
  });
});

io.on('connection', (socket) => {
  console.log(`User ${socket.user.username} connected with socket ID: ${socket.id}`);
  userChannels[socket.id] = new Set();

  // Отправить текущий статус активных звонков при подключении
  socket.emit('active-calls-update', { 
    activeCalls: Object.fromEntries(
      Object.entries(activeCalls).map(([channel, participants]) => [channel, participants.size > 0])
    )
  });

  socket.on('get-active-calls', () => {
    socket.emit('active-calls-update', { 
      activeCalls: Object.fromEntries(
        Object.entries(activeCalls).map(([channel, participants]) => [channel, participants.size > 0])
      )
    });
  });

  socket.on('join', (channel) => {
    socket.join(channel);
    userChannels[socket.id].add(channel);
    console.log(`User ${socket.user.username} joined channel: ${channel}`);
    
    // НОВОЕ: Проверяем есть ли активный звонок в канале и уведомляем пользователя
    if (activeCalls[channel] && activeCalls[channel].size > 0) {
      // Находим инициатора звонка (первого участника)
      const participants = Array.from(activeCalls[channel]);
      const initiatorSocketId = participants[0]; // берем первого как инициатора
      
      // Получаем имя инициатора через socket
      const initiatorSocket = io.sockets.sockets.get(initiatorSocketId);
      const initiatorName = initiatorSocket ? initiatorSocket.user.username : 'Неизвестный';
      
      // Отправляем уведомление только если пользователь не участвует в звонке
      if (!activeCalls[channel].has(socket.id)) {
        socket.emit('video-call-incoming', { 
          from: initiatorName, 
          channel,
          initiatorSocketId: initiatorSocketId
        });
        console.log(`Sent existing call notification to ${socket.user.username} for channel ${channel}`);
      }
    }
  });
  socket.on('message', async (msg) => {
    // Добавляем время, если не пришло с клиента
    if (!msg.createdAt) msg.createdAt = new Date();
    // Если есть fileUrl, fileType, originalName — сохраняем их
    const message = new Message({
      text: msg.text,
      sender: msg.sender,
      channel: msg.channel,
      fileUrl: msg.fileUrl,
      fileType: msg.fileType,
      originalName: msg.originalName,
      createdAt: msg.createdAt,
    });
    await message.save();
    io.to(msg.channel).emit('message', message);
  });
  socket.on('typing', (data) => {
    socket.to(data.channel).emit('typing', { user: socket.user.username });
  });
  socket.on('disconnect', async () => {
    await User.updateOne({ username: socket.user.username }, { online: false });
  });

  // --- Видеозвонки ---
  socket.on('video-call-initiate', ({ channel }) => {
    console.log(`User ${socket.user.username} initiating call in channel ${channel}`);
    
    // Убеждаемся, что пользователь присоединен к каналу
    socket.join(channel);
    if (!userChannels[socket.id]) userChannels[socket.id] = new Set();
    userChannels[socket.id].add(channel);
    
    // Добавляем инициатора к активному звонку
    if (!activeCalls[channel]) activeCalls[channel] = new Set();
    activeCalls[channel].add(socket.id);
    
    // Оповестить всех в канале (кроме инициатора) о входящем звонке
    socket.to(channel).emit('video-call-incoming', { 
      from: socket.user.username, 
      channel,
      initiatorSocketId: socket.id
    });
    
    // Уведомить ВСЕХ пользователей о том, что в канале начался звонок
    io.emit('video-call-status', { channel, active: true });
    
    console.log(`Sent incoming call notification to channel ${channel}`);
  });

  socket.on('video-call-join', ({ channel }) => {
    console.log(`User ${socket.user.username} joining call in channel ${channel}`);
    
    // Присоединиться к комнате канала
    socket.join(channel);
    if (!userChannels[socket.id]) userChannels[socket.id] = new Set();
    userChannels[socket.id].add(channel);
    
    if (!activeCalls[channel]) activeCalls[channel] = new Set();
    
    // Получить список других участников до добавления текущего
    const others = Array.from(activeCalls[channel]).filter(id => id !== socket.id);
    console.log(`Existing participants in ${channel}:`, others.length);
    
    // Добавить текущего пользователя
    activeCalls[channel].add(socket.id);
    
    // Сообщить новому участнику о других участниках звонка
    socket.emit('video-call-participants', { participants: others });
    
    // Оповестить других, что пользователь присоединился к звонку
    socket.to(channel).emit('video-call-joined', { 
      user: socket.user.username, 
      socketId: socket.id 
    });
    
    // Если это первый участник, уведомить всех о начале звонка
    if (activeCalls[channel].size === 1) {
      socket.to(channel).emit('video-call-incoming', { 
        from: socket.user.username, 
        channel,
        initiatorSocketId: socket.id
      });
      // Уведомить ВСЕХ пользователей о том, что в канале начался звонок
      io.emit('video-call-status', { channel, active: true });
    }
    
    console.log(`User ${socket.user.username} joined call. Total participants in ${channel}:`, activeCalls[channel].size);
  });

  socket.on('video-call-leave', ({ channel }) => {
    console.log(`User ${socket.user.username} leaving call in channel ${channel}`);
    if (activeCalls[channel]) {
      activeCalls[channel].delete(socket.id);
      socket.to(channel).emit('video-call-left', { 
        user: socket.user.username, 
        socketId: socket.id 
      });
      
      if (activeCalls[channel].size === 0) {
        delete activeCalls[channel];
        // Уведомляем всех в канале о завершении звонка
        io.to(channel).emit('video-call-ended', { by: socket.user.username, channel });
        // Уведомить ВСЕХ пользователей о том, что звонок в канале завершился
        io.emit('video-call-status', { channel, active: false });
        console.log(`Channel ${channel} call ended - no participants left`);
      } else {
        console.log(`Participants remaining in ${channel}:`, activeCalls[channel].size);
      }
    }
  });

  socket.on('video-call-end', ({ channel }) => {
    console.log(`User ${socket.user.username} ending call in channel ${channel}`);
    // Оповестить всех о завершении звонка
    io.to(channel).emit('video-call-ended', { by: socket.user.username, channel });
    // Уведомить ВСЕХ пользователей о том, что звонок в канале завершился
    io.emit('video-call-status', { channel, active: false });
    if (activeCalls[channel]) {
      delete activeCalls[channel];
    }
  });

  // WebRTC signaling
  socket.on('video-signal', ({ to, data }) => {
    console.log(`Relaying ${data.type || 'candidate'} from ${socket.id} to ${to}`);
    if (to) {
      io.to(to).emit('video-signal', { 
        from: socket.id, 
        data, 
        username: socket.user.username 
      });
    }
  });

  socket.on('disconnect', async () => {
    console.log(`User ${socket.user?.username} disconnected`);
    
    if (socket.user?.username) {
      await User.updateOne({ username: socket.user.username }, { online: false });
    }
    
    // Удалить из всех звонков
    for (const channel in activeCalls) {
      if (activeCalls[channel].has(socket.id)) {
        activeCalls[channel].delete(socket.id);
        socket.to(channel).emit('video-call-left', { 
          user: socket.user?.username, 
          socketId: socket.id 
        });
        
        if (activeCalls[channel].size === 0) {
          delete activeCalls[channel];
          // Уведомляем всех о завершении звонка при отключении последнего участника
          io.to(channel).emit('video-call-ended', { by: socket.user?.username, channel });
          // Уведомить ВСЕХ пользователей о том, что звонок в канале завершился
          io.emit('video-call-status', { channel, active: false });
          console.log(`Channel ${channel} call ended due to disconnect`);
        }
      }
    }
    
    // Очистить каналы пользователя
    delete userChannels[socket.id];
  });
});

// --- Запуск ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://sanya210105:KBu09c0aYFWCdBaU@cluster0.fav8tsg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI)
  .then(() => {
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`Сервер запущен на ${PORT}`));
  })
  .catch(console.error);