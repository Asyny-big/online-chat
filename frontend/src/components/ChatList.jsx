import React from 'react';
import { resolveAssetUrl } from '@/shared/lib/resolveAssetUrl';

function getLastMessagePreview(lastMessage) {
  if (!lastMessage) return 'Нет сообщений';

  const type = String(lastMessage.type || 'text').trim().toLowerCase();
  if (type === 'audio' || type === 'voice') return '🎤 Голосовое сообщение';
  if (type === 'image') return '📷 Изображение';
  if (type === 'video') return '🎥 Видео';
  if (type === 'video_note') return '🎥 Видеокружок';
  if (type === 'file') return '📎 Файл';
  if (type === 'system') return lastMessage.text || 'Системное сообщение';
  return lastMessage.text || 'Сообщение';
}

function ChatList({ chats, selectedChat, onSelectChat, incomingCallChatId }) {
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
        const isOnline = !isGroupChat && String(chat.displayStatus || '').trim().toLowerCase() === 'online';
        const unreadCount = Math.max(0, Number(chat?.unreadCount || 0));
        const hasUnread = unreadCount > 0;
        const lastMessageText = hasActiveGroupCall
          ? '🎥 Идет групповой звонок...'
          : (hasIncomingCall ? '🔔 Входящий звонок...' : getLastMessagePreview(chat.lastMessage));

        const avatarUrl = chat.displayAvatar;
        const isDefaultAvatar = typeof avatarUrl === 'string' && /avatar-default\.(png|jpg|jpeg|webp|svg)$/i.test(avatarUrl);
        const showAvatarImg = !!avatarUrl && typeof avatarUrl === 'string' && !isDefaultAvatar;
        const initial = isGroupChat ? '👥' : displayName.charAt(0).toUpperCase();

        return (
          <button
            key={chat._id}
            type="button"
            onClick={() => onSelectChat(chat)}
            className={`chat-item ${isActive ? 'active' : ''} ${hasUnread ? 'unread' : ''} ${hasIncomingCall ? 'calling' : ''} ${hasActiveGroupCall ? 'active-group-call' : ''}`}
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
                {isGroupChat && <span className="group-badge">👥</span>}
                {(hasIncomingCall || hasActiveGroupCall) && <span className="call-badge">📞</span>}
                {hasUnread && (
                  <span className="unread-badge" aria-label={`${unreadCount} непрочитанных`}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>

              <div className={`chat-item-last-msg ${hasUnread ? 'unread' : ''}`}>
                {lastMessageText}
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

        .chat-item.unread:not(.active) {
            background: rgba(59, 130, 246, 0.12);
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
            min-width: 0;
        }

        .chat-item-name {
            font-weight: 600;
            font-size: 14px;
            color: var(--text-primary);
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .chat-item.unread .chat-item-name {
            font-weight: 800;
        }
        
        .chat-item.active .chat-item-name {
            color: white;
        }

        .presence-text {
            font-size: 11px;
            color: var(--text-muted);
            flex-shrink: 0;
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
            flex-shrink: 0;
        }

        .call-badge {
            font-size: 12px;
            animation: shake 0.5s infinite;
            flex-shrink: 0;
        }

        .unread-badge {
            margin-left: auto;
            min-width: 20px;
            height: 20px;
            padding: 0 6px;
            border-radius: 999px;
            background: #3b82f6;
            color: white;
            font-size: 11px;
            font-weight: 800;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .chat-item-last-msg {
            font-size: 12px;
            color: var(--text-muted);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .chat-item-last-msg.unread {
            color: var(--text-primary);
            font-weight: 700;
        }

        .chat-item.active .chat-item-last-msg {
            color: rgba(255, 255, 255, 0.8);
        }

        .chat-item.active .chat-item-last-msg.unread {
            color: white;
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
