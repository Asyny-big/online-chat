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
        const isGroupChat = chat.type === 'group' || chat.isGroup === true;
        const hasActiveGroupCall = chat.activeGroupCall !== null && chat.activeGroupCall !== undefined;
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

        const initial = isGroupChat ? '👥' : displayName.charAt(0).toUpperCase();

        return (
          <button
            key={chat._id}
            onClick={() => onSelectChat(chat)}
            style={{
              ...styles.chatItem,
              ...(isActive ? styles.chatItemActive : {}),
              ...(hasIncomingCall ? styles.chatItemCalling : {}),
              ...(hasActiveGroupCall ? styles.chatItemActiveCall : {}),
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                e.currentTarget.style.transform = 'translateX(4px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.transform = 'translateX(0)';
              }
            }}
          >
            <div style={styles.avatarWrapper}>
              <div style={{
                ...styles.avatar,
                ...(isGroupChat ? styles.groupAvatar : {})
              }}>
                {initial}
              </div>
              {(hasIncomingCall || hasActiveGroupCall) && (
                <div style={styles.callIndicator}>
                  <span style={styles.callIndicatorDot}></span>
                </div>
              )}
            </div>
            <div style={styles.chatInfo}>
              <div style={styles.chatNameRow}>
                <span style={styles.chatName}>{displayName}</span>
                {isGroupChat && (
                  <span style={styles.groupBadge}>GROUP</span>
                )}
                {(hasIncomingCall || hasActiveGroupCall) && (
                  <span style={styles.callBadge}>📞</span>
                )}
              </div>
              <div style={styles.lastMessage}>
                {hasActiveGroupCall ? '🎥 Идет групповой звонок...' : (hasIncomingCall ? '🔔 Входящий звонок...' : lastMessageText)}
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
    padding: '16px 12px',
    scrollbarWidth: 'thin',
    scrollbarColor: '#6366f1 transparent',
  },
  label: {
    fontSize: '11px',
    color: '#718096',
    marginBottom: '16px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    padding: '0 8px',
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px',
    opacity: 0.5,
    filter: 'grayscale(1)',
  },
  emptyText: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#a0aec0',
    marginBottom: '8px',
  },
  emptyHint: {
    fontSize: '14px',
    color: '#718096',
    maxWidth: '240px',
    lineHeight: '1.5',
  },
  chatItem: {
    width: '100%',
    padding: '12px 14px',
    background: 'transparent',
    border: 'none',
    borderRadius: '14px',
    color: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
    marginBottom: '6px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    transform: 'translateX(0)',
  },
  chatItemActive: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    boxShadow: '0 4px 16px rgba(102, 126, 234, 0.4)',
    transform: 'translateX(4px)',
  },
  chatItemCalling: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '2px solid rgba(239, 68, 68, 0.4)',
    animation: 'pulse-call 1.5s infinite',
  },
  chatItemActiveCall: {
    background: 'rgba(168, 85, 247, 0.15)',
    border: '2px solid rgba(168, 85, 247, 0.4)',
    animation: 'pulse-group-call 1.5s infinite',
  },
  avatarWrapper: {
    position: 'relative',
    flexShrink: 0,
  },
  avatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '18px',
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
  },
  groupAvatar: {
    background: 'linear-gradient(135deg, #a855f7, #7e22ce)',
    fontSize: '20px',
  },
  callIndicator: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    width: '20px',
    height: '20px',
    background: '#ef4444',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '3px solid #1a1d29',
    animation: 'pulse-dot 1s infinite',
    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)',
  },
  callIndicatorDot: {
    width: '8px',
    height: '8px',
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
    gap: '8px',
    marginBottom: '4px',
  },
  chatName: {
    fontWeight: '600',
    fontSize: '15px',
    color: '#ffffff',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  callBadge: {
    fontSize: '14px',
    animation: 'shake 0.5s infinite',
    flexShrink: 0,
  },
  groupBadge: {
    fontSize: '10px',
    fontWeight: '700',
    background: 'rgba(168, 85, 247, 0.3)',
    padding: '3px 8px',
    borderRadius: '8px',
    color: '#c084fc',
    letterSpacing: '0.5px',
    flexShrink: 0,
  },
  lastMessage: {
    fontSize: '13px',
    color: '#a0aec0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: '1.4',
  },
};

// Добавляем анимации
if (typeof document !== 'undefined' && !document.getElementById('chatlist-animations')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'chatlist-animations';
  styleSheet.textContent = `
    @keyframes pulse-call {
      0%, 100% { 
        background: rgba(239, 68, 68, 0.15);
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
      }
      50% { 
        background: rgba(239, 68, 68, 0.25);
        box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
      }
    }
    @keyframes pulse-group-call {
      0%, 100% { 
        background: rgba(168, 85, 247, 0.15);
        box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4);
      }
      50% { 
        background: rgba(168, 85, 247, 0.25);
        box-shadow: 0 0 0 6px rgba(168, 85, 247, 0);
      }
    }
    @keyframes pulse-dot {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.2); }
    }
    @keyframes shake {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-15deg); }
      75% { transform: rotate(15deg); }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default ChatList;
