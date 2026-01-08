import React from 'react';
import UserSearch from './UserSearch';
import ChatList from './ChatList';
import { LogoutIcon } from './Icons';

function Sidebar({ token, chats, selectedChat, onSelectChat, onCreateChat, onLogout, incomingCallChatId }) {
  return (
    <div style={styles.sidebar}>
      {/* Заголовок и кнопка выхода */}
      <div style={styles.header}>
        <h2 style={styles.title}>
          <span style={styles.logoIcon}>💬</span>
          GovChat
        </h2>
        <button onClick={onLogout} style={styles.logoutBtn} title="Выйти">
          <LogoutIcon size={18} color="#ef4444" />
        </button>
      </div>

      {/* Поиск пользователей */}
      <UserSearch token={token} onCreateChat={onCreateChat} />

      {/* Список чатов */}
      <ChatList
        chats={chats}
        selectedChat={selectedChat}
        onSelectChat={onSelectChat}
        incomingCallChatId={incomingCallChatId}
      />
    </div>
  );
}

const styles = {
  sidebar: {
    width: '100%',
    height: '100%',
    background: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #e2e8f0',
    overflow: 'hidden',
  },
  header: {
    padding: '18px 20px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
    background: '#ffffff',
  },
  title: {
    margin: 0,
    fontSize: '22px',
    fontWeight: '700',
    color: '#1e293b',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    letterSpacing: '-0.02em',
  },
  logoIcon: {
    fontSize: '26px',
  },
  logoutBtn: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fef2f2',
    color: '#ef4444',
    border: '1.5px solid #fecaca',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
};

export default Sidebar;
