import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_URL } from '@/config';
import { resolveAssetUrl } from '@/shared/lib/resolveAssetUrl';
import { uploadSocialMediaFile } from '@/shared/lib/uploadSocialMedia';
import { ImageIcon } from '@/shared/ui/Icons';

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
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaItems, setMediaItems] = useState([]);
  const [submitError, setSubmitError] = useState('');
  const mediaInputRef = useRef(null);

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

  const handlePickMedia = () => {
    mediaInputRef.current?.click();
  };

  const handleMediaChange = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length || mediaUploading) return;

    setMediaUploading(true);
    setSubmitError('');
    try {
      const uploaded = [];
      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop
        const media = await uploadSocialMediaFile({ file, token });
        if (media?._id) {
          uploaded.push(media);
        }
      }

      if (uploaded.length) {
        setMediaItems((prev) => [...prev, ...uploaded]);
      }
    } catch (err) {
      setSubmitError(err.response?.data?.error || err.message || 'Не удалось загрузить медиа');
    } finally {
      setMediaUploading(false);
    }
  };

  const handleRemoveMedia = (mediaId) => {
    setMediaItems((prev) => prev.filter((item) => item._id !== mediaId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if ((!trimmed && mediaItems.length === 0) || submitting || mediaUploading) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      await axios.post(
        `${API_URL}/social/comments`,
        {
          postId,
          text: trimmed,
          media: mediaItems.map((item) => item._id)
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setText('');
      setMediaItems([]);
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

          <input
            ref={mediaInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleMediaChange}
          />

          {mediaItems.length > 0 && (
            <div className="comments-media-grid">
              {mediaItems.map((item) => {
                const src = resolveAssetUrl(item.path || '');
                const isVideo = String(item.type || '').toLowerCase().includes('video');
                return (
                  <div key={item._id} className="comments-media-item">
                    {isVideo ? (
                      <video src={src} className="comments-media-preview" controls />
                    ) : (
                      <img src={src} alt="" className="comments-media-preview" />
                    )}
                    <button
                      type="button"
                      className="comments-media-remove"
                      onClick={() => handleRemoveMedia(item._id)}
                      aria-label="Удалить медиа"
                    >
                      x
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="comments-form-footer">
            <div className="comments-form-left">
              <button
                type="button"
                className="comments-attach-btn"
                onClick={handlePickMedia}
                disabled={mediaUploading}
              >
                <ImageIcon size={15} />
                <span>{mediaUploading ? 'Загрузка...' : 'Фото/видео'}</span>
              </button>
              <div className="comments-form-error">{submitError}</div>
            </div>
            <button
              type="submit"
              className="btn btn-primary comments-submit"
              disabled={submitting || mediaUploading || (!text.trim() && mediaItems.length === 0)}
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

                {comment.text ? <div className="comment-text">{comment.text}</div> : null}

                {Array.isArray(comment.media) && comment.media.length > 0 ? (
                  <div className="comment-media-grid">
                    {comment.media.map((item) => {
                      const src = resolveAssetUrl(item?.path || item?.url || '');
                      if (!src) return null;
                      const isVideo = String(item?.type || '').toLowerCase().includes('video');
                      return (
                        <div key={item?._id || src} className="comment-media-item">
                          {isVideo ? (
                            <video src={src} controls className="comment-media-preview" />
                          ) : (
                            <img src={src} alt="" className="comment-media-preview" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
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

        .comments-media-grid {
          margin-top: var(--space-10);
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
          gap: var(--space-8);
        }

        .comments-media-item {
          position: relative;
          border-radius: var(--radius-sm);
          overflow: hidden;
          border: 1px solid var(--border-color);
          background: var(--bg-surface);
          aspect-ratio: 4/3;
        }

        .comments-media-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .comments-media-remove {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 22px;
          height: 22px;
          border-radius: 7px;
          border: 1px solid rgba(248, 113, 113, 0.35);
          background: rgba(15, 23, 42, 0.82);
          color: #fca5a5;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          line-height: 1;
        }

        .comments-form-footer {
          margin-top: var(--space-10);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-12);
        }

        .comments-form-left {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: var(--space-8);
        }

        .comments-attach-btn {
          border: 1px solid var(--border-color);
          background: var(--bg-surface);
          color: var(--text-secondary);
          border-radius: 10px;
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .comments-attach-btn:hover {
          color: var(--text-primary);
          background: var(--bg-hover);
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

        .comment-media-grid {
          margin-top: var(--space-8);
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: var(--space-8);
        }

        .comment-media-item {
          border-radius: var(--radius-sm);
          overflow: hidden;
          border: 1px solid var(--border-color);
          background: var(--bg-surface);
          aspect-ratio: 16/10;
        }

        .comment-media-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
      `}</style>
    </div>
  );
}
