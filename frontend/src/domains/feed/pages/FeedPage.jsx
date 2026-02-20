import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../../config';
import PostComposer from '../../../components/PostComposer';
import PostCard from '../../../components/PostCard';
import CommentsModal from '../../../components/CommentsModal';

export default function FeedPage({ token }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activePostId, setActivePostId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      setItems([]);
      setCursor(null);
      setLoading(true);
      setError('');
      try {
        const res = await axios.get(`${API_URL}/social/feed`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (cancelled) return;

        const nextItems = Array.isArray(res.data?.items) ? res.data.items : [];
        setItems(nextItems);
        setCursor(res.data?.nextCursor || null);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.error || 'Не удалось загрузить ленту');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadInitial();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleLoadMore = async () => {
    if (loading || !cursor) return;

    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/social/feed?cursor=${encodeURIComponent(cursor)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const nextItems = Array.isArray(res.data?.items) ? res.data.items : [];
      setItems((prev) => [...prev, ...nextItems]);
      setCursor(res.data?.nextCursor || null);
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось загрузить ленту');
    } finally {
      setLoading(false);
    }
  };

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
          <button className="feed-tab active">Популярное</button>
          <button className="feed-tab">Подписки</button>
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
        {items.map((item) => (
          <PostCard key={item._id} item={item} onOpenComments={setActivePostId} />
        ))}
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
        <CommentsModal token={token} postId={activePostId} onClose={() => setActivePostId(null)} />
      ) : null}

      <style>{`
        .feed-page {
          padding: var(--space-20) 0;
        }

        .feed-header {
            margin-bottom: var(--space-24);
            padding: 0 var(--space-16);
        }

        .feed-title {
            font-size: 24px;
            font-weight: 800;
            margin-bottom: var(--space-16);
            display: none; /* Hidden on desktop to look more like social feed, visible on mobile if needed */
        }

        .feed-tabs {
            display: flex;
            border-bottom: 1px solid var(--border-color);
        }

        .feed-tab {
            flex: 1;
            padding: var(--space-16);
            font-weight: 600;
            color: var(--text-secondary);
            border-bottom: 2px solid transparent;
            transition: var(--transition-fast);
        }

        .feed-tab:hover {
            background-color: var(--bg-surface);
            color: var(--text-primary);
        }

        .feed-tab.active {
            color: var(--text-primary);
            border-bottom-color: var(--accent);
        }

        .error-message {
            background-color: rgba(239, 68, 68, 0.1);
            color: var(--danger);
            padding: var(--space-12);
            border-radius: var(--radius-card);
            margin: 0 var(--space-16) var(--space-16);
            text-align: center;
        }

        .empty-state {
            padding: var(--space-40);
            text-align: center;
            color: var(--text-muted);
        }

        .feed-list {
            display: flex;
            flex-direction: column;
        }

        .load-more-container {
            padding: var(--space-20);
            display: flex;
            justify-content: center;
        }

        .load-more-btn {
            width: 100%;
            padding: var(--space-12);
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
