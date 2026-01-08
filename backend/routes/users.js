const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Поиск пользователей по номеру телефона (частичное совпадение)
router.get('/search', async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone || !phone.trim()) {
      return res.json([]);
    }

    const phoneNormalized = phone.replace(/[\s\-()]/g, '');
    
    // Частичное совпадение по началу номера
    const users = await User.find({
      phoneNormalized: { $regex: `^${phoneNormalized}` },
      _id: { $ne: req.userId } // Не показывать себя
    })
    .select('name phone phoneNormalized avatarUrl status')
    .limit(10)
    .lean();

    const results = users.map(u => ({
      _id: u._id,
      id: u._id,
      name: u.name,
      phone: u.phone,
      phoneNormalized: u.phoneNormalized,
      avatarUrl: u.avatarUrl,
      status: u.status
    }));

    res.json(results);
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
