import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '@/config';

function formatTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (_) {
    return '';
  }
}

export default function CommentsModal({ token, postId, onClose, onCommentCreated }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/social/comments/post/${postId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось загрузить комментарии');
    } finally {
      setLoading(false);
    }
  }, [token, postId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      await axios.post(
        `${API_URL}/social/comments`,
        { postId, text: trimmed },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setText('');
      await loadComments();
      await onCommentCreated?.();
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Не удалось отправить комментарий');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="comments-modal-overlay" onClick={onClose}>
      <div className="comments-modal" onClick={(e) => e.stopPropagation()}>
        <div className="comments-modal-header">
          <div className="comments-modal-title">Комментарии</div>
          <button type="button" onClick={onClose} className="comments-close" aria-label="Close comments">
            x
          </button>
        </div>

        <form className="comments-form" onSubmit={handleSubmit}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="comments-input"
            rows={3}
            placeholder="Написать комментарий..."
          />
          <div className="comments-form-footer">
            <div className="comments-form-error">{submitError}</div>
            <button
              type="submit"
              className="btn btn-primary comments-submit"
              disabled={submitting || !text.trim()}
            >
              {submitting ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </form>

        {loading ? <div className="comments-state">Загрузка...</div> : null}
        {error ? <div className="comments-state comments-state-error">{error}</div> : null}
        {!loading && !error && comments.length === 0 ? (
          <div className="comments-state">Комментариев пока нет</div>
        ) : null}

        {!loading && !error && comments.length > 0 ? (
          <div className="comments-list">
            {comments.map((comment) => (
              <div key={comment._id} className="comment-item">
                <div className="comment-meta">
                  <div className="comment-name">
                    {comment.authorId?.name || 'Пользователь'}
                  </div>
                  <div className="comment-time">{formatTime(comment.createdAt)}</div>
                </div>
                <div className="comment-text">{comment.text || ''}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <style>{`
        .comments-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.72);
          backdrop-filter: blur(4px);
          display: grid;
          place-items: center;
          z-index: 10000;
          padding: var(--space-16);
        }

        .comments-modal {
          width: min(760px, 96vw);
          max-height: 84vh;
          overflow: auto;
          background:
            radial-gradient(circle at top left, rgba(59, 130, 246, 0.12), transparent 55%),
            var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: var(--space-16);
          box-shadow: var(--shadow-xl);
        }

        .comments-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-12);
        }

        .comments-modal-title {
          color: var(--text-primary);
          font-size: 20px;
          font-weight: 800;
          letter-spacing: 0.01em;
        }

        .comments-close {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          background: var(--bg-surface);
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition-normal);
          font-size: 22px;
          line-height: 1;
        }

        .comments-close:hover {
          color: var(--text-primary);
          background: var(--bg-hover);
        }

        .comments-form {
          margin-bottom: var(--space-14);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--space-12);
          background: rgba(15, 23, 42, 0.68);
        }

        .comments-input {
          width: 100%;
          resize: vertical;
          min-height: 72px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          padding: var(--space-10) var(--space-12);
          background: var(--bg-surface);
          color: var(--text-primary);
          transition: var(--transition-normal);
        }

        .comments-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
        }

        .comments-input::placeholder {
          color: var(--text-muted);
        }

        .comments-form-footer {
          margin-top: var(--space-10);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-12);
        }

        .comments-form-error {
          color: #fda4af;
          font-size: 13px;
          min-height: 18px;
          flex: 1;
        }

        .comments-submit {
          min-width: 132px;
          border-radius: var(--radius-md);
        }

        .comments-state {
          color: var(--text-muted);
          padding: var(--space-12) var(--space-8);
        }

        .comments-state-error {
          color: #fca5a5;
        }

        .comments-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-10);
          margin-top: var(--space-10);
        }

        .comment-item {
          border: 1px solid var(--border-color);
          background: rgba(15, 23, 42, 0.78);
          border-radius: var(--radius-md);
          padding: var(--space-10) var(--space-12);
        }

        .comment-meta {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: var(--space-12);
          margin-bottom: var(--space-6);
        }

        .comment-name {
          color: var(--text-primary);
          font-weight: 700;
        }

        .comment-time {
          color: var(--text-muted);
          font-size: 12px;
        }

        .comment-text {
          color: var(--text-secondary);
          white-space: pre-wrap;
          line-height: 1.5;
          word-break: break-word;
        }
      `}</style>
    </div>
  );
}

