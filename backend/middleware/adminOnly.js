const User = require('../models/User');

function parseAdminIdsEnv() {
  const raw = process.env.ADMIN_USER_IDS;
  if (!raw) return new Set();
  return new Set(
    String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

module.exports = async function adminOnly(req, res, next) {
  try {
    const adminIds = parseAdminIdsEnv();
    if (adminIds.has(String(req.userId))) return next();

    const user = await User.findById(req.userId).select('roles isAdmin').lean();
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    if (user?.isAdmin === true || roles.includes('admin')) return next();

    return res.status(403).json({ error: 'admin_only' });
  } catch (_err) {
    return res.status(500).json({ error: 'admin_check_failed' });
  }
};

