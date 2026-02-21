const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Chat = require('../models/Chat');
const authMiddleware = require('../middleware/auth');
const HttpRateLimiter = require('../utils/httpRateLimiter');
const { isValidPhoneExact, findUserByExactPhone } = require('../utils/userLookup');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

router.use(authMiddleware);

// uploads (для аватаров)
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5MB

function extractUploadedFilename(url) {
  if (!url || typeof url !== 'string') return null;
  const clean = url.split('?')[0];
  const filename = clean.split('/').pop();
  return filename || null;
}

function isUserUploadAvatarUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('/uploads/') || url.startsWith('/api/uploads/');
}

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : '';
    cb(null, `avatar_${req.userId}_${Date.now()}${safeExt}`);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: AVATAR_MAX_BYTES },
  fileFilter: (req, file, cb) => {
    const ok = typeof file.mimetype === 'string' && file.mimetype.startsWith('image/');
    if (!ok) return cb(new Error('ONLY_IMAGES_ALLOWED'));
    cb(null, true);
  }
});

const searchLimiter = new HttpRateLimiter({ windowMs: 60_000, maxRequests: 20 });

// Получение контактов (пользователи из существующих чатов)
router.get('/contacts', async (req, res) => {
  try {
    // Находим все приватные чаты пользователя
    const chats = await Chat.find({
      'participants.user': req.userId,
      type: 'private'
    }).populate('participants.user', 'name phone avatarUrl status');

    // Извлекаем уникальных пользователей (не себя)
    const contactsMap = new Map();
    
    chats.forEach(chat => {
      chat.participants.forEach(p => {
        if (p.user && p.user._id.toString() !== req.userId) {
          contactsMap.set(p.user._id.toString(), {
            _id: p.user._id,
            name: p.user.name,
            phone: p.user.phone,
            avatarUrl: p.user.avatarUrl,
            status: p.user.status
          });
        }
      });
    });

    const contacts = Array.from(contactsMap.values());
    res.json(contacts);
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Ошибка получения контактов' });
  }
});

// Поиск пользователя по номеру телефона (single-result).
// Принимаем распространенные форматы: +7/7/8, пробелы, скобки и дефисы.
router.get('/search', async (req, res) => {
  try {
    const { phone } = req.query;

    if (typeof phone !== 'string') {
      return res.status(400).json({ error: 'phone is required' });
    }

    const rawPhone = phone.trim();
    const digitCount = rawPhone.replace(/\D/g, '').length;

    // Порог защиты от перебора/частичных запросов.
    if (digitCount < 9) {
      return res.status(400).json({ error: 'phone is too short' });
    }

    if (!isValidPhoneExact(rawPhone)) {
      return res.status(400).json({ error: 'invalid phone format' });
    }

    // Rate limit (пер-юзер). Короткий ввод никогда не приводит к выдаче пользователей.
    const key = String(req.userId || 'anon');
    if (!searchLimiter.take(key)) {
      return res.status(429).json({ error: 'too many requests' });
    }

    const result = await findUserByExactPhone({
      phone: rawPhone,
      excludeUserId: req.userId
    });

    return res.json(result);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Ошибка поиска' });
  }
});

// Получение профиля текущего пользователя
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.json(user.toPublicJSON());
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Ошибка получения профиля' });
  }
});

// Обновление профиля
router.patch('/me', async (req, res) => {
  try {
    const { username, name, avatarUrl, city, status, age, theme, password } = req.body;
    const updates = {};

    // Поддерживаем и name, и username для обратной совместимости
    if (username) updates.name = username.trim();
    if (name) updates.name = name.trim();
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    
    // Профильные поля
    if (city !== undefined) updates.city = city?.trim() || '';
    if (status !== undefined) updates.status = status?.trim() || '';
    if (age !== undefined) updates.age = age === '' ? null : Number(age);
    if (theme !== undefined) updates.theme = theme;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Если передан пароль — обновляем отдельно
    if (password && password.trim()) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
      }
      await user.setPassword(password.trim());
    }

    // Применяем остальные обновления
    Object.assign(user, updates);
    await user.save();

    res.json(user.toPublicJSON());
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
});

// Загрузка аватара
router.post('/me/avatar', avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Удаляем предыдущий аватар (если это наш uploads и не дефолт)
    try {
      const prev = user.avatarUrl;
      const prevFilename = extractUploadedFilename(prev);
      const isDefault = prevFilename === 'avatar-default.png';
      if (!isDefault && isUserUploadAvatarUrl(prev) && prevFilename) {
        const prevPath = path.join(uploadsDir, prevFilename);
        if (fs.existsSync(prevPath)) {
          fs.unlinkSync(prevPath);
        }
      }
    } catch (_) {}

    user.avatarUrl = `/api/uploads/${req.file.filename}`;
    await user.save();

    res.json(user.toPublicJSON());
  } catch (error) {
    if (error && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Максимальный размер аватара: 5 МБ' });
    }
    if (String(error?.message || '') === 'ONLY_IMAGES_ALLOWED') {
      return res.status(400).json({ error: 'Можно загрузить только изображение' });
    }
    console.error('Upload avatar error:', error);
    res.status(500).json({ error: 'Ошибка загрузки аватара' });
  }
});

// Смена пароля
router.post('/me/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Укажите текущий и новый пароль' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Новый пароль должен быть не менее 6 символов' });
    }

    const user = await User.findById(req.userId);
    const isValid = await user.checkPassword(currentPassword);

    if (!isValid) {
      return res.status(401).json({ error: 'Неверный текущий пароль' });
    }

    await user.setPassword(newPassword);
    await user.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Ошибка смены пароля' });
  }
});

module.exports = router;
