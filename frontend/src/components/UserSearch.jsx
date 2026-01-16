import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

function UserSearch({ token, onCreateChat }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          `${API_URL}/users/search?phone=${encodeURIComponent(query)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setResults(res.data || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, token]);

  const handleSelectUser = (userId) => {
    onCreateChat(userId);
    setQuery('');
    setResults([]);
  };

  return (
    <div style={styles.container}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Найдите пользователя по номеру телефона"
        style={styles.input}
      />

      {query && (
        <div style={styles.results}>
          {loading && <div style={styles.hint}>Поиск...</div>}

          {!loading && results.length === 0 && (
            <div style={styles.hint}>Пользователь не найден</div>
          )}

          {!loading &&
            results.map((user) => (
              <button
                key={user._id}
                onClick={() => handleSelectUser(user._id)}
                style={styles.userItem}
              >
                <div style={styles.userAvatar}>{user.name?.charAt(0)?.toUpperCase() || '?'}</div>
                <div style={styles.userInfo}>
                  <div style={styles.userName}>{user.name}</div>
                  <div style={styles.userPhone}>{user.phone}</div>
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '12px',
    borderBottom: '1px solid #334155',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '24px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  results: {
    marginTop: '12px',
    maxHeight: '240px',
    overflowY: 'auto',
  },
  hint: {
    padding: '12px',
    color: '#64748b',
    fontSize: '13px',
    textAlign: 'center',
  },
  userItem: {
    width: '100%',
    padding: '10px 12px',
    background: 'transparent',
    border: '1px solid #334155',
    borderRadius: '12px',
    color: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
    marginBottom: '6px',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  userAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600',
    fontSize: '16px',
    flexShrink: 0,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontWeight: '600',
    fontSize: '14px',
    marginBottom: '2px',
  },
  userPhone: {
    fontSize: '12px',
    color: '#94a3b8',
  },
};

export default UserSearch;
