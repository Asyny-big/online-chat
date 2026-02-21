const mongoose = require('mongoose');
const Comment = require('../../models/Comment');
const Media = require('../../models/Media');
const Post = require('../../models/Post');
const { canUserViewPost } = require('./accessService');
const { createNotification } = require('./notificationService');
const { incrementPostCommentCounter } = require('./postCommentCounterService');
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
  return String(text || '').trim();
}

function normalizeMediaIds(media) {
  if (!Array.isArray(media)) return [];
  return media
    .map((id) => String(id || '').trim())
    .filter(Boolean);
}

async function assertMediaOwnership(mediaIds, ownerId) {
  if (!mediaIds.length) return;
  const validObjectIds = mediaIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (validObjectIds.length !== mediaIds.length) {
    throw httpError(400, 'Invalid media id');
  }

  const ownedMedia = await Media.find({
    _id: { $in: validObjectIds },
    ownerId
  }).select('_id').lean();

  if (ownedMedia.length !== mediaIds.length) {
    throw httpError(403, 'Media item does not belong to user');
  }
}

async function createComment({ app, postId, authorId, text, media, parentId = null }) {
  const postObjectId = toObjectIdOrFail(postId, 'postId');
  const authorObjectId = toObjectIdOrFail(authorId, 'authorId');
  const normalizedText = normalizeText(text);
  const mediaIds = normalizeMediaIds(media);

  const post = await Post.findById(postObjectId).lean();
  if (!post) {
    throw httpError(404, 'Post not found');
  }

  const canView = await canUserViewPost(post, authorObjectId);
  if (!canView) {
    throw httpError(403, 'Post is not accessible');
  }

  if (!normalizedText && mediaIds.length === 0) {
    throw httpError(400, 'Comment text or media is required');
  }

  await assertMediaOwnership(mediaIds, authorObjectId);

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
    media: mediaIds,
    parentId: parentObjectId
  });

  await Post.updateOne(
    { _id: postObjectId },
    { $inc: { 'stats.comments': 1 } }
  );

  await incrementPostCommentCounter({
    postId: postObjectId,
    isReply: Boolean(parentObjectId)
  });

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
    .populate('media')
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
    .populate('media')
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
