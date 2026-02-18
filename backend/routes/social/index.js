const express = require('express');

const relationshipRoutes = require('./relationships');
const postsRoutes = require('./posts');
const commentsRoutes = require('./comments');
const reactionsRoutes = require('./reactions');
const feedRoutes = require('./feed');
const notificationsRoutes = require('./notifications');
const mediaRoutes = require('./media');
const profileRoutes = require('./profile');

const router = express.Router();

router.use('/relationships', relationshipRoutes);
router.use('/posts', postsRoutes);
router.use('/comments', commentsRoutes);
router.use('/reactions', reactionsRoutes);
router.use('/feed', feedRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/media', mediaRoutes);
router.use('/profile', profileRoutes);

module.exports = router;
