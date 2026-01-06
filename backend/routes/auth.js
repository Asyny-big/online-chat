const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config.local');

// Нормализация номера телефона
function normalizePhone(phone) {
  return phone.replace(/[\s\-()]/g, '');
}

// Регистрация
router.post('/register', async (req, res) => {
  try {
    const { phone, name, password } = req.body;

    if (!phone || !name || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    const phoneNormalized = normalizePhone(phone);

    // Проверка существующего пользователя
    const existing = await User.findOne({ phoneNormalized });
    if (existing) {
      return res.status(400).json({ error: 'Пользователь с таким номером уже существует' });
    }

    // Создание пользователя
    const user = new User({
      phone,
      phoneNormalized,
      name: name.trim()
    });
    await user.setPassword(password);
    await user.save();

    // Генерация токена
    const token = jwt.sign(
      { userId: user._id },
      config.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

// Вход
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Укажите номер телефона и пароль' });
    }

    const phoneNormalized = normalizePhone(phone);
    const user = await User.findOne({ phoneNormalized });

    if (!user) {
      return res.status(401).json({ error: 'Неверный номер телефона или пароль' });
    }

    const isValid = await user.checkPassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Неверный номер телефона или пароль' });
    }

    const token = jwt.sign(
      { userId: user._id },
      config.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

module.exports = router;
