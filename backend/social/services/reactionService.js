const mongoose = require('mongoose');
const Reaction = require('../../models/Reaction');
const Post = require('../../models/Post');
const Comment = require('../../models/Comment');
const Message = require('../../models/Message');
const { canUserViewPost } = require('./accessService');
const { createNotification } = require('./notificationService');
const { httpError } = require('../utils/errors');

function toObjectIdOrFail(value, fieldName) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw httpError(400, `Invalid ${fieldName}`);
  }
  return new mongoose.Types.ObjectId(value);
}

function normalizeReaction(value) {
  const normalized = String(value || 'like').trim().toLowerCase();
  if (!normalized) return 'like';
  if (normalized.length > 32) {
    throw httpError(400, 'Reaction is too long');
  }
  return normalized;
}

async function resolveTarget({ targetType, targetId, userId }) {
  if (targetType === 'post') {
    const post = await Post.findById(targetId).lean();
    if (!post) throw httpError(404, 'Post not found');

    const canView = await canUserViewPost(post, userId);
    if (!canView) throw httpError(403, 'Post is not accessible');

    return {
      ownerId: post.authorId,
      notificationTargetId: post._id,
      applyLikeDelta: async (delta) => Post.updateOne(
        { _id: post._id },
        { $inc: { 'stats.likes': delta } }
      )
    };
  }

  if (targetType === 'comment') {
    const comment = await Comment.findById(targetId).lean();
    if (!comment) throw httpError(404, 'Comment not found');

    const post = await Post.findById(comment.postId).lean();
    if (!post) throw httpError(404, 'Post not found');

    const canView = await canUserViewPost(post, userId);
    if (!canView) throw httpError(403, 'Post is not accessible');

    return {
      ownerId: comment.authorId,
      notificationTargetId: comment._id,
      applyLikeDelta: async (delta) => Comment.updateOne(
        { _id: comment._id },
        { $inc: { likes: delta } }
      )
    };
  }

  if (targetType === 'message') {
    const message = await Message.findById(targetId).lean();
    if (!message) throw httpError(404, 'Message not found');

    return {
      ownerId: message.sender,
      notificationTargetId: message._id,
      applyLikeDelta: async () => null
    };
  }

  throw httpError(400, 'Invalid targetType');
}

async function toggleReaction({ app, userId, targetType, targetId, reaction = 'like' }) {
  const actorId = toObjectIdOrFail(userId, 'userId');
  const normalizedTargetType = String(targetType || '').trim().toLowerCase();
  const targetObjectId = toObjectIdOrFail(targetId, 'targetId');
  const normalizedReaction = normalizeReaction(reaction);

  const target = await resolveTarget({
    targetType: normalizedTargetType,
    targetId: targetObjectId,
    userId: actorId
  });

  const existing = await Reaction.findOne({
    targetType: normalizedTargetType,
    targetId: targetObjectId,
    userId: actorId
  });

  if (existing) {
    if (existing.reaction === normalizedReaction) {
      await Reaction.deleteOne({ _id: existing._id });
      await target.applyLikeDelta(-1);
      return { active: false, reaction: null };
    }

    existing.reaction = normalizedReaction;
    await existing.save();
    return { active: true, reaction: normalizedReaction };
  }

  await Reaction.create({
    targetType: normalizedTargetType,
    targetId: targetObjectId,
    userId: actorId,
    reaction: normalizedReaction
  });

  await target.applyLikeDelta(1);

  if (normalizedReaction === 'like') {
    await createNotification({
      app,
      userId: target.ownerId,
      type: 'like',
      actorId,
      targetId: target.notificationTargetId,
      meta: {
        targetType: normalizedTargetType
      }
    });
  }

  return { active: true, reaction: normalizedReaction };
}

module.exports = {
  toggleReaction
};
