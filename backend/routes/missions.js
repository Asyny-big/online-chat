const express = require('express');
const authMiddleware = require('../middleware/auth');
const { listMissionsForUser } = require('../economy/missionsService');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const data = await listMissionsForUser({ userId: req.userId });
    res.json(data);
  } catch (err) {
    console.error('[Missions] list failed:', { userId: req.userId, message: err?.message });
    res.status(500).json({ error: 'missions_failed' });
  }
});

module.exports = router;

