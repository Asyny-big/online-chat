const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Поиск пользователя по номеру телефона
router.get('/search', async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ error: 'Укажите номер телефона' });
    }

    const phoneNormalized = phone.replace(/[\s\-()]/g, '');
    const user = await User.findOne({ phoneNormalized });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json(user.toPublicJSON());
  } catch (error) {
    console.error('Search user error:', error);
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
    const { name, avatarUrl, profile } = req.body;
    const updates = {};

    if (name) updates.name = name.trim();
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    if (profile) updates.profile = profile;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true }
    );

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
