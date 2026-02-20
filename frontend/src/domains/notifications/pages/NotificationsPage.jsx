import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../../config';

function formatTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (_) {
    return '';
  }
}

export default function NotificationsPage({ token }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      setItems([]);
      setCursor(null);
      setLoading(true);
      setError('');
      try {
        const res = await axios.get(`${API_URL}/social/notifications`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (cancelled) return;

        const nextItems = Array.isArray(res.data?.items) ? res.data.items : [];
        setItems(nextItems);
        setCursor(res.data?.nextCursor || null);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.error || 'Не удалось загрузить уведомления');
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
      const res = await axios.get(`${API_URL}/social/notifications?cursor=${encodeURIComponent(cursor)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const nextItems = Array.isArray(res.data?.items) ? res.data.items : [];
      setItems((prev) => [...prev, ...nextItems]);
      setCursor(res.data?.nextCursor || null);
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось загрузить уведомления');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="notifications-page">
      <h1 className="page-header">Уведомления</h1>

      {error ? <div className="error-message">{error}</div> : null}

      {!loading && items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔔</div>
          <p>Уведомлений пока нет</p>
        </div>
      ) : null}

      <div className="notifications-list">
        {items.map((item) => (
          <div key={item._id} className="notification-card">
            <div className="notif-icon-wrap">
              {item.type === 'like' && <span className="notif-icon like-icon">❤️</span>}
              {item.type === 'comment' && <span className="notif-icon comment-icon">💬</span>}
              {item.type === 'follow' && <span className="notif-icon follow-icon">👤</span>}
              {!['like', 'comment', 'follow'].includes(item.type) && <span className="notif-icon">🔔</span>}
            </div>

            <div className="notif-content">
              <div className="notif-header">
                <span className="actor-name">{item.actor?.name || 'Пользователь'}</span>
                <span className="notif-action">
                  {item.type === 'like' && 'оценил(а) вашу запись'}
                  {item.type === 'comment' && 'прокомментировал(а)'}
                  {item.type === 'follow' && 'подписался на вас'}
                  {!['like', 'comment', 'follow'].includes(item.type) && 'выполнил действие'}
                </span>
              </div>
              <div className="notif-time">{formatTime(item.createdAt)}</div>
            </div>

            {item.targetId && <div className="notif-preview">ID: {String(item.targetId).slice(-4)}</div>}
          </div>
        ))}
      </div>

      <div className="load-more-container">
        <button
          type="button"
          className="btn btn-secondary load-more-btn"
          disabled={loading || !cursor}
          onClick={handleLoadMore}
        >
          {loading ? 'Загрузка...' : cursor ? 'Показать ещё' : 'Конец списка'}
        </button>
      </div>

      <style>{`
        .notifications-page {
          padding: var(--space-20);
        }
        
        .page-header {
            font-size: 24px;
            font-weight: 800;
            margin-bottom: var(--space-20);
            color: var(--text-primary);
        }

        .notifications-list {
            display: flex;
            flex-direction: column;
            gap: var(--space-12);
        }

        .notification-card {
            background-color: var(--bg-card);
            border: 1px solid var(--border-light);
            border-radius: var(--radius-card);
            padding: var(--space-16);
            display: flex;
            align-items: flex-start;
            gap: var(--space-16);
            transition: var(--transition-fast);
        }

        .notification-card:hover {
            border-color: var(--border-color);
            background-color: var(--bg-surface);
        }

        .notif-icon-wrap {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background-color: var(--bg-surface);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            font-size: 20px;
        }

        .notif-content {
            flex: 1;
        }

        .notif-header {
            font-size: 15px;
            margin-bottom: var(--space-4);
        }

        .actor-name {
            font-weight: 700;
            color: var(--text-primary);
            margin-right: var(--space-6);
        }

        .notif-action {
            color: var(--text-secondary);
        }

        .notif-time {
            font-size: 13px;
            color: var(--text-muted);
        }

        .notif-preview {
            font-size: 12px;
            color: var(--text-muted);
            background: var(--bg-primary);
            padding: var(--space-4) var(--space-8);
            border-radius: 6px;
        }

        .empty-state {
            text-align: center;
            padding: var(--space-40);
            color: var(--text-muted);
            border: 1px dashed var(--border-color);
            border-radius: var(--radius-card);
        }

        .empty-icon {
            font-size: 40px;
            margin-bottom: var(--space-16);
            opacity: 0.5;
        }

        .load-more-container {
            margin-top: var(--space-20);
            display: flex;
            justify-content: center;
        }
      `}</style>
    </div>
  );
}
