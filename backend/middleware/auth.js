const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config.local');

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.JWT_SECRET);

    const userId = decoded.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Недействительный токен' });
    }

    // Проверка "logout-all": токен должен быть выпущен после tokensValidAfter.
    // jwt iat в секундах.
    const iatMs = typeof decoded.iat === 'number' ? decoded.iat * 1000 : null;
    if (iatMs !== null) {
      const user = await User.findById(userId).select('tokensValidAfter').lean();
      if (!user) {
        return res.status(401).json({ error: 'Недействительный токен' });
      }
      const validAfter = user.tokensValidAfter ? new Date(user.tokensValidAfter).getTime() : 0;
      if (iatMs < validAfter) {
        return res.status(401).json({ error: 'Токен отозван' });
      }
    }

    req.userId = userId;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Токен истёк' });
    }
    return res.status(401).json({ error: 'Недействительный токен' });
  }
};
