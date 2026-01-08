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
                <div style={styles.userName}>{user.name}</div>
                <div style={styles.userPhone}>{user.phone}</div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '16px',
    borderBottom: '1px solid #334155',
  },
  input: {
    width: '100%',
    padding: '12px',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },
  results: {
    marginTop: '12px',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  hint: {
    padding: '12px',
    color: '#94a3b8',
    fontSize: '13px',
    textAlign: 'center',
  },
  userItem: {
    width: '100%',
    padding: '12px',
    background: '#0f172a',
    border: '1px solid #3b82f6',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
    marginBottom: '8px',
    transition: 'all 0.2s',
  },
  userName: {
    fontWeight: '600',
    marginBottom: '4px',
  },
  userPhone: {
    fontSize: '12px',
    color: '#94a3b8',
  },
};

export default UserSearch;
