const relationshipService = require('../services/relationshipService');
const { sendServiceError } = require('../utils/controller');

async function sendFriendRequest(req, res) {
  try {
    const result = await relationshipService.sendFriendRequest({
      app: req.app,
      fromUserId: req.userId,
      toUserId: req.body?.toUserId
    });
    return res.status(201).json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to send friend request');
  }
}

async function acceptFriendRequest(req, res) {
  try {
    const result = await relationshipService.acceptFriendRequest({
      app: req.app,
      userId: req.userId,
      fromUserId: req.params.fromUserId
    });
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to accept friend request');
  }
}

async function rejectFriendRequest(req, res) {
  try {
    const result = await relationshipService.rejectFriendRequest({
      app: req.app,
      userId: req.userId,
      fromUserId: req.params.fromUserId
    });
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to reject friend request');
  }
}

async function removeFriend(req, res) {
  try {
    const result = await relationshipService.removeFriend({
      app: req.app,
      userId: req.userId,
      friendUserId: req.params.friendUserId
    });
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to remove friend');
  }
}

async function followUser(req, res) {
  try {
    const result = await relationshipService.followUser({
      app: req.app,
      fromUserId: req.userId,
      toUserId: req.params.toUserId || req.body?.toUserId
    });
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to follow user');
  }
}

async function unfollowUser(req, res) {
  try {
    const result = await relationshipService.unfollowUser({
      app: req.app,
      fromUserId: req.userId,
      toUserId: req.params.toUserId || req.body?.toUserId
    });
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to unfollow user');
  }
}

async function listIncomingRequests(req, res) {
  try {
    const result = await relationshipService.listIncomingRequests({
      userId: req.userId,
      cursor: req.query?.cursor,
      limit: req.query?.limit
    });
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to load friend requests');
  }
}

async function listFriends(req, res) {
  try {
    const result = await relationshipService.listFriends({
      userId: req.params.userId || req.userId,
      cursor: req.query?.cursor,
      limit: req.query?.limit
    });
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to load friends');
  }
}

async function listFollowers(req, res) {
  try {
    const result = await relationshipService.listFollowers({
      userId: req.params.userId || req.userId,
      cursor: req.query?.cursor,
      limit: req.query?.limit
    });
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to load followers');
  }
}

async function listFollowing(req, res) {
  try {
    const result = await relationshipService.listFollowing({
      userId: req.params.userId || req.userId,
      cursor: req.query?.cursor,
      limit: req.query?.limit
    });
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to load following');
  }
}

module.exports = {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  followUser,
  unfollowUser,
  listIncomingRequests,
  listFriends,
  listFollowers,
  listFollowing
};
