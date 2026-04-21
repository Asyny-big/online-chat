import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '@/config';
import { resolveAssetUrl } from '@/shared/lib/resolveAssetUrl';
import { uploadSocialMediaFile } from '@/shared/lib/uploadSocialMedia';
import { ImageIcon, PollIcon, SmileIcon, PlusIcon } from '@/shared/ui/Icons';

export default function PostComposer({ token, onCreated }) {
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [loading, setLoading] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaItems, setMediaItems] = useState([]);
  const [error, setError] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  
  const mediaInputRef = useRef(null);
  const textareaRef = useRef(null);

  const canSubmit = !!text.trim() || mediaItems.length > 0;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text]);

  const handlePickMedia = () => {
    setShowMenu(false);
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
    e?.preventDefault();
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
      setShowMenu(false);
      onCreated?.(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Не удалось опубликовать пост');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="composer-container" data-onboarding-id="post-composer">
      <div className="composer-main">
        <div className="composer-avatar" aria-hidden="true">ME</div>
        
        <div className="composer-input-wrapper">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Что нового?"
            className="composer-input"
            rows={1}
          />
        </div>
      </div>

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
                  &times;
                </button>
              </div>
            );
          })}
        </div>
      )}

      {error ? <div className="composer-error">{error}</div> : null}

      <div className="composer-footer">
        <div className="composer-action-left">
          <button
            type="button"
            className={`composer-icon-btn ${showMenu ? 'active' : ''}`}
            title="Прикрепить"
            aria-label="Прикрепить"
            aria-expanded={showMenu}
            onClick={() => setShowMenu(!showMenu)}
          >
            <PlusIcon size={20} />
          </button>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || mediaUploading || !canSubmit}
          className="composer-submit-btn"
        >
          {mediaUploading ? 'Загрузка...' : loading ? '...' : 'Опубликовать'}
        </button>
      </div>

      {showMenu && (
        <div className="composer-menu">
          <button 
            type="button" 
            className="composer-menu-item"
            onClick={handlePickMedia}
            disabled={mediaUploading}
          >
            <span className="menu-icon-wrap bg-image"><ImageIcon size={18} /></span>
            <span className="menu-text">Прикрепить фото</span>
          </button>
          
          <button type="button" className="composer-menu-item">
            <span className="menu-icon-wrap bg-poll"><PollIcon size={18} /></span>
            <span className="menu-text">Опрос</span>
          </button>
          
          <button type="button" className="composer-menu-item">
            <span className="menu-icon-wrap bg-smile"><SmileIcon size={18} /></span>
            <span className="menu-text">Эмоции</span>
          </button>
          
          <div className="composer-menu-divider" />
          
          <div className="composer-menu-item visibility-row">
            <span className="menu-text visibility-label">Видимость:</span>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="visibility-select"
            >
              <option value="public">Все</option>
              <option value="friends">Друзья</option>
            </select>
          </div>
        </div>
      )}

      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleMediaChange}
      />

      <style>{`
        .composer-container {
          display: flex;
          flex-direction: column;
          gap: var(--space-8);
          padding: var(--space-12) var(--space-14);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          margin: 0 var(--space-8) var(--space-14);
          background: var(--bg-card);
          box-shadow: var(--shadow-sm);
          position: relative;
        }

        .composer-main {
          display: flex;
          gap: var(--space-12);
          align-items: flex-start;
          width: 100%;
        }

        .composer-avatar {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          background: linear-gradient(145deg, rgba(79, 124, 255, 0.78), rgba(59, 130, 246, 0.9));
          display: grid;
          place-items: center;
          color: #eaf1ff;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .composer-input-wrapper {
          flex: 1;
          min-width: 0;
        }

        .composer-input {
          width: 100%;
          min-height: 40px;
          max-height: 200px;
          border: none;
          background: transparent;
          color: var(--text-primary);
          font-size: 15px;
          line-height: 1.5;
          resize: none;
          padding: 8px 0;
          outline: none;
        }

        .composer-input::placeholder {
          color: var(--text-muted);
        }

        .composer-media-grid {
          margin-top: var(--space-4);
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: var(--space-8);
          padding-left: 48px; /* Align with input */
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
          top: 4px;
          right: 4px;
          width: 22px;
          height: 22px;
          border-radius: 6px;
          border: none;
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(4px);
          color: #fff;
          font-size: 14px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .composer-error {
          color: #fda4af;
          font-size: 13px;
          padding-left: 48px;
        }

        .composer-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: var(--space-4);
          padding-left: 48px;
          gap: var(--space-12);
        }

        .composer-action-left {
          display: flex;
          align-items: center;
          gap: var(--space-8);
        }

        .composer-icon-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: var(--bg-surface);
          color: var(--text-secondary);
          transition: var(--transition-normal);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .composer-icon-btn:hover,
        .composer-icon-btn.active {
          background-color: var(--accent);
          color: #fff;
        }

        .composer-submit-btn {
          background: var(--accent);
          color: #fff;
          border: none;
          border-radius: 20px;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          white-space: nowrap;
        }

        .composer-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .composer-submit-btn:hover:not(:disabled) {
          background: var(--accent-hover);
        }

        .composer-menu {
          position: absolute;
          top: calc(100% + 4px);
          left: 60px;
          z-index: 20;
          width: 200px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          padding: var(--space-8);
          display: flex;
          flex-direction: column;
          gap: 2px;
          animation: menuSlideIn 0.2s ease;
        }

        @keyframes menuSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .composer-menu-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 8px;
          border: none;
          background: transparent;
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 14px;
          text-align: left;
          cursor: pointer;
          transition: background 0.1s;
        }

        .composer-menu-item:hover:not(:disabled) {
          background: var(--bg-hover);
        }

        .composer-menu-item:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .menu-icon-wrap {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .menu-icon-wrap.bg-image { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
        .menu-icon-wrap.bg-poll { background: rgba(16, 185, 129, 0.15); color: #10b981; }
        .menu-icon-wrap.bg-smile { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }

        .menu-text {
          font-weight: 500;
        }

        .composer-menu-divider {
          height: 1px;
          background: var(--border-color);
          margin: 6px 0;
        }

        .visibility-row {
          justify-content: space-between;
          padding: 4px 8px;
        }

        .visibility-label {
          color: var(--text-muted);
          font-size: 13px;
        }

        .visibility-select {
          background: transparent;
          color: var(--text-primary);
          border: none;
          font-size: 13px;
          font-weight: 600;
          outline: none;
          cursor: pointer;
        }

        @media (max-width: 768px) {
          .composer-container {
            margin: 0;
            border-radius: 0;
            border-left: none;
            border-right: none;
            border-top: none;
            padding: 12px 16px;
            background: var(--bg-primary);
          }

          .composer-menu {
            position: fixed;
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            border-radius: 20px 20px 0 0;
            padding: 16px;
            padding-bottom: calc(16px + var(--safe-area-bottom));
            border: none;
            border-top: 1px solid var(--border-color);
            background: var(--bg-card);
            gap: 8px;
            z-index: 1000;
            animation: bottomSheetSlide 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 -10px 40px rgba(0,0,0,0.3);
          }

          @keyframes bottomSheetSlide {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }

          .composer-menu-item {
            padding: 12px;
            font-size: 16px;
          }

          .menu-icon-wrap {
            width: 36px;
            height: 36px;
          }

          .visibility-row {
            padding: 12px;
          }

          .visibility-select {
            font-size: 15px;
          }
        }
      `}</style>
    </div>
  );
}
