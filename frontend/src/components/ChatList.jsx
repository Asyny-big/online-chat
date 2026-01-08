import React from 'react';

function ChatList({ chats, selectedChat, onSelectChat }) {
  if (chats.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyText}>Нет чатов</div>
        <div style={styles.emptyHint}>
          Найдите пользователя по номеру телефона
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.label}>Чаты</div>
      {chats.map((chat) => {
        const isActive = selectedChat?._id === chat._id;
        const displayName = chat.displayName || chat.name || 'Чат';
        const lastMessage = chat.lastMessage?.text || 'Нет сообщений';

        return (
          <button
            key={chat._id}
            onClick={() => onSelectChat(chat)}
            style={{
              ...styles.chatItem,
              ...(isActive ? styles.chatItemActive : {}),
            }}
          >
            <div style={styles.chatName}>{displayName}</div>
            <div style={styles.lastMessage}>{lastMessage}</div>
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  label: {
    fontSize: '12px',
    color: '#94a3b8',
    marginBottom: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
  },
  emptyText: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: '8px',
  },
  emptyHint: {
    fontSize: '13px',
    color: '#64748b',
    textAlign: 'center',
  },
  chatItem: {
    width: '100%',
    padding: '12px',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
    marginBottom: '8px',
    transition: 'all 0.2s',
  },
  chatItemActive: {
    background: '#1e40af',
    borderColor: '#3b82f6',
  },
  chatName: {
    fontWeight: '600',
    marginBottom: '4px',
  },
  lastMessage: {
    fontSize: '12px',
    color: '#94a3b8',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};

export default ChatList;
