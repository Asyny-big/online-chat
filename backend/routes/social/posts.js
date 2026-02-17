const express = require('express');
const authMiddleware = require('../../middleware/auth');
const controller = require('../../social/controllers/postController');

const router = express.Router();

router.use(authMiddleware);

router.post('/', controller.createPost);
router.patch('/:postId', controller.updatePost);
router.delete('/:postId', controller.deletePost);
router.get('/profile/:userId', controller.listProfilePosts);

module.exports = router;
