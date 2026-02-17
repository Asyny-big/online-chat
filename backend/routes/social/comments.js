const express = require('express');
const authMiddleware = require('../../middleware/auth');
const controller = require('../../social/controllers/commentController');

const router = express.Router();

router.use(authMiddleware);

router.post('/', controller.createComment);
router.get('/post/:postId', controller.listComments);

module.exports = router;
