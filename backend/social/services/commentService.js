const mongoose = require('mongoose');
const Comment = require('../../models/Comment');
const Post = require('../../models/Post');
const { canUserViewPost } = require('./accessService');
const { createNotification } = require('./notificationService');
const {
  decodeCursor,
  normalizeLimit,
  buildObjectIdCursor,
  applyObjectIdCursorFilter
} = require('../utils/cursor');
const { httpError } = require('../utils/errors');

function toObjectIdOrFail(value, fieldName) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw httpError(400, `Invalid ${fieldName}`);
  }
  return new mongoose.Types.ObjectId(value);
}

function normalizeText(text) {
  const value = String(text || '').trim();
  if (!value) {
    throw httpError(400, 'Comment text is required');
  }
  return value;
}

async function createComment({ app, postId, authorId, text, parentId = null }) {
  const postObjectId = toObjectIdOrFail(postId, 'postId');
  const authorObjectId = toObjectIdOrFail(authorId, 'authorId');
  const normalizedText = normalizeText(text);

  const post = await Post.findById(postObjectId).lean();
  if (!post) {
    throw httpError(404, 'Post not found');
  }

  const canView = await canUserViewPost(post, authorObjectId);
  if (!canView) {
    throw httpError(403, 'Post is not accessible');
  }

  let parentObjectId = null;
  let parentComment = null;
  if (parentId) {
    parentObjectId = toObjectIdOrFail(parentId, 'parentId');
    parentComment = await Comment.findOne({ _id: parentObjectId, postId: postObjectId }).lean();
    if (!parentComment) {
      throw httpError(404, 'Parent comment not found');
    }
  }

  const comment = await Comment.create({
    postId: postObjectId,
    authorId: authorObjectId,
    text: normalizedText,
    parentId: parentObjectId
  });

  await Post.updateOne(
    { _id: postObjectId },
    { $inc: { 'stats.comments': 1 } }
  );

  await createNotification({
    app,
    userId: post.authorId,
    type: 'comment',
    actorId: authorObjectId,
    targetId: postObjectId,
    meta: {
      commentId: String(comment._id),
      parentId: parentObjectId ? String(parentObjectId) : null
    }
  });

  if (parentComment && String(parentComment.authorId) !== String(post.authorId)) {
    await createNotification({
      app,
      userId: parentComment.authorId,
      type: 'comment',
      actorId: authorObjectId,
      targetId: comment._id,
      meta: {
        postId: String(postObjectId),
        parentId: String(parentObjectId),
        reply: true
      }
    });
  }

  return Comment.findById(comment._id)
    .populate('authorId', '_id name avatarUrl')
    .lean();
}

async function listComments({ postId, viewerUserId, cursor, limit, parentId = null }) {
  const postObjectId = toObjectIdOrFail(postId, 'postId');
  const viewerObjectId = toObjectIdOrFail(viewerUserId, 'viewerUserId');
  const normalizedLimit = normalizeLimit(limit, 20, 100);

  const post = await Post.findById(postObjectId).lean();
  if (!post) {
    throw httpError(404, 'Post not found');
  }

  const canView = await canUserViewPost(post, viewerObjectId);
  if (!canView) {
    throw httpError(403, 'Post is not accessible');
  }

  const query = {
    postId: postObjectId,
    parentId: parentId ? toObjectIdOrFail(parentId, 'parentId') : null
  };

  const cursorPayload = decodeCursor(cursor);
  applyObjectIdCursorFilter(query, cursorPayload, '_id');

  const rows = await Comment.find(query)
    .sort({ _id: -1 })
    .limit(normalizedLimit + 1)
    .populate('authorId', '_id name avatarUrl')
    .lean();

  const hasMore = rows.length > normalizedLimit;
  const items = hasMore ? rows.slice(0, normalizedLimit) : rows;
  const nextCursor = hasMore ? buildObjectIdCursor(items) : null;

  return { items, nextCursor };
}

module.exports = {
  createComment,
  listComments
};
