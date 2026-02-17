const PostCommentCounter = require('../../models/PostCommentCounter');

async function incrementPostCommentCounter({ postId, isReply }) {
  if (!postId) return;

  const $inc = { total: 1 };
  if (isReply) {
    $inc.replies = 1;
  } else {
    $inc.topLevel = 1;
  }

  await PostCommentCounter.updateOne(
    { postId },
    {
      $inc,
      $set: { updatedAt: new Date() },
      $setOnInsert: { postId }
    },
    { upsert: true }
  );
}

async function deletePostCommentCounter(postId) {
  if (!postId) return;
  await PostCommentCounter.deleteOne({ postId });
}

module.exports = {
  incrementPostCommentCounter,
  deletePostCommentCounter
};
