import React from 'react';
import { resolveAssetUrl } from '@/shared/lib/resolveAssetUrl';

function ChatList({ chats, selectedChat, onSelectChat, incomingCallChatId }) {
  // Защита от неправильного типа данных
  const chatList = Array.isArray(chats) ? chats : [];

  if (chatList.length === 0) {
    return (
      <div className="chat-list-empty">
        <div className="empty-icon">💬</div>
        <div className="empty-text">Нет чатов</div>
        <div className="empty-hint">
          Найдите пользователя по номеру телефона
        </div>
      </div>
    );
  }

  return (
    <div className="chat-list-container">
      <div className="chat-list-label">Чаты</div>
      {chatList.map((chat) => {
        const isActive = selectedChat?._id === chat._id;
        const hasIncomingCall = incomingCallChatId === chat._id;
        const isGroupChat = chat.type === 'group' || chat.isGroup === true;
        const hasActiveGroupCall = chat.activeGroupCall !== null && chat.activeGroupCall !== undefined;
        const displayName = chat.displayName || chat.name || 'Чат';
        const lastMsg = chat.lastMessage;
        const isOnline = !isGroupChat && String(chat.displayStatus || '').trim().toLowerCase() === 'online';

        let lastMessageText = 'Нет сообщений';
        if (lastMsg) {
          if (lastMsg.type === 'audio') lastMessageText = '🎤 Голосовое сообщение';
          else if (lastMsg.type === 'image') lastMessageText = '📷 Изображение';
          else if (lastMsg.type === 'video') lastMessageText = '🎥 Видео';
          else if (lastMsg.type === 'file') lastMessageText = '📎 Файл';
          else lastMessageText = lastMsg.text || 'Сообщение';
        }

        const initial = isGroupChat ? '👥' : displayName.charAt(0).toUpperCase();

        const avatarUrl = chat.displayAvatar; // private: аватар собеседника, group: аватар группы
        const isDefaultAvatar = typeof avatarUrl === 'string' && /avatar-default\.(png|jpg|jpeg|webp|svg)$/i.test(avatarUrl);
        const showAvatarImg = !!avatarUrl && typeof avatarUrl === 'string' && !isDefaultAvatar;

        return (
          <button
            key={chat._id}
            onClick={() => onSelectChat(chat)}
            className={`chat-item ${isActive ? 'active' : ''} ${hasIncomingCall ? 'calling' : ''} ${hasActiveGroupCall ? 'active-group-call' : ''}`}
          >
            <div className="chat-item-avatar-wrap">
              <div className={`chat-item-avatar ${isGroupChat ? 'group' : ''}`}>
                {showAvatarImg ? (
                  <img alt="" src={resolveAssetUrl(avatarUrl)} className="chat-avatar-img" />
                ) : (
                  initial
                )}
              </div>
              {!isGroupChat && (
                <div className={`presence-badge ${isOnline ? 'online' : 'offline'}`} aria-hidden="true" />
              )}
              {(hasIncomingCall || hasActiveGroupCall) && (
                <div className="call-indicator-badge">
                  <span className="indicator-dot"></span>
                </div>
              )}
            </div>
            <div className="chat-item-info">
              <div className="chat-item-row">
                <span className="chat-item-name">{displayName}</span>
                {!isGroupChat && (
                  <span className={`presence-text ${isOnline ? 'online' : 'offline'}`}>
                    {isOnline ? 'в сети' : 'не в сети'}
                  </span>
                )}
                {isGroupChat && (
                  <span className="group-badge">👥</span>
                )}
                {(hasIncomingCall || hasActiveGroupCall) && (
                  <span className="call-badge">📞</span>
                )}
              </div>
              <div className="chat-item-last-msg">
                {hasActiveGroupCall ? '🎥 Идет групповой звонок...' : (hasIncomingCall ? '🔔 Входящий звонок...' : lastMessageText)}
              </div>
            </div>
          </button>
        );
      })}

      <style>{`
        .chat-list-container {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
        }

        .chat-list-empty {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 32px;
            color: var(--text-muted);
        }

        .empty-icon {
            font-size: 40px;
            margin-bottom: 12px;
            opacity: 0.5;
        }

        .empty-text {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 6px;
        }

        .empty-hint {
            font-size: 13px;
            text-align: center;
            color: var(--text-secondary);
        }

        .chat-list-label {
            font-size: 11px;
            color: var(--text-secondary);
            margin-bottom: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 0 4px;
        }

        .chat-item {
            width: 100%;
            padding: 10px 12px;
            background: transparent;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            text-align: left;
            margin-bottom: 4px;
            transition: var(--transition-fast);
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .chat-item:hover {
            background-color: var(--bg-hover);
        }

        .chat-item.active {
            background: var(--accent);
        }

        .chat-item.calling {
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid rgba(239, 68, 68, 0.3);
            animation: pulse-call 1.5s infinite;
        }

        .chat-item.active-group-call {
            background: rgba(168, 85, 247, 0.15);
            border: 1px solid rgba(168, 85, 247, 0.3);
            animation: pulse-group-call 1.5s infinite;
        }

        .chat-item-avatar-wrap {
            position: relative;
            flex-shrink: 0;
        }

        .chat-item-avatar {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 16px;
            color: white;
            overflow: hidden;
        }

        .chat-item-avatar.group {
            background: linear-gradient(135deg, #a855f7, #7e22ce);
            font-size: 18px;
        }

        .chat-avatar-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .call-indicator-badge {
            position: absolute;
            top: -2px;
            right: -2px;
            width: 16px;
            height: 16px;
            background: var(--danger);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid var(--bg-secondary);
            animation: pulse-dot 1s infinite;
        }

        .presence-badge {
            position: absolute;
            right: -1px;
            bottom: -1px;
            width: 13px;
            height: 13px;
            border-radius: 50%;
            border: 2px solid var(--bg-secondary);
            background: rgba(148, 163, 184, 0.9);
        }

        .presence-badge.online {
            background: #22c55e;
        }

        .indicator-dot {
            width: 6px;
            height: 6px;
            background: white;
            border-radius: 50%;
        }

        .chat-item-info {
            flex: 1;
            min-width: 0;
        }

        .chat-item-row {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 2px;
        }

        .chat-item-name {
            font-weight: 600;
            font-size: 14px;
            color: var(--text-primary);
        }
        
        .chat-item.active .chat-item-name {
            color: white;
        }

        .presence-text {
            font-size: 11px;
            color: var(--text-muted);
        }

        .presence-text.online {
            color: #4ade80;
        }

        .chat-item.active .presence-text {
            color: rgba(255, 255, 255, 0.8);
        }

        .group-badge {
            font-size: 11px;
            background: rgba(168, 85, 247, 0.3);
            padding: 2px 6px;
            border-radius: 4px;
            color: #d8b4fe;
        }

        .call-badge {
            font-size: 12px;
            animation: shake 0.5s infinite;
        }

        .chat-item-last-msg {
            font-size: 12px;
            color: var(--text-muted);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .chat-item.active .chat-item-last-msg {
            color: rgba(255, 255, 255, 0.8);
        }

        @keyframes pulse-call {
            0%, 100% { background: rgba(239, 68, 68, 0.15); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
            50% { background: rgba(239, 68, 68, 0.25); box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
        }
        @keyframes pulse-group-call {
            0%, 100% { background: rgba(168, 85, 247, 0.15); box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4); }
            50% { background: rgba(168, 85, 247, 0.25); box-shadow: 0 0 0 4px rgba(168, 85, 247, 0); }
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
      `}</style>
    </div>
  );
}

export default ChatList;
