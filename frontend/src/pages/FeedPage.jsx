import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import PostComposer from '../components/PostComposer';
import PostCard from '../components/PostCard';
import CommentsModal from '../components/CommentsModal';

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
    <div style={styles.page}>
      <h1 style={styles.title}>Лента</h1>
      <PostComposer token={token} onCreated={handlePostCreated} />

      {error ? <div style={styles.error}>{error}</div> : null}
      {!loading && items.length === 0 ? <div style={styles.empty}>Постов пока нет</div> : null}

      <div style={styles.list}>
        {items.map((item) => (
          <PostCard key={item._id} item={item} onOpenComments={setActivePostId} />
        ))}
      </div>

      <div style={styles.loadMoreWrap}>
        <button
          type="button"
          style={styles.loadMore}
          disabled={loading || !cursor}
          onClick={handleLoadMore}
        >
          {loading ? 'Загрузка...' : cursor ? 'Показать ещё' : 'Конец ленты'}
        </button>
      </div>

      {activePostId ? (
        <CommentsModal token={token} postId={activePostId} onClose={() => setActivePostId(null)} />
      ) : null}
    </div>
  );
}

const styles = {
  page: {
    padding: 18,
    maxWidth: 840,
    margin: '0 auto'
  },
  title: {
    margin: '0 0 14px 0',
    color: '#f8fafc',
    fontSize: 28
  },
  error: {
    marginBottom: 12,
    color: '#fca5a5'
  },
  empty: {
    border: '1px dashed #334155',
    borderRadius: 14,
    padding: 18,
    color: '#94a3b8'
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  },
  loadMoreWrap: {
    marginTop: 14,
    display: 'flex',
    justifyContent: 'center'
  },
  loadMore: {
    border: '1px solid #334155',
    background: '#020617',
    color: '#cbd5e1',
    borderRadius: 999,
    padding: '9px 14px',
    cursor: 'pointer'
  }
};
