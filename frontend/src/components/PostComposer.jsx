import React, { useRef, useState } from 'react';
import axios from 'axios';
import { API_URL } from '@/config';
import { resolveAssetUrl } from '@/shared/lib/resolveAssetUrl';
import { uploadSocialMediaFile } from '@/shared/lib/uploadSocialMedia';
import { ImageIcon, PollIcon, SmileIcon } from '@/shared/ui/Icons';

export default function PostComposer({ token, onCreated }) {
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [loading, setLoading] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaItems, setMediaItems] = useState([]);
  const [error, setError] = useState('');
  const mediaInputRef = useRef(null);

  const canSubmit = !!text.trim() || mediaItems.length > 0;

  const handlePickMedia = () => {
    mediaInputRef.current?.click();
  };

  const handleMediaChange = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length || mediaUploading) return;

    setMediaUploading(true);
    setError('');
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
      setError(err.response?.data?.error || err.message || 'Не удалось загрузить медиа');
    } finally {
      setMediaUploading(false);
    }
  };

  const handleRemoveMedia = (mediaId) => {
    setMediaItems((prev) => prev.filter((item) => item._id !== mediaId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((!text.trim() && mediaItems.length === 0) || loading || mediaUploading) return;

    setLoading(true);
    setError('');
    try {
      const res = await axios.post(
        `${API_URL}/social/posts`,
        {
          text: text.trim(),
          visibility,
          media: mediaItems.map((item) => item._id)
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setText('');
      setVisibility('public');
      setMediaItems([]);
      onCreated?.(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось опубликовать пост');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="composer-container">
      <div className="composer-avatar" aria-hidden="true">ME</div>

      <form onSubmit={handleSubmit} className="composer-form">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Что нового?"
          className="composer-input"
          rows={3}
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
          <div className="composer-media-grid">
            {mediaItems.map((item) => {
              const src = resolveAssetUrl(item.path || '');
              const isVideo = String(item.type || '').toLowerCase().includes('video');
              return (
                <div key={item._id} className="composer-media-item">
                  {isVideo ? (
                    <video src={src} className="composer-media-preview" controls />
                  ) : (
                    <img src={src} alt="" className="composer-media-preview" />
                  )}
                  <button
                    type="button"
                    className="composer-media-remove"
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

        {error ? <div className="composer-error">{error}</div> : null}

        <div className="composer-footer">
          <div className="composer-actions">
            <button
              type="button"
              className="composer-icon-btn"
              title="Добавить фото"
              aria-label="Добавить фото"
              onClick={handlePickMedia}
              disabled={mediaUploading}
            >
              <ImageIcon size={16} />
            </button>
            <button type="button" className="composer-icon-btn" title="Опрос" aria-label="Опрос">
              <PollIcon size={16} />
            </button>
            <button type="button" className="composer-icon-btn" title="Эмодзи" aria-label="Эмодзи">
              <SmileIcon size={16} />
            </button>
          </div>

          <div className="composer-submit-area">
            <label className="visibility-wrap">
              <span className="visibility-label">Видимость</span>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="visibility-select"
              >
                <option value="public">Все</option>
                <option value="friends">Друзья</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={loading || mediaUploading || !canSubmit}
              className="btn btn-primary composer-submit"
            >
              {mediaUploading ? 'Загрузка медиа...' : loading ? '...' : 'Опубликовать'}
            </button>
          </div>
        </div>
      </form>

      <style>{`
        .composer-container {
          display: flex;
          gap: var(--space-12);
          padding: var(--space-14);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          margin: 0 var(--space-8) var(--space-14);
          background:
            radial-gradient(circle at top right, rgba(79, 124, 255, 0.12), transparent 42%),
            var(--bg-card);
          box-shadow: var(--shadow-md);
        }

        .composer-avatar {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(145deg, rgba(79, 124, 255, 0.78), rgba(59, 130, 246, 0.9));
          display: grid;
          place-items: center;
          color: #eaf1ff;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          flex-shrink: 0;
        }

        .composer-form {
          flex: 1;
          min-width: 0;
        }

        .composer-input {
          width: 100%;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          background: var(--bg-surface);
          color: var(--text-primary);
          font-size: 15px;
          resize: vertical;
          min-height: 76px;
          padding: var(--space-10) var(--space-12);
          transition: var(--transition-normal);
        }

        .composer-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(79, 124, 255, 0.2);
        }

        .composer-input::placeholder {
          color: var(--text-muted);
        }

        .composer-media-grid {
          margin-top: var(--space-10);
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: var(--space-8);
        }

        .composer-media-item {
          position: relative;
          border-radius: var(--radius-md);
          overflow: hidden;
          border: 1px solid var(--border-color);
          background: var(--bg-surface);
          aspect-ratio: 4/3;
        }

        .composer-media-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .composer-media-remove {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 24px;
          height: 24px;
          border-radius: 8px;
          border: 1px solid rgba(248, 113, 113, 0.35);
          background: rgba(15, 23, 42, 0.8);
          color: #fca5a5;
          font-size: 13px;
          font-weight: 700;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .composer-media-remove:hover {
          background: rgba(248, 113, 113, 0.16);
          color: #fecdd3;
        }

        .composer-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: var(--space-10);
          gap: var(--space-12);
        }

        .composer-actions {
          display: flex;
          gap: var(--space-8);
        }

        .composer-icon-btn {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          border: 1px solid var(--border-color);
          background: var(--bg-surface);
          color: var(--text-secondary);
          transition: var(--transition-normal);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .composer-icon-btn:hover {
          background-color: var(--bg-hover);
          color: var(--text-primary);
        }

        .composer-submit-area {
          display: flex;
          align-items: center;
          gap: var(--space-10);
        }

        .visibility-wrap {
          display: flex;
          align-items: center;
          gap: var(--space-6);
        }

        .visibility-label {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 700;
        }

        .visibility-select {
          background: var(--bg-surface);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          font-size: 13px;
          font-weight: 700;
          padding: 6px 8px;
          cursor: pointer;
        }

        .visibility-select:hover {
          color: var(--text-primary);
        }

        .composer-error {
          color: #fda4af;
          font-size: 13px;
          margin-top: var(--space-8);
        }

        .composer-submit {
          min-width: 138px;
        }

        @media (max-width: 720px) {
          .composer-footer {
            flex-direction: column;
            align-items: flex-start;
          }

          .composer-submit-area {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </div>
  );
}
