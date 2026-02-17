const express = require('express');
const authMiddleware = require('../../middleware/auth');
const controller = require('../../social/controllers/relationshipController');

const router = express.Router();

router.use(authMiddleware);

router.post('/friend-request', controller.sendFriendRequest);
router.post('/friend-request/:fromUserId/accept', controller.acceptFriendRequest);
router.post('/friend-request/:fromUserId/reject', controller.rejectFriendRequest);
router.get('/friend-requests/incoming', controller.listIncomingRequests);

router.delete('/friends/:friendUserId', controller.removeFriend);
router.get('/friends', controller.listFriends);
router.get('/friends/:userId', controller.listFriends);

router.post('/follow/:toUserId', controller.followUser);
router.delete('/follow/:toUserId', controller.unfollowUser);
router.get('/followers', controller.listFollowers);
router.get('/followers/:userId', controller.listFollowers);
router.get('/following', controller.listFollowing);
router.get('/following/:userId', controller.listFollowing);

module.exports = router;
