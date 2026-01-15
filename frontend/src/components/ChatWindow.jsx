import React, { useEffect, useRef, useState, useCallback } from 'react';
import MessageInput from './MessageInput';
import { API_URL } from '../config';

function ChatWindow({ 
  token, 
  chat, 
  messages, 
  socket, 
  currentUserId, 
  onStartCall, 
  onStartGroupCall,  // Новый пропс для групповых звонков
  typingUsers, 
  incomingCall,
  incomingGroupCall,  // Новый пропс для входящего группового звонка 
  onAcceptCall, 
  onDeclineCall, 
  onAcceptGroupCall,  // Новый пропс
  onDeclineGroupCall, // Новый пропс
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

  // Отслеживание размера экрана
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = () => setShowChatMenu(false);
    if (showChatMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showChatMenu]);

  // Auto-scroll при новых сообщениях
  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Определение необходимости auto-scroll
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setAutoScroll(isNearBottom);
  };

  // Подтверждение удаления чата
  const handleConfirmDeleteChat = useCallback(() => {
    onDeleteChat?.();
    setShowDeleteChatModal(false);
  }, [onDeleteChat]);

  if (!chat) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>💬</div>
        <div style={styles.emptyText}>Выберите чат</div>
        <div style={styles.emptyHint}>
          Или найдите пользователя по номеру телефона
        </div>
      </div>
    );
  }

  const displayName = chat.displayName || chat.name || 'Чат';
  const typingList = typingUsers?.filter(u => u.chatId === chat._id && u.userId !== currentUserId) || [];
  
  // Проверяем, групповой ли это чат
  const isGroupChat = chat.type === 'group' || chat.isGroup === true;
  const participantCount = chat.participants?.length || 0;
  
  // Проверяем есть ли входящий звонок для этого чата
  const hasIncomingCall = incomingCall && incomingCall.chatId === chat._id;
  
  // Проверяем есть ли входящий групповой звонок для этого чата
  const hasIncomingGroupCall = incomingGroupCall && incomingGroupCall.chatId === chat._id;

  return (
    <div style={styles.container}>
      {/* Всплывающее уведомление о входящем звонке */}
      {hasIncomingCall && (
        <div style={styles.incomingCallBanner}>
          <div style={styles.callBannerContent}>
            <div style={styles.callBannerIcon}>
              {incomingCall.type === 'video' ? '📹' : '📞'}
            </div>
            <div style={styles.callBannerInfo}>
              <div style={styles.callBannerTitle}>Входящий звонок</div>
              <div style={styles.callBannerSubtitle}>
                {incomingCall.initiator?.name || 'Пользователь'} звонит вам
              </div>
            </div>
          </div>
          <div style={styles.callBannerActions}>
            <button 
              onClick={() => onDeclineCall?.(incomingCall.callId)}
              style={styles.callBannerDecline}
              title="Отклонить"
            >
              ✕
            </button>
            <button 
              onClick={() => onAcceptCall?.(incomingCall.callId, incomingCall.type)}
              style={styles.callBannerAccept}
              title="Принять"
            >
              {incomingCall.type === 'video' ? '🎥' : '📞'}
            </button>
          </div>
        </div>
      )}

      {/* Всплывающее уведомление о входящем групповом звонке */}
      {hasIncomingGroupCall && (
        <div style={styles.incomingGroupCallBanner}>
          <div style={styles.callBannerContent}>
            <div style={styles.callBannerIcon}>
              {incomingGroupCall.type === 'video' ? '📹' : '📞'}
            </div>
            <div style={styles.callBannerInfo}>
              <div style={styles.callBannerTitle}>Групповой звонок</div>
              <div style={styles.callBannerSubtitle}>
                {incomingGroupCall.initiator?.name || 'Участник'} начал звонок
                {incomingGroupCall.participants?.length > 1 && 
                  ` • ${incomingGroupCall.participants.length} участников`
                }
              </div>
            </div>
          </div>
          <div style={styles.callBannerActions}>
            <button 
              onClick={() => onDeclineGroupCall?.(incomingGroupCall.callId)}
              style={styles.callBannerDecline}
              title="Отклонить"
            >
              ✕
            </button>
            <button 
              onClick={() => onAcceptGroupCall?.(incomingGroupCall.callId, incomingGroupCall.type)}
              style={styles.callBannerAccept}
              title="Присоединиться"
            >
              {incomingGroupCall.type === 'video' ? '🎥' : '📞'}
            </button>
          </div>
        </div>
      )}
      
      {/* Шапка с кнопками звонков */}
      <div style={styles.header}>
        <div style={styles.headerInfo}>
          {/* Кнопка назад для мобильных */}
          {isMobile && (
            <button
              onClick={onBack}
              style={styles.backBtn}
              title="Назад к чатам"
            >
              ←
            </button>
          )}
          <div style={{
            ...styles.avatar,
            ...(isGroupChat ? styles.groupAvatar : {})
          }}>
            {isGroupChat ? '👥' : displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 style={styles.chatName}>{displayName}</h3>
            {isGroupChat && (
              <div style={styles.participantCount}>
                {participantCount} участников
              </div>
            )}
            {typingList.length > 0 && (
              <div style={styles.typingIndicator}>
                печатает<span style={styles.typingDots}>...</span>
              </div>
            )}
          </div>
        </div>
        <div style={styles.headerActions}>
          {/* Кнопки для личных чатов */}
          {!isGroupChat && (
            <>
              <button
                onClick={() => onStartCall?.('audio')}
                style={styles.callBtn}
                title="Аудиозвонок"
              >
                📞
              </button>
              <button
                onClick={() => onStartCall?.('video')}
                style={styles.callBtn}
                title="Видеозвонок"
              >
                🎥
              </button>
            </>
          )}
          {/* Кнопки для групповых чатов */}
          {isGroupChat && (
            <>
              <button
                onClick={() => onStartGroupCall?.('audio')}
                style={styles.groupCallBtn}
                title="Групповой аудиозвонок"
              >
                📞
                <span style={styles.groupCallBadge}>👥</span>
              </button>
              <button
                onClick={() => onStartGroupCall?.('video')}
                style={styles.groupCallBtn}
                title="Групповой видеозвонок"
              >
                🎥
                <span style={styles.groupCallBadge}>👥</span>
              </button>
            </>
          )}
          {/* Меню чата */}
          <div style={styles.menuContainer}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowChatMenu(!showChatMenu);
              }}
              style={styles.callBtn}
              title="Меню"
            >
              ⋮
            </button>
            {showChatMenu && (
              <div style={styles.chatMenu}>
                <button
                  onClick={() => {
                    setShowChatMenu(false);
                    setShowDeleteChatModal(true);
                  }}
                  style={styles.menuItem}
                >
                  🗑️ Удалить чат
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Список сообщений */}
      <div
        ref={containerRef}
        style={styles.messagesContainer}
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div style={styles.noMessages}>
            <span style={styles.noMessagesIcon}>👋</span>
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
                onDelete={isMine ? () => onDeleteMessage?.(msg._id) : null}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Поле ввода */}
      <MessageInput
        chatId={chat._id}
        socket={socket}
        token={token}
      />

      {/* Модальное окно подтверждения удаления чата */}
      {showDeleteChatModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalIcon}>⚠️</div>
            <h3 style={styles.modalTitle}>Удалить чат?</h3>
            <p style={styles.modalText}>
              Вы уверены, что хотите удалить этот чат?
              <br /><br />
              <strong>Внимание:</strong> Все сообщения, изображения, видео и файлы будут удалены безвозвратно у всех участников.
            </p>
            <div style={styles.modalActions}>
              <button
                onClick={() => setShowDeleteChatModal(false)}
                style={styles.modalCancelBtn}
              >
                Отмена
              </button>
              <button
                onClick={handleConfirmDeleteChat}
                style={styles.modalDeleteBtn}
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

// Компонент сообщения
function MessageBubble({ message, isMine, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { type = 'text', text, attachment, createdAt, sender } = message;
  
  const time = createdAt
    ? new Date(createdAt).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const senderName = sender?.name || '';
  
  // Формирование URL для медиа-файлов
  const getMediaUrl = (url) => {
    if (!url) return '';
    // Если URL уже абсолютный - возвращаем как есть
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // Получаем базовый URL без /api
    const baseUrl = API_URL.replace('/api', '');
    return `${baseUrl}${url}`;
  };

  const renderContent = () => {
    switch (type) {
      case 'image':
        return (
          <div style={styles.mediaWrapper}>
            <img
              src={getMediaUrl(attachment?.url)}
              alt={attachment?.originalName || 'Изображение'}
              style={styles.imagePreview}
              onClick={() => window.open(getMediaUrl(attachment?.url), '_blank')}
            />
            {text && <div style={styles.mediaCaption}>{text}</div>}
          </div>
        );

      case 'video':
        return (
          <div style={styles.mediaWrapper}>
            <video
              src={getMediaUrl(attachment?.url)}
              controls
              preload="metadata"
              style={styles.videoPreview}
            />
            {text && <div style={styles.mediaCaption}>{text}</div>}
          </div>
        );

      case 'audio':
        // CRITICAL: Правильное воспроизведение голосовых сообщений
        const audioUrl = getMediaUrl(attachment?.url);
        return (
          <div style={styles.audioWrapper}>
            <span style={styles.audioIcon}>🎤</span>
            <audio
              controls
              preload="metadata"
              style={styles.audioPlayer}
            >
              <source src={audioUrl} type="audio/webm" />
              <source src={audioUrl} type="audio/ogg" />
              <source src={audioUrl} type="audio/mpeg" />
              Ваш браузер не поддерживает аудио
            </audio>
          </div>
        );

      case 'file':
        return (
          <a
            href={getMediaUrl(attachment?.url)}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.fileLink}
            download={attachment?.originalName || 'file'}
          >
            <span style={styles.fileIcon}>📄</span>
            <div style={styles.fileInfo}>
              <div style={styles.fileName}>{attachment?.originalName || 'Файл'}</div>
              <div style={styles.fileSize}>
                {attachment?.size ? formatFileSize(attachment.size) : ''}
              </div>
            </div>
            <span style={styles.downloadIcon}>⬇️</span>
          </a>
        );

      default:
        return <div style={styles.textContent}>{text}</div>;
    }
  };

  return (
    <div style={{
      ...styles.messageRow,
      justifyContent: isMine ? 'flex-end' : 'flex-start',
    }}>
      <div 
        style={{
          ...styles.bubble,
          ...(isMine ? styles.bubbleMine : styles.bubbleTheirs),
          position: 'relative',
        }}
        onContextMenu={(e) => {
          if (onDelete) {
            e.preventDefault();
            setShowMenu(true);
          }
        }}
        onClick={() => setShowMenu(false)}
      >
        {!isMine && senderName && (
          <div style={styles.senderName}>{senderName}</div>
        )}
        {renderContent()}
        <div style={{
          ...styles.messageTime,
          textAlign: isMine ? 'right' : 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isMine ? 'flex-end' : 'flex-start',
          gap: '8px',
        }}>
          {time}
          {/* Кнопка удаления для своих сообщений */}
          {isMine && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
              style={styles.deleteMessageBtn}
              title="Удалить сообщение"
            >
              🗑️
            </button>
          )}
        </div>

        {/* Контекстное меню для удаления (по правому клику) */}
        {showMenu && onDelete && (
          <div style={styles.messageContextMenu}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                setShowDeleteConfirm(true);
              }}
              style={styles.contextMenuItem}
            >
              🗑️ Удалить
            </button>
          </div>
        )}

        {/* Подтверждение удаления сообщения */}
        {showDeleteConfirm && (
          <div style={styles.deleteConfirmPopup}>
            <div style={styles.deleteConfirmText}>Удалить сообщение?</div>
            <div style={styles.deleteConfirmActions}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(false);
                }}
                style={styles.deleteConfirmCancel}
              >
                Отмена
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                  setShowDeleteConfirm(false);
                }}
                style={styles.deleteConfirmYes}
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

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    height: '100%',
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    position: 'relative',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '20px',
    animation: 'float 3s ease-in-out infinite',
    filter: 'drop-shadow(0 4px 12px rgba(59, 130, 246, 0.3))',
  },
  emptyText: {
    fontSize: '22px',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    marginBottom: '10px',
    letterSpacing: '0.5px',
  },
  emptyHint: {
    fontSize: '15px',
    color: '#94a3b8',
    opacity: 0.8,
  },
  // Incoming call banner
  incomingCallBanner: {
    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)',
    padding: '14px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    animation: 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1), pulse-banner 2s infinite',
    boxShadow: '0 8px 32px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
    borderRadius: '0 0 16px 16px',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderTop: 'none',
  },
  incomingGroupCallBanner: {
    background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 50%, #6b21a8 100%)',
    padding: '14px 18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    animation: 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1), pulse-group-banner 2s infinite',
    boxShadow: '0 8px 32px rgba(168, 85, 247, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
    borderRadius: '0 0 16px 16px',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderTop: 'none',
  },
  callBannerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  callBannerIcon: {
    fontSize: '28px',
    animation: 'shake 0.6s infinite, glow 2s infinite',
    filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.5))',
  },
  callBannerInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  callBannerTitle: {
    color: '#fff',
    fontWeight: '600',
    fontSize: '14px',
  },
  callBannerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: '12px',
  },
  callBannerActions: {
    display: 'flex',
    gap: '8px',
  },
  callBannerDecline: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: 'none',
    background: '#ef4444',
    color: '#fff',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.2s',
  },
  callBannerAccept: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #fff, #f0f0f0)',
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'pulse-btn 1.2s infinite, scale-in 0.3s ease',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.5)',
    transition: 'transform 0.2s',
  },
  // Header
  header: {
    padding: '14px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))',
    backdropFilter: 'blur(20px) saturate(180%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 16px rgba(0,0,0,0.1)',
    position: 'relative',
    zIndex: 10,
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #a855f7 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: '700',
    fontSize: '18px',
    boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
    border: '2px solid rgba(255,255,255,0.1)',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    position: 'relative',
    overflow: 'hidden',
  },
  groupAvatar: {
    background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 50%, #6b21a8 100%)',
    boxShadow: '0 4px 16px rgba(168, 85, 247, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
  },
  chatName: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
  },
  participantCount: {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '2px',
  },
  typingIndicator: {
    fontSize: '12px',
    color: '#3b82f6',
    marginTop: '2px',
  },
  typingDots: {
    animation: 'blink 1s infinite',
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
  },
  backBtn: {
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    borderRadius: '50%',
    fontSize: '20px',
    color: '#fff',
    cursor: 'pointer',
    marginRight: '8px',
    transition: 'background 0.2s',
  },
  callBtn: {
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '50%',
    fontSize: '20px',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)',
  },
  groupCallBtn: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: '1px solid #a855f7',
    borderRadius: '50%',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    position: 'relative',
    color: '#a855f7',
  },
  groupCallBadge: {
    position: 'absolute',
    fontSize: '10px',
    bottom: '-2px',
    right: '-2px',
  },
  // Messages
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    background: 'radial-gradient(ellipse at top, rgba(59, 130, 246, 0.03) 0%, transparent 50%)',
    position: 'relative',
  },
  noMessages: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
    fontSize: '14px',
    gap: '8px',
  },
  noMessagesIcon: {
    fontSize: '32px',
  },
  // Message bubble
  messageRow: {
    display: 'flex',
    width: '100%',
  },
  bubble: {
    maxWidth: '75%',
    padding: '12px 16px',
    borderRadius: '20px',
    wordWrap: 'break-word',
    position: 'relative',
    animation: 'messageSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
  },
  bubbleMine: {
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
    color: '#fff',
    borderBottomRightRadius: '6px',
    boxShadow: '0 4px 16px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
    marginLeft: 'auto',
  },
  bubbleTheirs: {
    background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
    color: '#e2e8f0',
    borderBottomLeftRadius: '6px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  senderName: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#60a5fa',
    marginBottom: '4px',
  },
  textContent: {
    fontSize: '14px',
    lineHeight: '1.4',
  },
  messageTime: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '4px',
  },
  // Media
  mediaWrapper: {
    maxWidth: '280px',
  },
  imagePreview: {
    maxWidth: '100%',
    maxHeight: '300px',
    borderRadius: '12px',
    cursor: 'pointer',
    display: 'block',
  },
  videoPreview: {
    maxWidth: '100%',
    maxHeight: '300px',
    borderRadius: '12px',
  },
  mediaCaption: {
    marginTop: '6px',
    fontSize: '14px',
  },
  // Audio
  audioWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: '200px',
  },
  audioIcon: {
    fontSize: '20px',
  },
  audioPlayer: {
    height: '36px',
    flex: 1,
  },
  // File
  fileLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '8px',
    textDecoration: 'none',
    color: 'inherit',
  },
  fileIcon: {
    fontSize: '28px',
  },
  fileInfo: {
    overflow: 'hidden',
    flex: 1,
  },
  fileName: {
    fontSize: '13px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '180px',
  },
  fileSize: {
    fontSize: '11px',
    opacity: 0.7,
  },
  downloadIcon: {
    fontSize: '16px',
    opacity: 0.8,
  },
  // Меню чата
  menuContainer: {
    position: 'relative',
  },
  chatMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '8px',
    background: '#1e293b',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    overflow: 'hidden',
    zIndex: 100,
    minWidth: '160px',
  },
  menuItem: {
    width: '100%',
    padding: '12px 16px',
    background: 'transparent',
    border: 'none',
    color: '#ef4444',
    fontSize: '14px',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'background 0.2s',
  },
  // Модальное окно удаления чата
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modal: {
    background: '#1e293b',
    borderRadius: '16px',
    padding: '24px',
    maxWidth: '360px',
    width: '90%',
    textAlign: 'center',
  },
  modalIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  modalTitle: {
    color: '#fff',
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '12px',
  },
  modalText: {
    color: '#94a3b8',
    fontSize: '14px',
    lineHeight: '1.5',
    marginBottom: '24px',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  modalCancelBtn: {
    padding: '12px 24px',
    background: '#334155',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  modalDeleteBtn: {
    padding: '12px 24px',
    background: '#ef4444',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  // Удаление сообщения
  deleteMessageBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: '12px',
    cursor: 'pointer',
    opacity: 0.5,
    transition: 'opacity 0.2s',
    padding: '0',
  },
  messageContextMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '4px',
    background: '#1e293b',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    overflow: 'hidden',
    zIndex: 100,
  },
  contextMenuItem: {
    padding: '10px 16px',
    background: 'transparent',
    border: 'none',
    color: '#ef4444',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    whiteSpace: 'nowrap',
  },
  deleteConfirmPopup: {
    position: 'absolute',
    bottom: '100%',
    right: 0,
    marginBottom: '8px',
    background: '#1e293b',
    borderRadius: '12px',
    padding: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    zIndex: 100,
    minWidth: '180px',
  },
  deleteConfirmText: {
    color: '#fff',
    fontSize: '13px',
    marginBottom: '12px',
    textAlign: 'center',
  },
  deleteConfirmActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
  },
  deleteConfirmCancel: {
    padding: '6px 12px',
    background: '#334155',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
  },
  deleteConfirmYes: {
    padding: '6px 12px',
    background: '#ef4444',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
  },
};

// Добавляем анимации для баннера звонка
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes slideDown {
      from {
        transform: translateY(-100%) scale(0.95);
        opacity: 0;
      }
      to {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
    }
    @keyframes pulse-banner {
      0%, 100% {
        box-shadow: 0 8px 32px rgba(34, 197, 94, 0.3), 0 0 0 0 rgba(34, 197, 94, 0.4);
      }
      50% {
        box-shadow: 0 8px 32px rgba(34, 197, 94, 0.5), 0 0 0 12px rgba(34, 197, 94, 0);
      }
    }
    @keyframes pulse-group-banner {
      0%, 100% {
        box-shadow: 0 8px 32px rgba(168, 85, 247, 0.3), 0 0 0 0 rgba(168, 85, 247, 0.4);
      }
      50% {
        box-shadow: 0 8px 32px rgba(168, 85, 247, 0.5), 0 0 0 12px rgba(168, 85, 247, 0);
      }
    }
    @keyframes pulse-btn {
      0%, 100% { 
        transform: scale(1);
        box-shadow: 0 4px 16px rgba(0,0,0,0.3), 0 0 0 0 rgba(255,255,255,0.4);
      }
      50% { 
        transform: scale(1.08);
        box-shadow: 0 6px 20px rgba(0,0,0,0.4), 0 0 0 8px rgba(255,255,255,0);
      }
    }
    @keyframes shake {
      0%, 100% { transform: rotate(0deg) scale(1); }
      25% { transform: rotate(-12deg) scale(1.05); }
      75% { transform: rotate(12deg) scale(1.05); }
    }
    @keyframes glow {
      0%, 100% { filter: drop-shadow(0 0 8px rgba(255,255,255,0.5)); }
      50% { filter: drop-shadow(0 0 16px rgba(255,255,255,0.8)); }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }
    @keyframes scale-in {
      from {
        transform: scale(0);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }
    @keyframes messageSlideIn {
      from {
        transform: translateY(10px) scale(0.95);
        opacity: 0;
      }
      to {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
    }
    
    /* Hover эффекты */
    button:hover {
      transform: translateY(-2px) scale(1.02);
    }
    button:active {
      transform: translateY(0) scale(0.98);
    }
  `;
  document.head.appendChild(styleSheet);
}

export default ChatWindow;
