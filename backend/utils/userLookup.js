const User = require('../models/User');

function isValidPhoneExact(phone) {
  if (typeof phone !== 'string') return false;
  // Без нормализации: разрешаем только + и цифры, без пробелов/скобок/дефисов.
  // Минимум 9 цифр (порог защиты от перебора), максимум 15 (E.164).
  return /^\+?[1-9]\d{8,14}$/.test(phone);
}

async function findUserByExactPhone({ phone, excludeUserId }) {
  const query = { phone };
  if (excludeUserId) query._id = { $ne: excludeUserId };

  const user = await User.findOne(query).select('_id name avatarUrl').lean();
  if (!user) return null;

  return {
    id: user._id,
    name: user.name,
    avatar: user.avatarUrl || null,
  };
}

module.exports = { isValidPhoneExact, findUserByExactPhone };

