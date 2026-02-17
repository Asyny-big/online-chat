const express = require('express');
const authMiddleware = require('../../middleware/auth');
const controller = require('../../social/controllers/feedController');

const router = express.Router();

router.use(authMiddleware);

router.get('/', controller.getFeed);

module.exports = router;
