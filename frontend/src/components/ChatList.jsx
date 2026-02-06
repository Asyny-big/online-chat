import React from 'react';
import { resolveAssetUrl } from '../utils/resolveAssetUrl';

function ChatList({ chats, selectedChat, onSelectChat, incomingCallChatId }) {
  const chatList = Array.isArray(chats) ? chats : [];

  if (chatList.length === 0) {
    return (
      <div className="chat-list" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>💬</div>
        <div style={{ fontWeight: 600 }}>Нет чатов</div>
        <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Найдите кого-нибудь!</div>
      </div>
    );
  }

  return (
    <div className="chat-list">
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
        const avatarUrl = chat.displayAvatar;
        const isDefaultAvatar = typeof avatarUrl === 'string' && /avatar-default\.(png|jpg|jpeg|webp|svg)$/i.test(avatarUrl);
        const showAvatarImg = !!avatarUrl && typeof avatarUrl === 'string' && !isDefaultAvatar;

        return (
          <div
            key={chat._id}
            onClick={() => onSelectChat(chat)}
            className={`chat-item ${isActive ? 'active' : ''} ${hasIncomingCall ? 'calling' : ''}`}
          >
            <div className="chat-avatar-container">
              <div className="chat-avatar">
                {showAvatarImg ? (
                  <img alt="" src={resolveAssetUrl(avatarUrl)} />
                ) : (
                  initial
                )}
              </div>
              {(hasIncomingCall || hasActiveGroupCall) && (
                <div className={`status-indicator ${hasIncomingCall || hasActiveGroupCall ? 'status-call' : ''}`}></div>
              )}
            </div>

            <div className="chat-info">
              <div className="chat-name-row">
                <span className="chat-name">
                  {displayName}
                  {isGroupChat && <span className="badge-group">GROUP</span>}
                </span>
                {/* Time could go here */}
              </div>

              <div className="chat-preview">
                {hasActiveGroupCall
                  ? <span style={{ color: '#a78bfa' }}>📹 Групповой звонок</span>
                  : (hasIncomingCall
                    ? <span style={{ color: '#ef4444' }}>📞 Входящий звонок...</span>
                    : lastMessageText
                  )
                }
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ChatList;
