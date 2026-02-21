import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '@/config';
import PostComposer from '@/components/PostComposer';
import PostCard from '@/components/PostCard';
import CommentsModal from '@/components/CommentsModal';

export default function FeedPage({ token }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activePostId, setActivePostId] = useState(null);

  const loadFeed = useCallback(async ({ nextCursor = null, append = false } = {}) => {
    setLoading(true);
    setError('');
    try {
      const url = nextCursor
        ? `${API_URL}/social/feed?cursor=${encodeURIComponent(nextCursor)}`
        : `${API_URL}/social/feed`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const nextItems = Array.isArray(res.data?.items) ? res.data.items : [];
      setItems((prev) => (append ? [...prev, ...nextItems] : nextItems));
      setCursor(res.data?.nextCursor || null);
      return true;
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось загрузить ленту');
      return false;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const refetchFeed = useCallback(async () => {
    await loadFeed({ nextCursor: null, append: false });
  }, [loadFeed]);

  useEffect(() => {
    void refetchFeed();
  }, [refetchFeed]);

  const handleLoadMore = async () => {
    if (loading || !cursor) return;
    await loadFeed({ nextCursor: cursor, append: true });
  };

  const handleLikeSuccess = useCallback(async () => {
    await refetchFeed();
  }, [refetchFeed]);

  const handlePostCreated = (post) => {
    if (!post?._id) return;
    setItems((prev) => [
      {
        _id: `local-${post._id}`,
        createdAt: post.createdAt,
        score: Date.now(),
        post
      },
      ...prev
    ]);
  };

  return (
    <div className="feed-page">
      <div className="feed-header">
        <h1 className="feed-title">Главная</h1>
        <div className="feed-tabs">
          <button type="button" className="feed-tab active">Популярное</button>
          <button type="button" className="feed-tab">Подписки</button>
        </div>
      </div>

      <PostComposer token={token} onCreated={handlePostCreated} />

      {error ? <div className="error-message">{error}</div> : null}

      {!loading && items.length === 0 ? (
        <div className="empty-state">
          <p>Пока нет постов</p>
        </div>
      ) : null}

      <div className="feed-list">
        {items.map((item) => {
          const post = item?.post || item || {};
          return (
            <PostCard
              key={item._id}
              item={item}
              token={token}
              likedByMe={Boolean(post?.likedByMe)}
              onOpenComments={setActivePostId}
              onLikeSuccess={handleLikeSuccess}
            />
          );
        })}
      </div>

      <div className="load-more-container">
        <button
          type="button"
          className="btn btn-secondary load-more-btn"
          disabled={loading || !cursor}
          onClick={handleLoadMore}
        >
          {loading ? 'Загрузка...' : cursor ? 'Показать ещё' : 'Конец ленты'}
        </button>
      </div>

      {activePostId ? (
        <CommentsModal
          token={token}
          postId={activePostId}
          onClose={() => setActivePostId(null)}
          onCommentCreated={refetchFeed}
        />
      ) : null}

      <style>{`
        .feed-page {
          padding: var(--space-16) 0 var(--space-24);
        }

        .feed-header {
          margin-bottom: var(--space-16);
          padding: 0 var(--space-8);
        }

        .feed-title {
          font-size: 24px;
          font-weight: 750;
          margin-bottom: var(--space-12);
          display: none;
        }

        .feed-tabs {
          display: flex;
          border-bottom: 1px solid var(--border-color);
          gap: var(--space-8);
        }

        .feed-tab {
          flex: 1;
          padding: var(--space-10) var(--space-12);
          border-radius: var(--radius-md) var(--radius-md) 0 0;
          font-weight: 650;
          color: var(--text-secondary);
          border-bottom: 2px solid transparent;
          transition: var(--transition-normal);
        }

        .feed-tab:hover {
          background-color: var(--bg-hover);
          color: var(--text-primary);
        }

        .feed-tab.active {
          color: var(--text-primary);
          border-bottom-color: var(--accent);
          background: linear-gradient(180deg, rgba(107, 114, 255, 0.14), rgba(107, 114, 255, 0));
        }

        .error-message {
          background-color: rgba(248, 113, 113, 0.12);
          color: #fca5a5;
          padding: var(--space-12);
          border-radius: var(--radius-md);
          margin: 0 var(--space-8) var(--space-12);
          border: 1px solid rgba(248, 113, 113, 0.24);
          text-align: center;
        }

        .empty-state {
          padding: var(--space-40);
          text-align: center;
          color: var(--text-muted);
          border: 1px dashed var(--border-color);
          border-radius: var(--radius-lg);
          margin: 0 var(--space-8);
        }

        .feed-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-12);
        }

        .load-more-container {
          padding: var(--space-16) var(--space-8);
          display: flex;
          justify-content: center;
        }

        .load-more-btn {
          width: 100%;
          padding: var(--space-12);
          border-radius: var(--radius-md);
        }

        @media (max-width: 768px) {
          .feed-title {
            display: block;
          }
        }
      `}</style>
    </div>
  );
}

