import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

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
      <div className="composer-avatar">
        {/* Placeholder for current user avatar */}
        <div className="avatar-placeholder">😎</div>
      </div>
      <form onSubmit={handleSubmit} className="composer-form">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Что нового?"
          className="composer-input"
          rows={2}
        />

        {error ? <div className="composer-error">{error}</div> : null}

        <div className="composer-footer">
          <div className="composer-actions">
            <button type="button" className="action-btn" title="Добавить фото">📎</button>
            <button type="button" className="action-btn" title="Опрос">📊</button>
            <button type="button" className="action-btn" title="Эмодзи">🎨</button>
          </div>

          <div className="composer-submit-area">
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="visibility-select"
            >
              <option value="public">🌎 Все</option>
              <option value="friends">👥 Друзья</option>
            </select>
            <button type="submit" disabled={loading || !text.trim()} className="btn btn-primary btn-sm">
              {loading ? '...' : 'Опубликовать'}
            </button>
          </div>
        </div>
      </form>

      <style>{`
        .composer-container {
            display: flex;
            gap: 16px;
            padding: 16px;
            border-bottom: 1px solid var(--border-color);
            margin-bottom: 20px;
        }

        .composer-avatar {
            flex-shrink: 0;
        }

        .avatar-placeholder {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background-color: var(--bg-card);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }

        .composer-form {
            flex: 1;
        }

        .composer-input {
            width: 100%;
            background: transparent;
            border: none;
            color: var(--text-primary);
            font-size: 16px;
            resize: none;
            min-height: 60px;
            padding: 10px 0;
        }

        .composer-input::placeholder {
            color: var(--text-muted);
        }

        .composer-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid var(--border-light);
        }

        .composer-actions {
            display: flex;
            gap: 8px;
        }

        .action-btn {
            color: var(--accent);
            font-size: 18px;
            padding: 6px;
            border-radius: 50%;
            transition: var(--transition-fast);
        }

        .action-btn:hover {
            background-color: var(--accent-light);
        }

        .composer-submit-area {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .visibility-select {
            background: transparent;
            color: var(--text-secondary);
            border: none;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
        }

        .visibility-select:hover {
            color: var(--text-primary);
        }

        .composer-error {
            color: var(--danger);
            font-size: 13px;
            margin-bottom: 8px;
        }

        .btn-sm {
            padding: 6px 16px;
            font-size: 14px;
        }
      `}</style>
    </div>
  );
}

