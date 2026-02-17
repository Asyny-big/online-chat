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
    <form onSubmit={handleSubmit} style={styles.wrap}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Что у вас нового?"
        style={styles.textarea}
        rows={3}
      />
      <div style={styles.bottom}>
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          style={styles.select}
        >
          <option value="public">Публично</option>
          <option value="friends">Только друзья</option>
        </select>
        <button type="submit" disabled={loading || !text.trim()} style={styles.submit}>
          {loading ? 'Публикация...' : 'Опубликовать'}
        </button>
      </div>
      {error ? <div style={styles.error}>{error}</div> : null}
    </form>
  );
}

const styles = {
  wrap: {
    border: '1px solid #1f2937',
    background: '#0f172a',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14
  },
  textarea: {
    width: '100%',
    background: '#020617',
    color: '#e2e8f0',
    border: '1px solid #334155',
    borderRadius: 12,
    padding: 12,
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
    fontSize: 15
  },
  bottom: {
    marginTop: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  select: {
    background: '#020617',
    color: '#cbd5e1',
    border: '1px solid #334155',
    borderRadius: 10,
    padding: '8px 10px'
  },
  submit: {
    background: '#0284c7',
    color: '#f8fafc',
    border: 'none',
    borderRadius: 999,
    padding: '10px 16px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  error: {
    marginTop: 8,
    color: '#fca5a5',
    fontSize: 13
  }
};
