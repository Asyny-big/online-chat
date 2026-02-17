const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  targetType: {
    type: String,
    enum: ['post', 'comment', 'message'],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reaction: {
    type: String,
    required: true,
    default: 'like'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

reactionSchema.index(
  { targetType: 1, targetId: 1, userId: 1 },
  { unique: true, name: 'uniq_reaction_target_user' }
);
reactionSchema.index({ userId: 1, _id: -1 }, { name: 'reaction_user_cursor' });

module.exports = mongoose.model('Reaction', reactionSchema);
