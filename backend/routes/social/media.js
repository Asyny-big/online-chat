const express = require('express');
const authMiddleware = require('../../middleware/auth');
const controller = require('../../social/controllers/mediaController');

const router = express.Router();

router.use(authMiddleware);

router.post('/', controller.createMedia);
router.get('/my', controller.getMyMedia);

module.exports = router;
