import React from 'react';
import { PhoneIcon } from './Icons';

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
          if (lastMsg.type === 'audio') lastMessageText = '🎤 Голосовое';
          else if (lastMsg.type === 'image') lastMessageText = '📷 Фото';
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
              <div style={{
                ...styles.avatar,
                ...(isActive ? styles.avatarActive : {}),
              }}>{initial}</div>
              {hasIncomingCall && (
                <div style={styles.callIndicator}>
                  <span style={styles.callIndicatorDot}></span>
                </div>
              )}
            </div>
            <div style={styles.chatInfo}>
              <div style={styles.chatNameRow}>
                <span style={{
                  ...styles.chatName,
                  ...(isActive ? styles.chatNameActive : {}),
                }}>{displayName}</span>
                {hasIncomingCall && (
                  <span style={styles.callBadge}>
                    <PhoneIcon size={14} color="#10b981" />
                  </span>
                )}
              </div>
              <div style={{
                ...styles.lastMessage,
                ...(hasIncomingCall ? styles.lastMessageCalling : {}),
              }}>
                {hasIncomingCall ? 'Входящий звонок...' : lastMessageText}
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
    padding: '12px 14px',
  },
  label: {
    fontSize: '11px',
    color: '#94a3b8',
    marginBottom: '14px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '0 6px',
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.6,
  },
  emptyText: {
    fontSize: '17px',
    fontWeight: '600',
    color: '#64748b',
    marginBottom: '8px',
  },
  emptyHint: {
    fontSize: '14px',
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: '1.5',
  },
  chatItem: {
    width: '100%',
    padding: '12px 14px',
    background: 'transparent',
    border: 'none',
    borderRadius: '14px',
    color: '#1e293b',
    cursor: 'pointer',
    textAlign: 'left',
    marginBottom: '4px',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  chatItemActive: {
    background: '#3b82f6',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
  },
  chatItemCalling: {
    background: 'rgba(16, 185, 129, 0.08)',
    border: '1.5px solid rgba(16, 185, 129, 0.25)',
    animation: 'pulse-call 1.5s infinite',
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
    fontWeight: '600',
    fontSize: '17px',
    color: '#fff',
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)',
  },
  avatarActive: {
    boxShadow: '0 2px 8px rgba(255, 255, 255, 0.3)',
  },
  callIndicator: {
    position: 'absolute',
    top: '-2px',
    right: '-2px',
    width: '18px',
    height: '18px',
    background: '#10b981',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2.5px solid #ffffff',
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
    gap: '8px',
    marginBottom: '4px',
  },
  chatName: {
    fontWeight: '600',
    fontSize: '15px',
    color: '#1e293b',
  },
  chatNameActive: {
    color: '#ffffff',
  },
  callBadge: {
    display: 'flex',
    alignItems: 'center',
    animation: 'shake 0.5s infinite',
  },
  lastMessage: {
    fontSize: '13px',
    color: '#64748b',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  lastMessageCalling: {
    color: '#10b981',
    fontWeight: '500',
  },
};

// Добавляем анимации
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes pulse-call {
      0%, 100% { 
        background: rgba(16, 185, 129, 0.08);
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.3);
      }
      50% { 
        background: rgba(16, 185, 129, 0.15);
        box-shadow: 0 0 0 4px rgba(16, 185, 129, 0);
      }
    }
    @keyframes pulse-dot {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.15); }
    }
    @keyframes shake {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-8deg); }
      75% { transform: rotate(8deg); }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default ChatList;
