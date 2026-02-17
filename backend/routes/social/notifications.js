const express = require('express');
const authMiddleware = require('../../middleware/auth');
const controller = require('../../social/controllers/notificationController');

const router = express.Router();

router.use(authMiddleware);

router.get('/', controller.getNotifications);
router.patch('/:notificationId/read', controller.readNotification);
router.patch('/read-all', controller.readAllNotifications);

module.exports = router;
