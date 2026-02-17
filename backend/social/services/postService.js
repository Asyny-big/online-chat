const mongoose = require('mongoose');
const Post = require('../../models/Post');
const Media = require('../../models/Media');
const { incrementUserCounters } = require('./userCounterService');
const {
  enqueueFeedFanoutPost,
  enqueueFeedRebuildPost,
  enqueuePostCleanup
} = require('./queueService');
const { isFriend } = require('./accessService');
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

function normalizeVisibility(visibility) {
  if (visibility === undefined || visibility === null || visibility === '') return 'public';
  const normalized = String(visibility);
  if (!['public', 'friends'].includes(normalized)) {
    throw httpError(400, 'Invalid visibility');
  }
  return normalized;
}

function normalizeText(text) {
  if (text === undefined || text === null) return '';
  return String(text).trim();
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

async function hydratePost(postId) {
  return Post.findById(postId)
    .populate('authorId', '_id name avatarUrl')
    .populate('media')
    .lean();
}

async function createPost({ authorId, text, media, visibility }) {
  const authorObjectId = toObjectIdOrFail(authorId, 'authorId');
  const normalizedText = normalizeText(text);
  const mediaIds = normalizeMediaIds(media);
  const normalizedVisibility = normalizeVisibility(visibility);

  if (!normalizedText && mediaIds.length === 0) {
    throw httpError(400, 'Post text or media is required');
  }

  await assertMediaOwnership(mediaIds, authorObjectId);

  const post = await Post.create({
    authorId: authorObjectId,
    text: normalizedText,
    media: mediaIds,
    visibility: normalizedVisibility,
    stats: {
      likes: 0,
      comments: 0,
      views: 0,
      reposts: 0
    }
  });

  await incrementUserCounters(authorObjectId, { posts: 1 });

  enqueueFeedFanoutPost(post._id).catch((error) => {
    console.error('[Social][Feed] enqueue fan-out failed:', error?.message || error);
  });

  return hydratePost(post._id);
}

async function updatePost({ postId, authorId, text, media, visibility }) {
  const postObjectId = toObjectIdOrFail(postId, 'postId');
  const authorObjectId = toObjectIdOrFail(authorId, 'authorId');

  const post = await Post.findOne({ _id: postObjectId, authorId: authorObjectId });
  if (!post) {
    throw httpError(404, 'Post not found');
  }

  if (text !== undefined) {
    post.text = normalizeText(text);
  }
  if (media !== undefined) {
    const mediaIds = normalizeMediaIds(media);
    await assertMediaOwnership(mediaIds, authorObjectId);
    post.media = mediaIds;
  }

  let visibilityChanged = false;
  if (visibility !== undefined) {
    const normalizedVisibility = normalizeVisibility(visibility);
    visibilityChanged = normalizedVisibility !== post.visibility;
    post.visibility = normalizedVisibility;
  }

  if (!String(post.text || '').trim() && (!Array.isArray(post.media) || post.media.length === 0)) {
    throw httpError(400, 'Post text or media is required');
  }

  await post.save();

  if (visibilityChanged) {
    enqueueFeedRebuildPost(post._id).catch((error) => {
      console.error('[Social][Feed] enqueue rebuild failed:', error?.message || error);
    });
  }

  return hydratePost(post._id);
}

async function deletePost({ postId, authorId }) {
  const postObjectId = toObjectIdOrFail(postId, 'postId');
  const authorObjectId = toObjectIdOrFail(authorId, 'authorId');

  const post = await Post.findOne({ _id: postObjectId, authorId: authorObjectId })
    .select('_id authorId')
    .lean();
  if (!post) {
    throw httpError(404, 'Post not found');
  }

  await Post.deleteOne({ _id: postObjectId, authorId: authorObjectId });
  await incrementUserCounters(authorObjectId, { posts: -1 });

  enqueuePostCleanup({ postId: postObjectId }).catch((error) => {
    console.error('[Social][Post] enqueue cleanup failed:', error?.message || error);
  });

  return { success: true };
}

async function listProfilePosts({ profileUserId, viewerUserId, cursor, limit }) {
  const profileId = toObjectIdOrFail(profileUserId, 'profileUserId');
  const viewerId = toObjectIdOrFail(viewerUserId, 'viewerUserId');
  const normalizedLimit = normalizeLimit(limit, 20, 50);

  const query = { authorId: profileId };
  if (String(profileId) !== String(viewerId)) {
    const friend = await isFriend(profileId, viewerId);
    if (!friend) {
      query.visibility = 'public';
    }
  }

  const cursorPayload = decodeCursor(cursor);
  applyObjectIdCursorFilter(query, cursorPayload, '_id');

  const rows = await Post.find(query)
    .sort({ _id: -1 })
    .limit(normalizedLimit + 1)
    .populate('authorId', '_id name avatarUrl')
    .populate('media')
    .lean();

  const hasMore = rows.length > normalizedLimit;
  const items = hasMore ? rows.slice(0, normalizedLimit) : rows;
  const nextCursor = hasMore ? buildObjectIdCursor(items) : null;

  if (String(profileId) !== String(viewerId) && items.length) {
    const postIds = items.map((post) => post._id);
    setImmediate(() => {
      Post.updateMany(
        { _id: { $in: postIds } },
        { $inc: { 'stats.views': 1 } }
      ).catch((error) => {
        console.error('[Social][Post] profile views increment failed:', error);
      });
    });
  }

  return { items, nextCursor };
}

async function getPostById(postId) {
  const postObjectId = toObjectIdOrFail(postId, 'postId');
  return Post.findById(postObjectId).lean();
}

module.exports = {
  createPost,
  updatePost,
  deletePost,
  listProfilePosts,
  getPostById
};
