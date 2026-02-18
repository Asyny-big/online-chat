const mongoose = require('mongoose');
const User = require('../../models/User');
const Relationship = require('../../models/Relationship');
const { listProfilePosts } = require('./postService');
const { httpError } = require('../utils/errors');

function toObjectIdOrFail(value, fieldName) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw httpError(400, `Invalid ${fieldName}`);
  }
  return new mongoose.Types.ObjectId(value);
}

function normalizePhoneDigits(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length === 10 && digits.startsWith('9')) {
    return `7${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('8')) {
    return `7${digits.slice(1)}`;
  }
  if (digits.length === 11 && digits.startsWith('7')) {
    return digits;
  }
  return digits;
}

async function resolveRelationshipStatus({ viewerId, profileId }) {
  if (String(viewerId) === String(profileId)) return 'self';

  const friend = await Relationship.exists({
    type: 'friend',
    status: 'accepted',
    fromUserId: viewerId,
    toUserId: profileId
  });
  if (friend) return 'friends';

  const outgoing = await Relationship.exists({
    type: 'request',
    status: 'pending',
    fromUserId: viewerId,
    toUserId: profileId
  });
  if (outgoing) return 'outgoing_request';

  const incoming = await Relationship.exists({
    type: 'request',
    status: 'pending',
    fromUserId: profileId,
    toUserId: viewerId
  });
  if (incoming) return 'incoming_request';

  return 'none';
}

async function getProfileBundle({ viewerUserId, profileUserId, cursor, limit }) {
  const viewerId = toObjectIdOrFail(viewerUserId, 'viewerUserId');
  const profileId = toObjectIdOrFail(profileUserId, 'profileUserId');

  const user = await User.findById(profileId)
    .select('_id name phone phoneNormalized avatarUrl city status followers following friends posts createdAt')
    .lean();
  if (!user) {
    throw httpError(404, 'User not found');
  }

  const posts = await listProfilePosts({
    profileUserId: profileId,
    viewerUserId: viewerId,
    cursor,
    limit
  });

  const relationshipStatus = await resolveRelationshipStatus({
    viewerId,
    profileId
  });

  return {
    user: {
      _id: user._id,
      name: user.name,
      username: user.name,
      phone: normalizePhoneDigits(user.phoneNormalized || user.phone),
      avatarUrl: user.avatarUrl || null,
      city: user.city || '',
      status: user.status || '',
      createdAt: user.createdAt
    },
    counters: {
      followers: Number(user.followers || 0),
      following: Number(user.following || 0),
      friends: Number(user.friends || 0),
      posts: Number(user.posts || 0)
    },
    relationshipStatus,
    posts
  };
}

module.exports = {
  getProfileBundle
};
