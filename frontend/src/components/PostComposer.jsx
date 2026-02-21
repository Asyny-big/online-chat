import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '@/config';
import { ImageIcon, PollIcon, SmileIcon } from '@/shared/ui/Icons';

export default function PostComposer({ token, onCreated }) {
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError('');
    try {
      const res = await axios.post(
        `${API_URL}/social/posts`,
        { text: trimmed, visibility },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setText('');
      setVisibility('public');
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

        {error ? <div className="composer-error">{error}</div> : null}

        <div className="composer-footer">
          <div className="composer-actions">
            <button type="button" className="composer-icon-btn" title="Добавить фото" aria-label="Добавить фото">
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
            <button type="submit" disabled={loading || !text.trim()} className="btn btn-primary composer-submit">
              {loading ? '...' : 'Опубликовать'}
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

