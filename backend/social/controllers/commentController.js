const commentService = require('../services/commentService');
const { sendServiceError } = require('../utils/controller');

async function createComment(req, res) {
  try {
    const result = await commentService.createComment({
      app: req.app,
      postId: req.body?.postId,
      authorId: req.userId,
      text: req.body?.text,
      parentId: req.body?.parentId || null
    });
    return res.status(201).json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to create comment');
  }
}

async function listComments(req, res) {
  try {
    const result = await commentService.listComments({
      postId: req.params.postId,
      viewerUserId: req.userId,
      parentId: req.query?.parentId || null,
      cursor: req.query?.cursor,
      limit: req.query?.limit
    });
    return res.json(result);
  } catch (error) {
    return sendServiceError(res, error, 'Failed to load comments');
  }
}

module.exports = {
  createComment,
  listComments
};
