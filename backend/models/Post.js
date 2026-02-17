const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    text: {
      type: String,
      default: '',
      maxlength: 5000
    },
    media: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Media'
      }
    ],
    visibility: {
      type: String,
      enum: ['public', 'friends'],
      default: 'public',
      required: true
    },
    stats: {
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      views: { type: Number, default: 0 },
      reposts: { type: Number, default: 0 }
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: true }
  }
);

postSchema.index({ authorId: 1, _id: -1 }, { name: 'post_author_cursor' });
postSchema.index({ visibility: 1, _id: -1 }, { name: 'post_visibility_cursor' });

module.exports = mongoose.model('Post', postSchema);
