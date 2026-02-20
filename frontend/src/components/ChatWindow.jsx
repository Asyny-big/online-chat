import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import MessageInput from './MessageInput';
import { API_URL } from '@/config';

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
      <div className="chat-window-empty">
        <div className="empty-icon">💬</div>
        <div className="empty-text">Выберите чат</div>
        <div className="empty-hint">
          Или найдите пользователя по номеру телефона
        </div>
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
    <div className="chat-window-container">
      {/* Incoming Call Banner */}
      {hasIncomingCall && (
        <div className="incoming-call-banner">
          <div className="call-banner-content">
            <div className="call-banner-icon">
              {incomingCall.type === 'video' ? '📹' : '📞'}
            </div>
            <div className="call-banner-info">
              <div className="call-banner-title">Входящий звонок</div>
              <div className="call-banner-subtitle">
                {incomingCall.initiator?.name || 'Пользователь'} звонит вам
              </div>
            </div>
          </div>
          <div className="call-banner-actions">
            <button
              onClick={() => onDeclineCall?.(incomingCall.callId)}
              className="call-banner-btn decline"
              title="Отклонить"
            >
              ✕
            </button>
            <button
              onClick={() => onAcceptCall?.(incomingCall.callId, incomingCall.type)}
              className="call-banner-btn accept"
              title="Принять"
            >
              {incomingCall.type === 'video' ? '🎥' : '📞'}
            </button>
          </div>
        </div>
      )}

      {/* Incoming Group Call Banner */}
      {hasIncomingGroupCall && (
        <div className="incoming-group-call-banner">
          <div className="call-banner-content">
            <div className="call-banner-icon">
              {incomingGroupCall.type === 'video' ? '📹' : '📞'}
            </div>
            <div className="call-banner-info">
              <div className="call-banner-title">Групповой звонок</div>
              <div className="call-banner-subtitle">
                {incomingGroupCall.initiator?.name || 'Участник'} начал звонок
                {incomingGroupCall.participants?.length > 1 &&
                  ` • ${incomingGroupCall.participants.length} участников`
                }
              </div>
            </div>
          </div>
          <div className="call-banner-actions">
            <button
              onClick={() => onDeclineGroupCall?.(incomingGroupCall.callId)}
              className="call-banner-btn decline"
              title="Отклонить"
            >
              ✕
            </button>
            <button
              onClick={() => onAcceptGroupCall?.(incomingGroupCall.callId, incomingGroupCall.type)}
              className="call-banner-btn accept"
              title="Присоединиться"
            >
              {incomingGroupCall.type === 'video' ? '🎥' : '📞'}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="chat-header">
        <div className="header-info">
          {isMobile && (
            <button onClick={onBack} className="back-btn" title="Назад к чатам">
              ←
            </button>
          )}
          <div className={`chat-avatar ${isGroupChat ? 'group' : ''}`}>
            {isGroupChat ? '👥' : displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="chat-name">{displayName}</h3>
            {isGroupChat && (
              <div className="participant-count">
                {participantCount} участников
              </div>
            )}
            {typingList.length > 0 && (
              <div className="typing-indicator">
                печатает<span className="typing-dots">...</span>
              </div>
            )}
          </div>
        </div>
        <div className="header-actions">
          {!isGroupChat && (
            <>
              <button onClick={() => onStartCall?.('audio')} className="header-action-btn" title="Аудиозвонок">
                📞
              </button>
              <button onClick={() => onStartCall?.('video')} className="header-action-btn" title="Видеозвонок">
                🎥
              </button>
            </>
          )}
          {isGroupChat && (
            <>
              <button onClick={() => onStartGroupCall?.('audio')} className="header-action-btn group" title="Групповой аудиозвонок">
                📞
                <span className="group-call-badge">👥</span>
              </button>
              <button onClick={() => onStartGroupCall?.('video')} className="header-action-btn group" title="Групповой видеозвонок">
                🎥
                <span className="group-call-badge">👥</span>
              </button>
            </>
          )}
          <div className="menu-container">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowChatMenu(!showChatMenu);
              }}
              className="header-action-btn"
              title="Меню"
            >
              ⋮
            </button>
            {showChatMenu && (
              <div className="chat-menu">
                <button
                  onClick={() => {
                    setShowChatMenu(false);
                    setShowDeleteChatModal(true);
                  }}
                  className="chat-menu-item"
                >
                  🗑️ Удалить чат
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div
        ref={containerRef}
        className="messages-container"
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="no-messages">
            <span className="no-messages-icon">👋</span>
            <span>Начните общение</span>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMine = msg.sender?._id === currentUserId || msg.sender === currentUserId;
            return (
              <MessageBubble
                key={msg._id || idx}
                message={msg}
                isMine={isMine}
                token={token}
                onDelete={isMine ? () => onDeleteMessage?.(msg._id) : null}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput
        chatId={chat._id}
        socket={socket}
        token={token}
      />

      {/* Delete Chat Modal */}
      {showDeleteChatModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">⚠️</div>
            <h3 className="modal-title">Удалить чат?</h3>
            <p className="modal-text">
              Вы уверены, что хотите удалить этот чат?
              <br /><br />
              <strong>Внимание:</strong> Все сообщения, изображения, видео и файлы будут удалены безвозвратно у всех участников.
            </p>
            <div className="modal-actions">
              <button onClick={() => setShowDeleteChatModal(false)} className="modal-btn cancel">
                Отмена
              </button>
              <button onClick={handleConfirmDeleteChat} className="modal-btn delete">
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .chat-window-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            background-color: var(--bg-primary);
            height: 100%;
            min-height: 0;
            position: relative;
        }

        .chat-window-empty {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background-color: var(--bg-primary);
            color: var(--text-muted);
        }

        .empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.5; }
        .empty-text { font-size: 20px; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px; }
        .empty-hint { font-size: 14px; color: var(--text-muted); }

        /* Banners */
        .incoming-call-banner, .incoming-group-call-banner {
            padding: 12px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            animation: slideDown 0.3s ease, pulse-banner 1.5s infinite;
            position: absolute;
            top: 70px;
            left: 20px;
            right: 20px;
            z-index: 50;
            border-radius: 12px;
            color: white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        
        .incoming-call-banner { background: linear-gradient(135deg, #22c55e, #16a34a); }
        .incoming-group-call-banner { background: linear-gradient(135deg, #a855f7, #7e22ce); }

        .call-banner-content { display: flex; align-items: center; gap: 12px; }
        .call-banner-icon { fontSize: 24px; animation: shake 0.5s infinite; }
        .call-banner-info { display: flex; flex-direction: column; }
        .call-banner-title { font-weight: 700; font-size: 14px; }
        .call-banner-subtitle { font-size: 12px; opacity: 0.9; }
        .call-banner-actions { display: flex; gap: 8px; }

        .call-banner-btn {
            width: 40px; height: 40px; border-radius: 50%; border: none;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; transition: transform 0.2s; color: white;
        }
        .call-banner-btn.decline { background: rgba(255,255,255,0.2); font-size: 16px; }
        .call-banner-btn.decline:hover { background: #ef4444; }
        .call-banner-btn.accept { background: rgba(255,255,255,0.2); font-size: 18px; animation: pulse-btn 1s infinite; }
        .call-banner-btn.accept:hover { background: #22c55e; }

        /* Header */
        .chat-header {
            padding: 12px 16px;
            border-bottom: 1px solid var(--border-color);
            background-color: var(--bg-surface);
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 64px;
            flex-shrink: 0;
        }

        .header-info { display: flex; align-items: center; gap: 12px; }
        
        .back-btn {
            width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
            background: transparent; border: none; border-radius: 50%;
            font-size: 20px; color: var(--text-primary); cursor: pointer; margin-right: 8px;
        }

        .chat-avatar {
            width: 40px; height: 40px; border-radius: 50%;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            display: flex; align-items: center; justify-content: center;
            color: white; font-weight: 700; font-size: 16px; flex-shrink: 0;
        }
        .chat-avatar.group { background: linear-gradient(135deg, #a855f7, #7e22ce); }

        .chat-name { margin: 0; fontSize: 16px; font-weight: 700; color: var(--text-primary); }
        .participant-count { fontSize: 12px; color: var(--text-secondary); margin-top: 2px; }
        .typing-indicator { fontSize: 12px; color: var(--accent); margin-top: 2px; }
        .typing-dots { animation: blink 1s infinite; }

        .header-actions { display: flex; gap: 8px; align-items: center; }

        .header-action-btn {
            width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
            background: transparent; border: 1px solid var(--border-light); border-radius: 50%;
            font-size: 18px; cursor: pointer; transition: var(--transition-fast); color: var(--text-secondary);
            position: relative;
        }
        .header-action-btn:hover { background-color: var(--bg-hover); color: var(--text-primary); }
        .header-action-btn.group { color: var(--accent); border-color: var(--accent); }
        .header-action-btn.group:hover { background-color: rgba(168, 85, 247, 0.1); }

        .group-call-badge { position: absolute; fontSize: 10px; bottom: -2px; right: -2px; }

        /* Menu */
        .menu-container { position: relative; }
        .chat-menu {
            position: absolute; top: 100%; right: 0; margin-top: 8px;
            background-color: var(--bg-card); border-radius: 12px;
            box-shadow: var(--shadow-lg); overflow: hidden; z-index: 100;
            min-width: 160px; border: 1px solid var(--border-light);
        }
        .chat-menu-item {
            width: 100%; padding: 12px 16px; background: transparent; border: none;
            color: var(--danger); fontSize: 14px; textAlign: left; cursor: pointer;
            display: flex; align-items: center; gap: 8px; transition: var(--transition-fast);
        }
        .chat-menu-item:hover { background-color: var(--bg-surface); }

        /* Messages */
        .messages-container {
            flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px;
            background-color: var(--bg-primary);
        }
        .no-messages {
            flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
            color: var(--text-muted); gap: 8px;
        }
        .no-messages-icon { fontSize: 32px; opacity: 0.5; }

        /* Message Bubble */
        .message-row { display: flex; width: 100%; margin-bottom: 2px; }
        .message-bubble {
            max-width: 75%; padding: 10px 14px; border-radius: 18px; word-wrap: break-word;
            position: relative; box-shadow: var(--shadow-sm);
        }
        .message-bubble.mine {
            background: linear-gradient(135deg, #3b82f6, #2563eb); color: white;
            border-bottom-right-radius: 4px;
        }
        .message-bubble.theirs {
            background-color: var(--bg-card); color: var(--text-primary);
            border-bottom-left-radius: 4px; border: 1px solid var(--border-light);
        }

        .sender-name { font-size: 12px; font-weight: 700; color: var(--accent); margin-bottom: 4px; }
        .text-content { font-size: 15px; line-height: 1.5; white-space: pre-wrap; }
        
        .message-time {
            font-size: 10px; margin-top: 4px; opacity: 0.7;
            display: flex; align-items: center; gap: 8px;
        }
        
        /* Media */
        .media-wrapper { max-width: 280px; border-radius: 12px; overflow: hidden; margin-top: 4px; }
        .image-preview { width: 100%; height: auto; display: block; cursor: pointer; }
        .video-preview { width: 100%; height: auto; display: block; border-radius: 12px; }
        .media-caption { margin-top: 6px; font-size: 14px; }

        .audio-wrapper { display: flex; align-items: center; gap: 8px; min-width: 200px; padding: 4px 0; }
        .audio-icon { font-size: 20px; }
        .audio-player { height: 36px; flex: 1; outline: none; }

        /* File */
        .file-link {
            display: flex; align-items: center; gap: 10px; padding: 10px;
            background: rgba(0,0,0,0.1); border: none; border-radius: 12px;
            text-decoration: none; color: inherit; cursor: pointer;
            width: 100%; text-align: left;
        }
        .message-bubble.theirs .file-link { background: var(--bg-surface); }
        
        .file-icon { font-size: 24px; }
        .file-info { overflow: hidden; flex: 1; }
        .file-name { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .file-size { font-size: 11px; opacity: 0.8; }
        .download-icon { font-size: 16px; opacity: 0.8; }

        /* Controls */
        .delete-msg-btn {
            background: transparent; border: none; fontSize: 12px; cursor: pointer;
            opacity: 0.5; padding: 0; color: inherit;
        }
        .delete-msg-btn:hover { opacity: 1; }

        /* Modal */
        .modal-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); backdrop-filter: blur(2px);
            display: flex; align-items: center; justify-content: center; z-index: 10000;
        }
        .modal-card {
            background-color: var(--bg-card); border-radius: var(--radius-card); padding: 24px;
            max-width: 360px; width: 90%; textAlign: center; border: 1px solid var(--border-light);
            box-shadow: var(--shadow-xl);
        }
        .modal-icon { fontSize: 48px; margin-bottom: 16px; }
        .modal-title { font-size: 20px; font-weight: 700; margin-bottom: 12px; color: var(--text-primary); }
        .modal-text { font-size: 14px; line-height: 1.5; margin-bottom: 24px; color: var(--text-secondary); }
        
        .modal-actions { display: flex; gap: 12px; justify-content: center; }
        .modal-btn { padding: 10px 20px; border-radius: 8px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: var(--transition-fast); }
        .modal-btn.cancel { background-color: var(--bg-surface); color: var(--text-primary); }
        .modal-btn.cancel:hover { background-color: var(--bg-hover); }
        .modal-btn.delete { background-color: var(--danger); color: white; }
        .modal-btn.delete:hover { opacity: 0.9; }

        .message-context-menu {
            position: absolute; top: 100%; right: 0; margin-top: 4px;
            background-color: var(--bg-card); border-radius: 8px;
            box-shadow: var(--shadow-lg); overflow: hidden; z-index: 100;
            border: 1px solid var(--border-light);
        }
        .context-menu-item {
            padding: 10px 16px; background: transparent; border: none;
            color: var(--danger); fontSize: 13px; cursor: pointer;
            display: flex; align-items: center; gap: 8px; white-space: nowrap;
        }
        .context-menu-item:hover { background-color: var(--bg-surface); }

        .delete-confirm-popup {
            position: absolute; bottom: 100%; right: 0; margin-bottom: 8px;
            background-color: var(--bg-card); border-radius: 12px; padding: 12px;
            box-shadow: var(--shadow-lg); z-index: 100; min-width: 180px;
            border: 1px solid var(--border-light);
        }
        .delete-confirm-text { color: var(--text-primary); fontSize: 13px; margin-bottom: 12px; text-align: center; }
        .delete-confirm-actions { display: flex; gap: 8px; justify-content: center; }
        .delete-confirm-cancel { padding: 6px 12px; background: var(--bg-surface); border: none; borderRadius: 6px; color: var(--text-primary); fontSize: 12px; cursor: pointer; }
        .delete-confirm-yes { padding: 6px 12px; background: var(--danger); border: none; borderRadius: 6px; color: white; fontSize: 12px; cursor: pointer; }
        
        @keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes pulse-banner {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); } 50% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
        }
        @keyframes pulse-btn { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
        @keyframes shake { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-15deg); } 75% { transform: rotate(15deg); } }
      `}</style>
    </div>
  );
}

function MessageBubble({ message, isMine, onDelete, token }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  const time = createdAt
    ? new Date(createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : '';

  const senderName = sender?.name || '';

  const getMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
    if (normalizedUrl.startsWith('/uploads/')) return `${API_URL}${normalizedUrl}`;
    if (normalizedUrl.startsWith('/api/uploads/')) return `${API_URL.replace(/\/api\/?$/, '')}${normalizedUrl}`;
    return `${API_URL.replace(/\/api\/?$/, '')}${normalizedUrl}`;
  };

  const normalizeFilename = (name) => {
    if (!name) return '';
    const hasCyrillic = /[\u0400-\u04FF]/.test(name);
    const looksLikeMojibake = /[ÐÑÃ]/.test(name) && !hasCyrillic;
    if (!looksLikeMojibake) return name;
    try {
      const bytes = Uint8Array.from(name, (ch) => ch.charCodeAt(0) & 0xff);
      const decoded = new TextDecoder('utf-8').decode(bytes);
      if (/[\u0400-\u04FF]/.test(decoded)) return decoded;
      return name;
    } catch (_) { return name; }
  };

  const displayOriginalName = normalizeFilename(attachment?.originalName) || 'Файл';

  const downloadAttachment = async () => {
    try {
      const url = attachment?.url;
      if (!url) return;
      const filename = url.split('/').pop();
      if (!filename) return;
      const downloadUrl = `${API_URL}/download/${filename}?name=${encodeURIComponent(attachment?.originalName || 'file')}`;
      const res = await axios.get(downloadUrl, { responseType: 'blob', headers: { Authorization: `Bearer ${token || ''}` } });

      const contentType = String(res.headers?.['content-type'] || '');
      if (contentType.includes('application/json')) {
        const text = await res.data.text();
        alert('Не удалось скачать файл');
        return;
      }

      const blob = res.data;
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = displayOriginalName || 'file';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error('Download error:', e);
      alert('Не удалось скачать файл');
    }
  };

  const renderContent = () => {
    switch (type) {
      case 'image':
        return (
          <div className="media-wrapper">
            <img
              src={getMediaUrl(attachment?.url)}
              alt={attachment?.originalName || 'Изображение'}
              className="image-preview"
              onClick={() => window.open(getMediaUrl(attachment?.url), '_blank')}
            />
            {text && <div className="media-caption">{text}</div>}
          </div>
        );
      case 'video':
        return (
          <div className="media-wrapper">
            <video
              src={getMediaUrl(attachment?.url)}
              controls
              preload="metadata"
              className="videoPreview" // Keeping inline style for now or add class
              style={{ width: '100%', height: 'auto', borderRadius: '12px' }}
            />
            {text && <div className="media-caption">{text}</div>}
          </div>
        );
      case 'audio':
        const audioUrl = getMediaUrl(attachment?.url);
        const audioMimeType = attachment?.mimeType || 'audio/webm';
        return (
          <div className="audio-wrapper">
            <span className="audio-icon">🎤</span>
            <audio controls preload="auto" className="audio-player">
              <source src={audioUrl} type={audioMimeType} />
              Ваш браузер не поддерживает аудио
            </audio>
          </div>
        );
      case 'file':
        return (
          <button type="button" onClick={downloadAttachment} className="file-link">
            <span className="file-icon">📄</span>
            <div className="file-info">
              <div className="file-name">{displayOriginalName}</div>
              <div className="file-size">{attachment?.size ? formatFileSize(attachment.size) : ''}</div>
            </div>
            <span className="download-icon">⬇️</span>
          </button>
        );
      default:
        return <div className="text-content">{text}</div>;
    }
  };

  return (
    <div className={`message-row ${isMine ? 'mine' : 'theirs'}`} style={{ justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
      <div
        className={`message-bubble ${isMine ? 'mine' : 'theirs'}`}
        onContextMenu={(e) => {
          if (onDelete) {
            e.preventDefault();
            setShowMenu(true);
          }
        }}
        onClick={() => setShowMenu(false)}
      >
        {!isMine && senderName && <div className="sender-name">{senderName}</div>}
        {renderContent()}
        <div className="message-time">
          {time}
          {isMine && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
              className="delete-msg-btn"
              title="Удалить сообщение"
            >
              🗑️
            </button>
          )}
        </div>

        {showMenu && onDelete && (
          <div className="message-context-menu">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                setShowDeleteConfirm(true);
              }}
              className="context-menu-item"
            >
              🗑️ Удалить
            </button>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="delete-confirm-popup">
            <div className="delete-confirm-text">Удалить сообщение?</div>
            <div className="delete-confirm-actions">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(false);
                }}
                className="delete-confirm-cancel"
              >
                Отмена
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                  setShowDeleteConfirm(false);
                }}
                className="delete-confirm-yes"
              >
                Удалить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}

export default ChatWindow;
