const User = require('../models/User');

function normalizePhone(phone) {
  if (typeof phone !== 'string') return '';
  return phone.replace(/[\s\-()]/g, '');
}

function isValidPhoneExact(phone) {
  if (typeof phone !== 'string') return false;
  // Без нормализации: разрешаем только + и цифры, без пробелов/скобок/дефисов.
  // Минимум 9 цифр (порог защиты от перебора), максимум 15 (E.164).
  return /^\+?[1-9]\d{8,14}$/.test(phone);
}

async function findUserByExactPhone({ phone, excludeUserId }) {
  const normalized = normalizePhone(phone);
  const query = {
    $or: [
      { phone },
      // Поддержка legacy/разных форматов хранения.
      ...(normalized ? [{ phoneNormalized: normalized }] : [])
    ]
  };
  if (excludeUserId) query._id = { $ne: excludeUserId };

  const user = await User.findOne(query).select('_id name phone avatarUrl').lean();
  if (!user) return null;

  return {
    // Совместимость с Android DTO (UserDto)
    _id: user._id,
    name: user.name,
    phone: user.phone,
    avatarUrl: user.avatarUrl || null,
  };
}

module.exports = { isValidPhoneExact, findUserByExactPhone };

