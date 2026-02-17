import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

function formatTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch (_) {
    return '';
  }
}

export default function NotificationsPage({ token }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async ({ reset = false } = {}) => {
    if (loading) return;

    setLoading(true);
    setError('');
    try {
      const query = reset || !cursor ? '' : `?cursor=${encodeURIComponent(cursor)}`;
      const res = await axios.get(`${API_URL}/social/notifications${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const nextItems = Array.isArray(res.data?.items) ? res.data.items : [];
      setItems((prev) => (reset ? nextItems : [...prev, ...nextItems]));
      setCursor(res.data?.nextCursor || null);
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось загрузить уведомления');
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, token]);

  useEffect(() => {
    setItems([]);
    setCursor(null);
    loadNotifications({ reset: true });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Уведомления</h1>
      {error ? <div style={styles.error}>{error}</div> : null}
      {!loading && items.length === 0 ? <div style={styles.empty}>Уведомлений пока нет</div> : null}

      <div style={styles.list}>
        {items.map((item) => (
          <div key={item._id} style={styles.card}>
            <div style={styles.header}>
              <div style={styles.type}>{item.type}</div>
              <div style={styles.time}>{formatTime(item.createdAt)}</div>
            </div>
            <div style={styles.body}>
              {item.actor?.name || 'Пользователь'} выполнил действие
            </div>
            <div style={styles.meta}>targetId: {String(item.targetId || '')}</div>
          </div>
        ))}
      </div>

      <div style={styles.loadMoreWrap}>
        <button
          type="button"
          style={styles.loadMore}
          disabled={loading || !cursor}
          onClick={() => loadNotifications({ reset: false })}
        >
          {loading ? 'Загрузка...' : cursor ? 'Показать ещё' : 'Конец списка'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: 18,
    maxWidth: 860,
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
    gap: 10
  },
  card: {
    border: '1px solid #1e293b',
    background: '#0b1220',
    borderRadius: 14,
    padding: 12
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  type: {
    color: '#bae6fd',
    fontWeight: 700,
    textTransform: 'capitalize'
  },
  time: {
    color: '#64748b',
    fontSize: 12
  },
  body: {
    color: '#e2e8f0'
  },
  meta: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 12
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
