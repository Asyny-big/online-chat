const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/me - профиль текущего пользователя
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    res.json({
      id: user._id,
      name: user.name,
      phone: user.phone,
      avatar: user.avatarUrl || null,
      theme: user.theme ?? null,
      createdAt: user.createdAt,
    });
  } catch (e) {
    console.error('GET /api/me error:', e);
    res.status(500).json({ error: 'Ошибка получения профиля' });
  }
});

// PATCH /api/me - обновление имени/темы (номер телефона неизменяем)
router.patch('/', async (req, res) => {
  try {
    const { name, username, theme } = req.body || {};

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const nextName = typeof name === 'string' ? name : typeof username === 'string' ? username : null;
    if (nextName !== null) {
      const trimmed = nextName.trim();
      if (!trimmed) return res.status(400).json({ error: 'Имя не может быть пустым' });
      if (trimmed.length > 100) return res.status(400).json({ error: 'Имя слишком длинное' });
      user.name = trimmed;
    }

    if (theme !== undefined) {
      user.theme = theme;
    }

    await user.save();
    res.json({
      id: user._id,
      name: user.name,
      phone: user.phone,
      avatar: user.avatarUrl || null,
      theme: user.theme ?? null,
      createdAt: user.createdAt,
    });
  } catch (e) {
    console.error('PATCH /api/me error:', e);
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
});

// POST /api/me/change-password
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Укажите текущий и новый пароль' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'Новый пароль должен быть не менее 6 символов' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const ok = await user.checkPassword(String(currentPassword));
    if (!ok) return res.status(401).json({ error: 'Неверный текущий пароль' });

    await user.setPassword(String(newPassword));
    await user.save();

    res.json({ success: true });
  } catch (e) {
    console.error('POST /api/me/change-password error:', e);
    res.status(500).json({ error: 'Ошибка смены пароля' });
  }
});

// POST /api/me/logout-all - инвалидирует все токены пользователя
router.post('/logout-all', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    user.tokensValidAfter = new Date();
    await user.save();

    // Best-effort: сразу отключаем все активные Socket.IO подключения пользователя.
    try {
      const io = req.app.get('io');
      const socketData = req.app.get('socketData');
      const sockets = socketData?.userSockets?.get?.(String(req.userId));
      if (io && sockets && typeof sockets.forEach === 'function') {
        sockets.forEach((socketId) => {
          try {
            io.to(socketId).emit('auth:revoked', { reason: 'logout_all' });
            io.sockets?.sockets?.get?.(socketId)?.disconnect?.(true);
          } catch (_) {}
        });
      }
    } catch (_) {}

    res.json({ success: true });
  } catch (e) {
    console.error('POST /api/me/logout-all error:', e);
    res.status(500).json({ error: 'Ошибка выхода со всех устройств' });
  }
});

module.exports = router;
