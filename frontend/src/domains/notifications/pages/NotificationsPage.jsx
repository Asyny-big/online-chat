import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '@/config';
import {
  BellIcon,
  CommentIcon,
  HeartIcon,
  MessageIcon,
  UserIcon
} from '@/shared/ui/Icons';

const UNREAD_BADGES_REFRESH_EVENT = 'govchat:unread-badges-refresh';

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

function resolveMessageAction(item) {
  const type = String(item?.meta?.messageType || '').toLowerCase();
  if (type === 'image') return 'отправил(а) фото';
  if (type === 'video') return 'отправил(а) видео';
  if (type === 'audio') return 'отправил(а) голосовое сообщение';
  if (type === 'file') return 'отправил(а) файл';
  return 'написал(а) сообщение';
}

function getNotificationAction(item) {
  const type = String(item?.type || '').toLowerCase();

  if (type === 'like') {
    const targetType = String(item?.meta?.targetType || '').toLowerCase();
    if (targetType === 'comment') return 'оценил(а) ваш комментарий';
    return 'оценил(а) вашу запись';
  }

  if (type === 'comment') {
    if (item?.meta?.reply) return 'ответил(а) на ваш комментарий';
    return 'прокомментировал(а) вашу запись';
  }

  if (type === 'friend_request') return 'отправил(а) заявку в друзья';
  if (type === 'friend_accept') return 'принял(а) вашу заявку в друзья';
  if (type === 'message') return resolveMessageAction(item);

  return 'выполнил(а) действие';
}

function NotificationTypeIcon({ type }) {
  const normalized = String(type || '').toLowerCase();

  if (normalized === 'like') return <HeartIcon size={18} />;
  if (normalized === 'comment') return <CommentIcon size={18} />;
  if (normalized === 'message') return <MessageIcon size={18} />;
  if (normalized === 'friend_request' || normalized === 'friend_accept') return <UserIcon size={18} />;

  return <BellIcon size={18} />;
}

export default function NotificationsPage({ token }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

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

  const handleMarkAsRead = async (notificationId) => {
    if (!notificationId) return;

    setItems((prev) => prev.map((item) => (
      item._id === notificationId ? { ...item, read: true } : item
    )));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(UNREAD_BADGES_REFRESH_EVENT));
    }

    try {
      await axios.patch(
        `${API_URL}/social/notifications/${notificationId}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (_) {
      // Keep optimistic read state for smoother UX.
    }
  };

  const handleMarkAllRead = async () => {
    if (markingAll || !items.some((item) => !item.read)) return;

    setMarkingAll(true);
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(UNREAD_BADGES_REFRESH_EVENT));
    }

    try {
      await axios.patch(
        `${API_URL}/social/notifications/read-all`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (_) {
      // Keep optimistic read state for smoother UX.
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="notifications-page">
      <div className="notifications-top">
        <h1 className="page-header">Уведомления</h1>
        <button
          type="button"
          className="btn btn-ghost mark-all-btn"
          onClick={handleMarkAllRead}
          disabled={markingAll || !items.some((item) => !item.read)}
        >
          {markingAll ? 'Обновление...' : 'Прочитать все'}
        </button>
      </div>

      {error ? <div className="error-message">{error}</div> : null}

      {!loading && items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <BellIcon size={34} />
          </div>
          <p>Уведомлений пока нет</p>
        </div>
      ) : null}

      <div className="notifications-list">
        {items.map((item) => (
          <button
            key={item._id}
            type="button"
            className={`notification-card ${item.read ? '' : 'unread'}`}
            onClick={() => {
              if (!item.read) void handleMarkAsRead(item._id);
            }}
          >
            <div className="notif-icon-wrap">
              <span className="notif-icon">
                <NotificationTypeIcon type={item.type} />
              </span>
            </div>

            <div className="notif-content">
              <div className="notif-header">
                <span className="actor-name">{item.actor?.name || 'Пользователь'}</span>
                <span className="notif-action">{getNotificationAction(item)}</span>
              </div>
              <div className="notif-time">{formatTime(item.createdAt)}</div>
            </div>

            {!item.read ? <span className="notif-unread-dot" aria-label="Непрочитано" /> : null}
          </button>
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

        .notifications-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-12);
          margin-bottom: var(--space-20);
        }

        .page-header {
          font-size: 24px;
          font-weight: 800;
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
          align-items: center;
          gap: var(--space-16);
          transition: var(--transition-fast);
          width: 100%;
          text-align: left;
          cursor: pointer;
        }

        .notification-card:hover {
          border-color: var(--border-color);
          background-color: var(--bg-surface);
        }

        .notification-card.unread {
          border-color: rgba(99, 102, 241, 0.45);
          background:
            linear-gradient(90deg, rgba(99, 102, 241, 0.12), rgba(99, 102, 241, 0.03)),
            var(--bg-card);
        }

        .notif-icon-wrap {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background-color: var(--bg-surface);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: var(--text-secondary);
        }

        .notif-content {
          flex: 1;
        }

        .notif-header {
          font-size: 15px;
          margin-bottom: var(--space-4);
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .actor-name {
          font-weight: 700;
          color: var(--text-primary);
        }

        .notif-action {
          color: var(--text-secondary);
        }

        .notif-time {
          font-size: 13px;
          color: var(--text-muted);
        }

        .notif-unread-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 0 6px rgba(99, 102, 241, 0.14);
          flex-shrink: 0;
        }

        .empty-state {
          text-align: center;
          padding: var(--space-40);
          color: var(--text-muted);
          border: 1px dashed var(--border-color);
          border-radius: var(--radius-card);
        }

        .empty-icon {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          margin: 0 auto var(--space-16);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-surface);
          color: var(--text-muted);
          opacity: 0.8;
        }

        .load-more-container {
          margin-top: var(--space-20);
          display: flex;
          justify-content: center;
        }

        .mark-all-btn {
          min-width: 150px;
          border-radius: 10px;
        }

        @media (max-width: 768px) {
          .notifications-top {
            flex-direction: column;
            align-items: stretch;
          }

          .mark-all-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
