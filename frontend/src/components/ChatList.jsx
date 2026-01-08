import React from 'react';

function ChatList({ chats, selectedChat, onSelectChat, incomingCallChatId }) {
  // Защита от неправильного типа данных
  const chatList = Array.isArray(chats) ? chats : [];
  
  if (chatList.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>💬</div>
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
      {chatList.map((chat) => {
        const isActive = selectedChat?._id === chat._id;
        const hasIncomingCall = incomingCallChatId === chat._id;
        const displayName = chat.displayName || chat.name || 'Чат';
        const lastMsg = chat.lastMessage;
        
        let lastMessageText = 'Нет сообщений';
        if (lastMsg) {
          if (lastMsg.type === 'audio') lastMessageText = '🎤 Голосовое сообщение';
          else if (lastMsg.type === 'image') lastMessageText = '📷 Изображение';
          else if (lastMsg.type === 'video') lastMessageText = '🎥 Видео';
          else if (lastMsg.type === 'file') lastMessageText = '📎 Файл';
          else lastMessageText = lastMsg.text || 'Сообщение';
        }

        const initial = displayName.charAt(0).toUpperCase();

        return (
          <button
            key={chat._id}
            onClick={() => onSelectChat(chat)}
            style={{
              ...styles.chatItem,
              ...(isActive ? styles.chatItemActive : {}),
              ...(hasIncomingCall ? styles.chatItemCalling : {}),
            }}
          >
            <div style={styles.avatarWrapper}>
              <div style={styles.avatar}>{initial}</div>
              {hasIncomingCall && (
                <div style={styles.callIndicator}>
                  <span style={styles.callIndicatorDot}></span>
                </div>
              )}
            </div>
            <div style={styles.chatInfo}>
              <div style={styles.chatNameRow}>
                <span style={styles.chatName}>{displayName}</span>
                {hasIncomingCall && (
                  <span style={styles.callBadge}>📞</span>
                )}
              </div>
              <div style={styles.lastMessage}>
                {hasIncomingCall ? '🔔 Входящий звонок...' : lastMessageText}
              </div>
            </div>
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
    padding: '12px',
  },
  label: {
    fontSize: '11px',
    color: '#64748b',
    marginBottom: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '0 4px',
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
  },
  emptyIcon: {
    fontSize: '40px',
    marginBottom: '12px',
  },
  emptyText: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: '6px',
  },
  emptyHint: {
    fontSize: '13px',
    color: '#64748b',
    textAlign: 'center',
  },
  chatItem: {
    width: '100%',
    padding: '10px 12px',
    background: 'transparent',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
    marginBottom: '4px',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  chatItemActive: {
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
  },
  chatItemCalling: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    animation: 'pulse-call 1.5s infinite',
  },
  avatarWrapper: {
    position: 'relative',
    flexShrink: 0,
  },
  avatar: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600',
    fontSize: '16px',
    flexShrink: 0,
  },
  callIndicator: {
    position: 'absolute',
    top: '-2px',
    right: '-2px',
    width: '16px',
    height: '16px',
    background: '#ef4444',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #1e293b',
    animation: 'pulse-dot 1s infinite',
  },
  callIndicatorDot: {
    width: '6px',
    height: '6px',
    background: '#fff',
    borderRadius: '50%',
  },
  chatInfo: {
    flex: 1,
    minWidth: 0,
  },
  chatNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '2px',
  },
  chatName: {
    fontWeight: '600',
    fontSize: '14px',
  },
  callBadge: {
    fontSize: '12px',
    animation: 'shake 0.5s infinite',
  },
  lastMessage: {
    fontSize: '12px',
    color: '#94a3b8',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};

// Добавляем анимации
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes pulse-call {
      0%, 100% { 
        background: rgba(239, 68, 68, 0.15);
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
      }
      50% { 
        background: rgba(239, 68, 68, 0.25);
        box-shadow: 0 0 0 4px rgba(239, 68, 68, 0);
      }
    }
    @keyframes pulse-dot {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.2); }
    }
    @keyframes shake {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-10deg); }
      75% { transform: rotate(10deg); }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default ChatList;
