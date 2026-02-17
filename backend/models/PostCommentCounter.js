const mongoose = require('mongoose');

const postCommentCounterSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
    unique: true
  },
  total: {
    type: Number,
    default: 0
  },
  topLevel: {
    type: Number,
    default: 0
  },
  replies: {
    type: Number,
    default: 0
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

postCommentCounterSchema.index({ postId: 1 }, { unique: true, name: 'uniq_post_comment_counter' });
postCommentCounterSchema.index({ updatedAt: -1 }, { name: 'post_comment_counter_updatedAt' });

module.exports = mongoose.model('PostCommentCounter', postCommentCounterSchema);
