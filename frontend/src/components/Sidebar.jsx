import React, { useState } from 'react';
import UserSearch from './UserSearch';
import ChatList from './ChatList';
import CreateGroupModal from './CreateGroupModal';

function Sidebar({ token, chats, selectedChat, onSelectChat, onCreateChat, onLogout, incomingCallChatId }) {
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
            onCreateChat(groupChat);
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
};

export default Sidebar;
