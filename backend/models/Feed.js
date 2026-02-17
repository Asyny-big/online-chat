const mongoose = require('mongoose');

const feedSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  score: {
    type: Number,
    required: true,
    default: () => Date.now()
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

feedSchema.index(
  { userId: 1, score: -1, _id: -1 },
  { name: 'feed_user_score_cursor' }
);
feedSchema.index(
  { userId: 1, postId: 1 },
  { unique: true, name: 'uniq_feed_user_post' }
);
feedSchema.index({ postId: 1 }, { name: 'feed_post_lookup' });

module.exports = mongoose.model('Feed', feedSchema);
