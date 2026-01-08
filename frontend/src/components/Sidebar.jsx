import React from 'react';
import UserSearch from './UserSearch';
import ChatList from './ChatList';

function Sidebar({ token, chats, selectedChat, onSelectChat, onCreateChat, onLogout }) {
  return (
    <div style={styles.sidebar}>
      {/* Заголовок и кнопка выхода */}
      <div style={styles.header}>
        <h2 style={styles.title}>
          <span style={styles.logo}>🦆</span>
          GovChat
        </h2>
        <button onClick={onLogout} style={styles.logoutBtn} title="Выйти">
          ⎋
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
    width: '100%',
    height: '100%',
    background: '#1e293b',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #334155',
    overflow: 'hidden',
  },
  header: {
    padding: '16px',
    borderBottom: '1px solid #334155',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '700',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logo: {
    fontSize: '24px',
  },
  logoutBtn: {
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    color: '#ef4444',
    border: '1px solid #ef4444',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '18px',
    transition: 'all 0.2s',
  },
};

export default Sidebar;
