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
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #a855f7, #7e22ce)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(168, 85, 247, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            👥
          </button>
          <button 
            onClick={onLogout} 
            style={styles.logoutBtn} 
            title="Выйти"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#ef4444';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#ef4444';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
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
    background: '#1a1d29',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  header: {
    padding: '20px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1))',
  },
  headerActions: {
    display: 'flex',
    gap: '10px',
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    letterSpacing: '-0.5px',
  },
  logo: {
    fontSize: '28px',
    filter: 'drop-shadow(0 2px 4px rgba(102, 126, 234, 0.3))',
  },
  logoutBtn: {
    width: '42px',
    height: '42px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    color: '#ef4444',
    border: '2px solid #ef4444',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '20px',
    fontWeight: '600',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    transform: 'translateY(0)',
  },
  groupChatBtn: {
    width: '42px',
    height: '42px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    color: '#a855f7',
    border: '2px solid #a855f7',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '18px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    transform: 'translateY(0)',
  },
};

export default Sidebar;
