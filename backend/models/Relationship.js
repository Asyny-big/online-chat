const mongoose = require('mongoose');

const relationshipSchema = new mongoose.Schema(
  {
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['follow', 'friend', 'request', 'block'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      required: true,
      default: 'pending'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: { createdAt: false, updatedAt: true }
  }
);

relationshipSchema.index(
  { fromUserId: 1, toUserId: 1, type: 1 },
  { unique: true, name: 'uniq_relationship_pair_type' }
);
relationshipSchema.index(
  { toUserId: 1, type: 1, status: 1, createdAt: -1, _id: -1 },
  { name: 'relationship_inbox_cursor' }
);
relationshipSchema.index(
  { fromUserId: 1, type: 1, status: 1, createdAt: -1, _id: -1 },
  { name: 'relationship_outbox_cursor' }
);
relationshipSchema.index(
  { fromUserId: 1, toUserId: 1, status: 1 },
  { name: 'relationship_pair_status' }
);

module.exports = mongoose.model('Relationship', relationshipSchema);
