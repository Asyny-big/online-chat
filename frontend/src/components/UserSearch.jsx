import React, { useEffect, useRef } from 'react';
import { usePhoneUserLookup } from '../hooks/usePhoneUserLookup';
import { resolveAssetUrl } from '../utils/resolveAssetUrl';

function UserSearch({ token, onCreateChat, inputId = 'govchat-user-search' }) {
  const { phone, setPhone, status, user, error } = usePhoneUserLookup({ token, minLen: 9, debounceMs: 400 });
  const inputRef = useRef(null);

  useEffect(() => {
    const onFocusRequest = () => {
      if (!inputRef.current) return;
      inputRef.current.focus();
      inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    window.addEventListener('govchat:focus-user-search', onFocusRequest);
    return () => window.removeEventListener('govchat:focus-user-search', onFocusRequest);
  }, []);

  const handleSelectUser = (userId) => {
    onCreateChat(userId);
    setPhone('');
  };

  return (
    <div style={styles.container}>
      <input
        id={inputId}
        ref={inputRef}
        type="text"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Найдите пользователя по номеру телефона"
        style={styles.input}
      />

      {phone && (
        <div style={styles.results}>
          {status === 'too_short' && <div style={styles.hint}>Введите номер телефона полностью</div>}
          {status === 'loading' && <div style={styles.hint}>Поиск...</div>}

          {status === 'not_found' && <div style={styles.hint}>Пользователь не найден</div>}
          {status === 'rate_limited' && <div style={styles.hint}>{error || 'Слишком много запросов'}</div>}
          {status === 'error' && <div style={styles.hint}>{error || 'Ошибка поиска'}</div>}

          {status === 'found' && user && (
            <button onClick={() => handleSelectUser(user.id)} style={styles.userItem}>
              <div style={styles.userAvatar}>
                {resolveAssetUrl(user.avatar) ? (
                  <img alt="" src={resolveAssetUrl(user.avatar)} style={styles.userAvatarImg} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  user.name?.charAt(0)?.toUpperCase() || '?'
                )}
              </div>
              <div style={styles.userInfo}>
                <div style={styles.userName}>{user.name}</div>
                <div style={styles.userPhone}>{phone}</div>
              </div>
              <div style={styles.cta}>Начать чат</div>
            </button>
          )}
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
    overflow: 'hidden',
  },
  userAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
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
  cta: {
    fontSize: '12px',
    color: '#22c55e',
    fontWeight: '600',
    flexShrink: 0,
  },
};

export default UserSearch;
