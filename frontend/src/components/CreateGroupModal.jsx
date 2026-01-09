import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config';

/**
 * CreateGroupModal - Модальное окно для создания группового чата
 */
function CreateGroupModal({ token, onClose, onGroupCreated }) {
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  // Загрузка контактов (пользователи из существующих чатов)
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`${API_URL}/users/contacts`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setContacts(data || []);
        }
      } catch (err) {
        console.error('Failed to fetch contacts:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchContacts();
  }, [token]);

  // Поиск пользователей по телефону
  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query);
    
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/users/search?phone=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Исключаем уже выбранных пользователей
        const filtered = data.filter(u => !selectedUsers.find(s => s._id === u._id));
        setSearchResults(filtered);
      }
    } catch (err) {
      console.error('Search error:', err);
    }
  }, [token, selectedUsers]);

  // Добавление пользователя в выбранные
  const handleSelectUser = (user) => {
    if (!selectedUsers.find(u => u._id === user._id)) {
      setSelectedUsers(prev => [...prev, user]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  // Удаление пользователя из выбранных
  const handleRemoveUser = (userId) => {
    setSelectedUsers(prev => prev.filter(u => u._id !== userId));
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
          participantIds: selectedUsers.map(u => u._id)
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

  // Список для отображения (контакты или результаты поиска)
  const displayList = searchQuery.length >= 3 ? searchResults : contacts;

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
                <div key={user._id} style={styles.selectedChip}>
                  <span style={styles.chipAvatar}>
                    {user.name?.charAt(0).toUpperCase() || '?'}
                  </span>
                  <span style={styles.chipName}>{user.name}</span>
                  <button
                    onClick={() => handleRemoveUser(user._id)}
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
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Поиск по номеру телефона..."
            style={styles.input}
          />
        </div>

        {/* Список контактов/результатов */}
        <div style={styles.listContainer}>
          {isLoading ? (
            <div style={styles.loading}>Загрузка...</div>
          ) : displayList.length === 0 ? (
            <div style={styles.empty}>
              {searchQuery.length >= 3 
                ? 'Пользователи не найдены' 
                : 'Нет контактов'}
            </div>
          ) : (
            displayList
              .filter(user => !selectedUsers.find(s => s._id === user._id))
              .map(user => (
                <button
                  key={user._id}
                  onClick={() => handleSelectUser(user)}
                  style={styles.contactItem}
                >
                  <div style={styles.contactAvatar}>
                    {user.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div style={styles.contactInfo}>
                    <div style={styles.contactName}>{user.name}</div>
                    <div style={styles.contactPhone}>{user.phone}</div>
                  </div>
                  <span style={styles.addIcon}>+</span>
                </button>
              ))
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
  loading: {
    textAlign: 'center',
    color: '#64748b',
    padding: '20px',
  },
  empty: {
    textAlign: 'center',
    color: '#64748b',
    padding: '20px',
  },
  contactItem: {
    width: '100%',
    padding: '10px 12px',
    background: 'transparent',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '4px',
    transition: 'background 0.2s',
    textAlign: 'left',
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
  addIcon: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: '#334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    color: '#3b82f6',
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
