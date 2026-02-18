const express = require('express');
const authMiddleware = require('../../middleware/auth');
const controller = require('../../social/controllers/profileController');

const router = express.Router();

router.use(authMiddleware);

router.get('/:userId', controller.getProfile);

module.exports = router;
