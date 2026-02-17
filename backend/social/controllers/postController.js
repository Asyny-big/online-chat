const postService = require('../services/postService');
const { sendServiceError } = require('../utils/controller');

async function createPost(req, res) {
  try {
    const result = await postService.createPost({
      authorId: req.userId,
      text: req.body?.text,
      media: req.body?.media,
      visibility: req.body?.visibility
    });
    return res.status(201).json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to create post');
  }
}

async function updatePost(req, res) {
  try {
    const result = await postService.updatePost({
      postId: req.params.postId,
      authorId: req.userId,
      text: req.body?.text,
      media: req.body?.media,
      visibility: req.body?.visibility
    });
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to update post');
  }
}

async function deletePost(req, res) {
  try {
    const result = await postService.deletePost({
      postId: req.params.postId,
      authorId: req.userId
    });
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to delete post');
  }
}

async function listProfilePosts(req, res) {
  try {
    const result = await postService.listProfilePosts({
      profileUserId: req.params.userId,
      viewerUserId: req.userId,
      cursor: req.query?.cursor,
      limit: req.query?.limit
    });
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to load profile posts');
  }
}

module.exports = {
  createPost,
  updatePost,
  deletePost,
  listProfilePosts
};
