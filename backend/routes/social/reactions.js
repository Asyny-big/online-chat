const express = require('express');
const authMiddleware = require('../../middleware/auth');
const controller = require('../../social/controllers/reactionController');

const router = express.Router();

router.use(authMiddleware);

router.post('/toggle', controller.toggleReaction);

module.exports = router;
