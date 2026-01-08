import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { SearchIcon } from './Icons';

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
      <div style={styles.inputWrapper}>
        <SearchIcon size={18} color="#94a3b8" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по номеру телефона"
          style={styles.input}
        />
      </div>

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
    padding: '14px 16px',
    borderBottom: '1px solid #e2e8f0',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: '#f8fafc',
    border: '1.5px solid #e2e8f0',
    borderRadius: '14px',
    transition: 'all 0.2s ease',
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: '#1e293b',
    fontSize: '14px',
    outline: 'none',
  },
  results: {
    marginTop: '14px',
    maxHeight: '260px',
    overflowY: 'auto',
  },
  hint: {
    padding: '14px',
    color: '#94a3b8',
    fontSize: '14px',
    textAlign: 'center',
  },
  userItem: {
    width: '100%',
    padding: '12px 14px',
    background: '#ffffff',
    border: '1.5px solid #e2e8f0',
    borderRadius: '14px',
    color: '#1e293b',
    cursor: 'pointer',
    textAlign: 'left',
    marginBottom: '8px',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  userAvatar: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #10b981, #059669)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600',
    fontSize: '17px',
    color: '#fff',
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontWeight: '600',
    fontSize: '15px',
    marginBottom: '4px',
    color: '#1e293b',
  },
  userPhone: {
    fontSize: '13px',
    color: '#64748b',
  },
};

export default UserSearch;
