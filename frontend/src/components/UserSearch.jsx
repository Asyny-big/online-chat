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
      <div style={styles.searchWrapper}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти по номеру телефона"
          style={styles.input}
          onFocus={(e) => {
            e.target.style.borderColor = '#6366f1';
            e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.2)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            e.target.style.boxShadow = 'none';
          }}
        />
      </div>

      {query && (
        <div style={styles.results}>
          {loading && (
            <div style={styles.hint}>
              <div style={styles.spinner}></div>
              Поиск...
            </div>
          )}

          {!loading && results.length === 0 && (
            <div style={styles.emptyHint}>
              <span style={styles.emptyIcon}>👤</span>
              <span>Пользователь не найден</span>
            </div>
          )}

          {!loading &&
            results.map((user) => (
              <button
                key={user._id}
                onClick={() => handleSelectUser(user._id)}
                style={styles.userItem}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2))';
                  e.currentTarget.style.transform = 'translateX(4px)';
                  e.currentTarget.style.borderColor = '#6366f1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.transform = 'translateX(0)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                <div style={styles.userAvatar}>{user.name?.charAt(0)?.toUpperCase() || '?'}</div>
                <div style={styles.userInfo}>
                  <div style={styles.userName}>{user.name}</div>
                  <div style={styles.userPhone}>{user.phone}</div>
                </div>
                <span style={styles.addIcon}>➕</span>
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
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05), rgba(118, 75, 162, 0.05))',
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: '16px',
    fontSize: '16px',
    opacity: 0.5,
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '12px 16px 12px 44px',
    background: '#242837',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.3s ease',
    fontFamily: 'inherit',
    fontWeight: '500',
  },
  results: {
    marginTop: '16px',
    maxHeight: '280px',
    overflowY: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: '#6366f1 transparent',
  },
  hint: {
    padding: '16px 12px',
    color: '#a0aec0',
    fontSize: '14px',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  emptyHint: {
    padding: '24px 12px',
    color: '#718096',
    fontSize: '14px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  emptyIcon: {
    fontSize: '32px',
    opacity: 0.5,
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(99, 102, 241, 0.3)',
    borderTop: '2px solid #6366f1',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  userItem: {
    width: '100%',
    padding: '12px 14px',
    background: 'transparent',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '14px',
    color: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
    marginBottom: '8px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    transform: 'translateX(0)',
  },
  userAvatar: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #10b981, #059669)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '18px',
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontWeight: '600',
    fontSize: '15px',
    marginBottom: '2px',
    color: '#ffffff',
  },
  userPhone: {
    fontSize: '13px',
    color: '#a0aec0',
  },
  addIcon: {
    fontSize: '16px',
    opacity: 0.6,
    transition: 'all 0.3s ease',
  },
};

// Добавляем анимацию спиннера
if (typeof document !== 'undefined' && !document.getElementById('usersearch-animations')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'usersearch-animations';
  styleSheet.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default UserSearch;
