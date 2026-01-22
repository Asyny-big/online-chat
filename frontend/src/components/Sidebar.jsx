import React, { useState } from 'react';
import UserSearch from './UserSearch';
import ChatList from './ChatList';
import CreateGroupModal from './CreateGroupModal';
import ProfileDrawer from './ProfileDrawer';
import ProfilePage from '../pages/ProfilePage';
import { useMediaQuery } from '../hooks/useMediaQuery';

function Sidebar({ token, chats, selectedChat, onSelectChat, onCreateChat, onAddChat, onLogout, incomingCallChatId }) {
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 769px)', { defaultValue: true });
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

      {/* Внизу списка чатов */}
      <div style={styles.bottomBar}>
        <button style={styles.profileBtn} onClick={() => setShowProfile(true)}>
          <span style={styles.profileIcon}>👤</span>
          <span style={styles.profileText}>Профиль</span>
        </button>
      </div>

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

      {showProfile && (
        isDesktop ? (
          <ProfilePage token={token} onClose={() => setShowProfile(false)} onLogout={onLogout} />
        ) : (
          <ProfileDrawer token={token} onClose={() => setShowProfile(false)} onLogout={onLogout} />
        )
      )}
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
  headerActions: {
    display: 'flex',
    gap: '8px',
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
  groupChatBtn: {
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    color: '#a855f7',
    border: '1px solid #a855f7',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'all 0.2s',
  },
  bottomBar: {
    marginTop: 'auto',
    padding: '12px',
    borderTop: '1px solid #334155',
    background: 'rgba(15,23,42,0.35)',
  },
  profileBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 14px',
    borderRadius: '14px',
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'rgba(2,6,23,0.35)',
    color: '#fff',
    cursor: 'pointer',
    transition: 'transform 0.15s ease, background 0.15s ease',
  },
  profileIcon: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    flexShrink: 0,
  },
  profileText: {
    fontSize: '14px',
    fontWeight: '700',
    letterSpacing: 0.1,
  },
};

export default Sidebar;
