import React, { useEffect, useState } from 'react';
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

export default function CommentsModal({ token, postId, onClose }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await axios.get(`${API_URL}/social/comments/post/${postId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!ignore) {
          setComments(Array.isArray(res.data?.items) ? res.data.items : []);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.error || 'Не удалось загрузить комментарии');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, [token, postId]);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.title}>Комментарии</div>
          <button type="button" onClick={onClose} style={styles.close}>✕</button>
        </div>

        {loading ? <div style={styles.state}>Загрузка...</div> : null}
        {error ? <div style={{ ...styles.state, color: '#fca5a5' }}>{error}</div> : null}
        {!loading && !error && comments.length === 0 ? (
          <div style={styles.state}>Комментариев пока нет</div>
        ) : null}

        {!loading && !error && comments.length > 0 ? (
          <div style={styles.list}>
            {comments.map((comment) => (
              <div key={comment._id} style={styles.item}>
                <div style={styles.name}>
                  {comment.authorId?.name || 'Пользователь'}
                </div>
                <div style={styles.text}>{comment.text || ''}</div>
                <div style={styles.time}>{formatTime(comment.createdAt)}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(2,6,23,0.75)',
    display: 'grid',
    placeItems: 'center',
    zIndex: 10000
  },
  modal: {
    width: 'min(700px, 92vw)',
    maxHeight: '80vh',
    overflow: 'auto',
    background: '#0b1220',
    border: '1px solid #1e293b',
    borderRadius: 16,
    padding: 14
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  title: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 800
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: '1px solid #334155',
    background: '#020617',
    color: '#cbd5e1',
    cursor: 'pointer'
  },
  state: {
    color: '#94a3b8',
    padding: '14px 6px'
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 8
  },
  item: {
    border: '1px solid #1e293b',
    background: '#0f172a',
    borderRadius: 12,
    padding: 10
  },
  name: {
    color: '#e2e8f0',
    fontWeight: 700,
    marginBottom: 6
  },
  text: {
    color: '#cbd5e1',
    whiteSpace: 'pre-wrap'
  },
  time: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 12
  }
};
