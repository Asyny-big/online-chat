import React, { useState, useCallback } from 'react';
import { API_URL } from '../config';
import { usePhoneUserLookup } from '../hooks/usePhoneUserLookup';

/**
 * CreateGroupModal - Модальное окно для создания группового чата
 */
function CreateGroupModal({ token, onClose, onGroupCreated }) {
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const { phone, setPhone, status, user, error: lookupError } = usePhoneUserLookup({ token, minLen: 9, debounceMs: 400 });

  // Добавление пользователя в выбранные
  const handleSelectUser = useCallback(() => {
    if (!user?.id) return;
    if (selectedUsers.some((u) => u.id === user.id)) {
      setPhone('');
      return;
    }
    setSelectedUsers((prev) => [...prev, user]);
    setPhone('');
  }, [selectedUsers, setPhone, user]);

  // Удаление пользователя из выбранных
  const handleRemoveUser = (userId) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  // Создание группового чата
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setError('Введите название группы');
      return;
    }
    
    if (selectedUsers.length < 1) {
      setError('Добавьте хотя бы одного участника');
      return;
    }

    try {
      setIsCreating(true);
      setError('');

      const res = await fetch(`${API_URL}/chats/group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: groupName.trim(),
          participantIds: selectedUsers.map(u => u.id)
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Не удалось создать группу');
      }

      const newGroup = await res.json();
      onGroupCreated(newGroup);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const isAlreadySelected = !!(user?.id && selectedUsers.some((u) => u.id === user.id));

  const lookupHint = (() => {
    if (!phone) return '';
    if (status === 'too_short') return 'Введите номер телефона полностью';
    if (status === 'loading') return 'Поиск...';
    if (status === 'not_found') return 'Пользователь не найден';
    if (status === 'rate_limited') return lookupError || 'Слишком много запросов. Попробуйте позже.';
    if (status === 'error') return lookupError || 'Ошибка поиска';
    return '';
  })();

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Заголовок */}
        <div style={styles.header}>
          <h2 style={styles.title}>Новая группа</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* Название группы */}
        <div style={styles.section}>
          <label style={styles.label}>Название группы</label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Введите название..."
            style={styles.input}
            maxLength={50}
          />
        </div>

        {/* Выбранные участники */}
        {selectedUsers.length > 0 && (
          <div style={styles.selectedSection}>
            <label style={styles.label}>Участники ({selectedUsers.length})</label>
            <div style={styles.selectedList}>
              {selectedUsers.map(user => (
                <div key={user.id} style={styles.selectedChip}>
                  <span style={styles.chipAvatar}>
                    {user.name?.charAt(0).toUpperCase() || '?'}
                  </span>
                  <span style={styles.chipName}>{user.name}</span>
                  <button
                    onClick={() => handleRemoveUser(user.id)}
                    style={styles.chipRemove}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Поиск пользователей */}
        <div style={styles.section}>
          <label style={styles.label}>Добавить участников</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Введите номер телефона..."
            style={styles.input}
          />
        </div>

        {/* Результат поиска (single-result, без списков) */}
        <div style={styles.listContainer}>
          {!!lookupHint && <div style={styles.hint}>{lookupHint}</div>}

          {status === 'found' && user && (
            <div style={styles.singleResultCard}>
              <div style={styles.contactAvatar}>
                {user.name?.charAt(0).toUpperCase() || '?'}
              </div>
              <div style={styles.contactInfo}>
                <div style={styles.contactName}>{user.name}</div>
                <div style={styles.contactPhone}>{phone}</div>
              </div>
              <button
                type="button"
                onClick={handleSelectUser}
                disabled={isAlreadySelected}
                style={{
                  ...styles.addUserBtn,
                  ...(isAlreadySelected ? styles.addUserBtnDisabled : {}),
                }}
              >
                {isAlreadySelected ? 'Уже добавлен' : 'Добавить в группу'}
              </button>
            </div>
          )}
        </div>

        {/* Ошибка */}
        {error && <div style={styles.error}>{error}</div>}

        {/* Кнопка создания */}
        <div style={styles.footer}>
          <button
            onClick={handleCreateGroup}
            disabled={isCreating || !groupName.trim() || selectedUsers.length === 0}
            style={{
              ...styles.createBtn,
              ...(isCreating || !groupName.trim() || selectedUsers.length === 0 
                ? styles.createBtnDisabled 
                : {})
            }}
          >
            {isCreating ? 'Создание...' : 'Создать группу'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '16px',
  },
  modal: {
    background: '#1e293b',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '440px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    margin: 0,
    color: '#fff',
    fontSize: '18px',
    fontWeight: '600',
  },
  closeBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
  },
  section: {
    padding: '16px 20px 0',
  },
  label: {
    display: 'block',
    color: '#94a3b8',
    fontSize: '12px',
    fontWeight: '500',
    marginBottom: '8px',
    textTransform: 'uppercase',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  selectedSection: {
    padding: '16px 20px 0',
  },
  selectedList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  selectedChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    background: '#3b82f6',
    borderRadius: '20px',
  },
  chipAvatar: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    color: '#fff',
    fontWeight: '600',
  },
  chipName: {
    color: '#fff',
    fontSize: '13px',
    fontWeight: '500',
  },
  chipRemove: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(255,255,255,0.2)',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
    minHeight: '200px',
    maxHeight: '300px',
  },
  hint: {
    textAlign: 'center',
    color: '#64748b',
    padding: '12px',
    fontSize: '13px',
  },
  singleResultCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    border: '1px solid #334155',
    borderRadius: '12px',
  },
  contactAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600',
    fontSize: '16px',
    flexShrink: 0,
  },
  contactInfo: {
    flex: 1,
    minWidth: 0,
  },
  contactName: {
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '2px',
  },
  contactPhone: {
    fontSize: '12px',
    color: '#64748b',
  },
  addUserBtn: {
    marginLeft: 'auto',
    padding: '10px 12px',
    borderRadius: '10px',
    border: 'none',
    background: '#3b82f6',
    color: '#fff',
    fontWeight: '600',
    cursor: 'pointer',
    flexShrink: 0,
  },
  addUserBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  error: {
    padding: '0 20px',
    color: '#ef4444',
    fontSize: '13px',
    marginBottom: '12px',
  },
  footer: {
    padding: '16px 20px',
    borderTop: '1px solid #334155',
  },
  createBtn: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #a855f7, #7e22ce)',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  createBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

export default CreateGroupModal;
