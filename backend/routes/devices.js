const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const UserDevice = require('../models/UserDevice');

router.use(authMiddleware);

// POST /api/devices/register
router.post('/register', async (req, res) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const platformRaw = typeof req.body?.platform === 'string' ? req.body.platform.trim().toLowerCase() : 'android';
    const appVersion = typeof req.body?.appVersion === 'string' ? req.body.appVersion.trim() : '';

    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }

    const platform = ['android', 'ios', 'web'].includes(platformRaw) ? platformRaw : 'android';

    await UserDevice.findOneAndUpdate(
      { token },
      {
        $set: {
          userId: req.userId,
          token,
          platform,
          appVersion,
          lastSeen: new Date()
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('POST /api/devices/register error:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// POST /api/devices/unregister
router.post('/unregister', async (req, res) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }

    await UserDevice.deleteOne({
      userId: req.userId,
      token
    });

    res.json({ success: true });
  } catch (error) {
    console.error('POST /api/devices/unregister error:', error);
    res.status(500).json({ error: 'Failed to unregister device' });
  }
});

module.exports = router;
