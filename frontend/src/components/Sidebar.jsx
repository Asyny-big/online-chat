import React from 'react';
import UserSearch from './UserSearch';
import ChatList from './ChatList';

function Sidebar({ token, chats, selectedChat, onSelectChat, onCreateChat, onLogout }) {
  return (
    <div style={styles.sidebar}>
      {/* Заголовок и кнопка выхода */}
      <div style={styles.header}>
        <h2 style={styles.title}>GovChat</h2>
        <button onClick={onLogout} style={styles.logoutBtn}>
          Выйти
        </button>
      </div>

      {/* Поиск пользователей */}
      <UserSearch token={token} onCreateChat={onCreateChat} />

      {/* Список чатов */}
      <ChatList
        chats={chats}
        selectedChat={selectedChat}
        onSelectChat={onSelectChat}
      />
    </div>
  );
}

const styles = {
  sidebar: {
    width: '320px',
    background: '#1e293b',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #334155',
  },
  header: {
    padding: '16px',
    borderBottom: '1px solid #334155',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '600',
    color: '#fff',
  },
  logoutBtn: {
    padding: '8px 16px',
    background: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
};

export default Sidebar;
