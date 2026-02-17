const Relationship = require('../../models/Relationship');

async function isFriend(userIdA, userIdB) {
  if (!userIdA || !userIdB) return false;
  if (String(userIdA) === String(userIdB)) return true;

  const relation = await Relationship.exists({
    fromUserId: userIdA,
    toUserId: userIdB,
    type: 'friend',
    status: 'accepted'
  });
  return Boolean(relation);
}

async function canUserViewPost(post, viewerUserId) {
  if (!post || !viewerUserId) return false;

  if (String(post.authorId) === String(viewerUserId)) return true;
  if (post.visibility === 'public') return true;
  if (post.visibility !== 'friends') return false;

  return isFriend(post.authorId, viewerUserId);
}

module.exports = {
  isFriend,
  canUserViewPost
};
