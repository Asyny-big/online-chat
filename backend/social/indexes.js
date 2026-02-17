async function ensureSocialIndexes(db) {
  const relationships = db.collection('relationships');
  const media = db.collection('media');
  const posts = db.collection('posts');
  const comments = db.collection('comments');
  const reactions = db.collection('reactions');
  const feeds = db.collection('feeds');
  const notifications = db.collection('notifications');
  const postCommentCounters = db.collection('postcommentcounters');
  const users = db.collection('users');

  await relationships.createIndex(
    { fromUserId: 1, toUserId: 1, type: 1 },
    { unique: true, name: 'uniq_relationship_pair_type' }
  );
  await relationships.createIndex(
    { toUserId: 1, type: 1, status: 1, createdAt: -1, _id: -1 },
    { name: 'relationship_inbox_cursor' }
  );
  await relationships.createIndex(
    { fromUserId: 1, type: 1, status: 1, createdAt: -1, _id: -1 },
    { name: 'relationship_outbox_cursor' }
  );
  await relationships.createIndex(
    { fromUserId: 1, toUserId: 1, status: 1 },
    { name: 'relationship_pair_status' }
  );

  await media.createIndex({ ownerId: 1, _id: -1 }, { name: 'media_owner_cursor' });
  await media.createIndex({ path: 1 }, { name: 'media_path' });

  await posts.createIndex({ authorId: 1, _id: -1 }, { name: 'post_author_cursor' });
  await posts.createIndex({ visibility: 1, _id: -1 }, { name: 'post_visibility_cursor' });

  await comments.createIndex(
    { postId: 1, parentId: 1, _id: -1 },
    { name: 'comment_post_parent_cursor' }
  );
  await comments.createIndex({ authorId: 1, _id: -1 }, { name: 'comment_author_cursor' });

  await reactions.createIndex(
    { targetType: 1, targetId: 1, userId: 1 },
    { unique: true, name: 'uniq_reaction_target_user' }
  );
  await reactions.createIndex({ userId: 1, _id: -1 }, { name: 'reaction_user_cursor' });

  await feeds.createIndex({ userId: 1, score: -1, _id: -1 }, { name: 'feed_user_score_cursor' });
  await feeds.createIndex(
    { userId: 1, postId: 1 },
    { unique: true, name: 'uniq_feed_user_post' }
  );
  await feeds.createIndex({ postId: 1 }, { name: 'feed_post_lookup' });

  await notifications.createIndex(
    { userId: 1, read: 1, _id: -1 },
    { name: 'notification_user_read_cursor' }
  );
  await notifications.createIndex(
    { userId: 1, _id: -1 },
    { name: 'notification_user_cursor' }
  );
  await notifications.createIndex(
    { userId: 1, delivered: 1, _id: 1 },
    { name: 'notification_user_delivered_cursor' }
  );

  await postCommentCounters.createIndex(
    { postId: 1 },
    { unique: true, name: 'uniq_post_comment_counter' }
  );
  await postCommentCounters.createIndex(
    { updatedAt: -1 },
    { name: 'post_comment_counter_updatedAt' }
  );

  await users.createIndex({ followers: 1 }, { name: 'user_followers' });
  await users.createIndex({ following: 1 }, { name: 'user_following' });
  await users.createIndex({ friends: 1 }, { name: 'user_friends' });
  await users.createIndex({ posts: 1 }, { name: 'user_posts' });
}

module.exports = {
  ensureSocialIndexes
};
