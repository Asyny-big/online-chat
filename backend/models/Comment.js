const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
    index: true
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    default: '',
    trim: true,
    maxlength: 3000
  },
  media: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media'
    }
  ],
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  likes: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

commentSchema.index({ postId: 1, parentId: 1, _id: -1 }, { name: 'comment_post_parent_cursor' });
commentSchema.index({ authorId: 1, _id: -1 }, { name: 'comment_author_cursor' });

module.exports = mongoose.model('Comment', commentSchema);
