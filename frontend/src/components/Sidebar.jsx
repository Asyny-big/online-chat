import React, { useState } from 'react';
import UserSearch from './UserSearch';
import ChatList from './ChatList';
import CreateGroupModal from './CreateGroupModal';

function Sidebar({ token, chats, selectedChat, onSelectChat, onCreateChat, onAddChat, onLogout, incomingCallChatId }) {
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  return (
    <div style={styles.sidebar}>
      {/* Заголовок и кнопки */}
      <div style={styles.header}>
        <h2 style={styles.title}>
          <span style={styles.logo}>🦆</span>
          GovChat
        </h2>
        <div style={styles.headerActions}>
          <button 
            onClick={() => setShowCreateGroupModal(true)} 
            style={styles.groupChatBtn} 
            title="Создать групповой чат"
          >
            👥
          </button>
          <button onClick={onLogout} style={styles.logoutBtn} title="Выйти">
            ⎋
          </button>
        </div>
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

      {/* Модал создания группового чата */}
      {showCreateGroupModal && (
        <CreateGroupModal
          token={token}
          onClose={() => setShowCreateGroupModal(false)}
          onGroupCreated={(groupChat) => {
            onAddChat?.(groupChat);
            onSelectChat?.(groupChat);
            setShowCreateGroupModal(false);
          }}
        />
      )}
    </div>
  );
}

const styles = {
  sidebar: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid rgba(255,255,255,0.08)',
    overflow: 'hidden',
    boxShadow: '2px 0 16px rgba(0,0,0,0.2)',
    position: 'relative',
  },
  header: {
    padding: '18px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
  },
  title: {
    margin: 0,
    fontSize: '22px',
    fontWeight: '800',
    background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    letterSpacing: '0.5px',
    textShadow: '0 2px 8px rgba(96, 165, 250, 0.3)',
  },
  logo: {
    fontSize: '24px',
  },
  logoutBtn: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '18px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)',
  },
  groupChatBtn: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(168, 85, 247, 0.1)',
    color: '#a855f7',
    border: '1px solid rgba(168, 85, 247, 0.3)',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '18px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 2px 8px rgba(168, 85, 247, 0.2)',
  },
};

export default Sidebar;
