import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import MessageInput from './MessageInput';
import { API_URL } from '../config';

function ChatWindow({
  token,
  chat,
  messages,
  socket,
  currentUserId,
  onStartCall,
  onStartGroupCall,
  typingUsers,
  incomingCall,
  incomingGroupCall,
  onAcceptCall,
  onDeclineCall,
  onAcceptGroupCall,
  onDeclineGroupCall,
  onBack,
  onDeleteMessage,
  onDeleteChat
}) {
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showDeleteChatModal, setShowDeleteChatModal] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setShowChatMenu(false);
    if (showChatMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showChatMenu]);

  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setAutoScroll(isNearBottom);
  };

  const handleConfirmDeleteChat = useCallback(() => {
    onDeleteChat?.();
    setShowDeleteChatModal(false);
  }, [onDeleteChat]);

  if (!chat) {
    return (
      <div className="chat-window empty-chat-state">
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>Выберите чат</div>
        <div style={{ fontSize: '0.9rem' }}>Или найдите пользователя по номеру телефона</div>
      </div>
    );
  }

  const displayName = chat.displayName || chat.name || 'Чат';
  const typingList = typingUsers?.filter(u => u.chatId === chat._id && u.userId !== currentUserId) || [];
  const isGroupChat = chat.type === 'group' || chat.isGroup === true;
  const participantCount = chat.participants?.length || 0;
  const hasIncomingCall = incomingCall && incomingCall.chatId === chat._id;
  const hasIncomingGroupCall = incomingGroupCall && incomingGroupCall.chatId === chat._id;

  return (
    <div className="chat-window">
      {/* Incoming Call Banner */}
      {hasIncomingCall && (
        <div className="call-banner incoming">
          <div className="call-banner-content" style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'white' }}>
            <div style={{ fontSize: '1.5rem' }}>{incomingCall.type === 'video' ? '📹' : '📞'}</div>
            <div>
              <div style={{ fontWeight: 700 }}>Входящий звонок</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>{incomingCall.initiator?.name || 'Пользователь'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => onDeclineCall?.(incomingCall.callId)} className="icon-btn" style={{ background: '#ef4444', color: 'white' }}>✕</button>
            <button onClick={() => onAcceptCall?.(incomingCall.callId, incomingCall.type)} className="icon-btn pulsing-btn" style={{ background: 'white', color: '#16a34a' }}>
              {incomingCall.type === 'video' ? '🎥' : '📞'}
            </button>
          </div>
        </div>
      )}

      {/* Incoming Group Call Banner */}
      {hasIncomingGroupCall && (
        <div className="call-banner group-incoming">
          <div className="call-banner-content" style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'white' }}>
            <div style={{ fontSize: '1.5rem' }}>{incomingGroupCall.type === 'video' ? '📹' : '📞'}</div>
            <div>
              <div style={{ fontWeight: 700 }}>Групповой звонок</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                {incomingGroupCall.initiator?.name || 'Участник'}
                {incomingGroupCall.participants?.length > 1 && ` • ${incomingGroupCall.participants.length} участников`}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => onDeclineGroupCall?.(incomingGroupCall.callId)} className="icon-btn" style={{ background: '#ef4444', color: 'white' }}>✕</button>
            <button onClick={() => onAcceptGroupCall?.(incomingGroupCall.callId, incomingGroupCall.type)} className="icon-btn pulsing-btn" style={{ background: 'white', color: '#7e22ce' }}>
              {incomingGroupCall.type === 'video' ? '🎥' : '📞'}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="chat-window-header">
        <div className="header-user-info">
          {isMobile && <button onClick={onBack} className="icon-btn">←</button>}

          <div className="header-avatar" style={isGroupChat ? { background: 'linear-gradient(135deg, #a855f7, #7e22ce)' } : {}}>
            {isGroupChat ? '👥' : displayName.charAt(0).toUpperCase()}
          </div>

          <div className="header-details">
            <h3>{displayName}</h3>
            <div className="header-status">
              {isGroupChat ? (
                <span>{participantCount} участников</span>
              ) : (
                <span style={{ color: 'var(--status-online)' }}>В сети</span>
              )}
              {typingList.length > 0 && <span className="typing-indicator"> • печатает...</span>}
            </div>
          </div>
        </div>

        <div className="header-actions">
          {!isGroupChat ? (
            <>
              <button onClick={() => onStartCall?.('audio')} className="icon-btn" title="Аудио">📞</button>
              <button onClick={() => onStartCall?.('video')} className="icon-btn" title="Видео">🎥</button>
            </>
          ) : (
            <>
              <button onClick={() => onStartGroupCall?.('audio')} className="icon-btn" title="Групповой аудио" style={{ color: '#a855f7' }}>📞</button>
              <button onClick={() => onStartGroupCall?.('video')} className="icon-btn" title="Групповой видео" style={{ color: '#a855f7' }}>🎥</button>
            </>
          )}

          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowChatMenu(!showChatMenu)} className="icon-btn">⋮</button>
            {showChatMenu && (
              <div className="chat-menu" style={{
                position: 'absolute', top: '120%', right: 0,
                background: '#1e293b', borderRadius: '12px', padding: '0.5rem',
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)', width: '180px', zIndex: 100
              }}>
                <button
                  onClick={() => { setShowChatMenu(false); setShowDeleteChatModal(true); }}
                  style={{
                    width: '100%', padding: '0.75rem', textAlign: 'left',
                    color: '#ef4444', background: 'transparent', display: 'flex', alignItems: 'center', gap: '8px'
                  }}
                >
                  🗑️ Удалить чат
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={containerRef} className="messages-container" onScroll={handleScroll}>
        {messages.length === 0 ? (
          <div className="empty-chat-state">
            <div style={{ fontSize: '2rem' }}>👋</div>
            <div style={{ marginTop: '1rem' }}>Начните общение</div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <MessageBubble
              key={msg._id || idx}
              message={msg}
              isMine={msg.sender?._id === currentUserId || msg.sender === currentUserId}
              token={token}
              onDelete={onDeleteMessage}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput chatId={chat._id} socket={socket} token={token} />

      {/* Delete Modal */}
      {showDeleteChatModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#1e293b', padding: '2rem', borderRadius: '16px',
            maxWidth: '400px', width: '90%', textAlign: 'center'
          }}>
            <h3>Удалить переписку?</h3>
            <p style={{ margin: '1rem 0', color: '#94a3b8' }}>Это действие нельзя отменить.</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => setShowDeleteChatModal(false)}
                style={{ padding: '0.75rem 1.5rem', background: '#334155', color: 'white', borderRadius: '8px' }}
              >
                Отмена
              </button>
              <button
                onClick={handleConfirmDeleteChat}
                style={{ padding: '0.75rem 1.5rem', background: '#ef4444', color: 'white', borderRadius: '8px' }}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message, isMine, onDelete, token }) {
  const [showMenu, setShowMenu] = useState(false);
  const { type: rawType = 'text', text, attachment, createdAt, sender } = message;

  const type = (() => {
    if (rawType !== 'file' && rawType !== 'text') return rawType;
    if (!attachment?.mimeType) return rawType;
    const mime = attachment.mimeType.toLowerCase();
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    return rawType;
  })();

  const time = createdAt ? new Date(createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
  const senderName = sender?.name || '';

  const getMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
    if (normalizedUrl.startsWith('/uploads/')) return `${API_URL}${normalizedUrl}`;
    if (normalizedUrl.startsWith('/api/uploads/')) {
      const baseUrl = API_URL.replace(/\/api\/?$/, '');
      return `${baseUrl}${normalizedUrl}`;
    }
    const baseUrl = API_URL.replace(/\/api\/?$/, '');
    return `${baseUrl}${normalizedUrl}`;
  };

  const renderContent = () => {
    const url = getMediaUrl(attachment?.url);
    switch (type) {
      case 'image':
        return (
          <div className="media-attachment">
            <img src={url} alt="attachment" onClick={() => window.open(url, '_blank')} />
            {text && <div style={{ marginTop: '0.5rem' }}>{text}</div>}
          </div>
        );
      case 'video':
        return (
          <div className="media-attachment">
            <video src={url} controls />
            {text && <div style={{ marginTop: '0.5rem' }}>{text}</div>}
          </div>
        );
      case 'audio':
        return (
          <div className="file-attachment">
            <span>🎤</span>
            <audio src={url} controls style={{ height: '32px', maxWidth: '200px' }} />
          </div>
        );
      case 'file':
        return (
          <a href={url} target="_blank" rel="noopener noreferrer" className="file-attachment">
            <span className="file-icon">📄</span>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {attachment?.originalName || 'Файл'}
              </div>
            </div>
          </a>
        );
      default:
        return <div>{text}</div>;
    }
  };

  return (
    <div className={`message-row ${isMine ? 'mine' : 'theirs'}`} onMouseLeave={() => setShowMenu(false)}>
      {!isMine && (
        <div className="message-actions">
          {/* Actions for other user (reply etc) could go here */}
        </div>
      )}

      <div className={`message-bubble ${isMine ? 'mine' : 'theirs'}`}>
        {!isMine && senderName && <span className="message-sender">{senderName}</span>}
        {renderContent()}
        <div className="message-time">
          {time}
        </div>
      </div>

      {isMine && (
        <div className="message-actions">
          <button
            onClick={() => onDelete && onDelete(message._id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
            title="Удалить"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
}

export default ChatWindow;
