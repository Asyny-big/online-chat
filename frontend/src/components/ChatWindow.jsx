import React, { useEffect, useRef, useState, useCallback } from 'react';
import MessageInput from './MessageInput';
import { API_URL } from '../config';

function ChatWindow({ token, chat, messages, socket, currentUserId, onStartCall, typingUsers, incomingCall, onAcceptCall, onDeclineCall, onBack, onDeleteMessage, onDeleteChat }) {
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
  
  // Проверяем есть ли входящий звонок для этого чата
  const hasIncomingCall = incomingCall && incomingCall.chatId === chat._id;

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
          <div style={styles.avatar}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 style={styles.chatName}>{displayName}</h3>
            {typingList.length > 0 && (
              <div style={styles.typingIndicator}>
                печатает<span style={styles.typingDots}>...</span>
              </div>
            )}
          </div>
        </div>
        <div style={styles.headerActions}>
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
    background: '#0f172a',
    height: '100%',
    minHeight: 0,
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f172a',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  emptyText: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: '8px',
  },
  emptyHint: {
    fontSize: '14px',
    color: '#64748b',
  },
  // Incoming call banner
  incomingCallBanner: {
    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    animation: 'slideDown 0.3s ease, pulse-banner 1.5s infinite',
  },
  callBannerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  callBannerIcon: {
    fontSize: '24px',
    animation: 'shake 0.5s infinite',
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
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: 'none',
    background: '#fff',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'pulse-btn 1s infinite',
  },
  // Header
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid #334155',
    background: '#1e293b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: '600',
    fontSize: '16px',
  },
  chatName: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
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
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: '1px solid #334155',
    borderRadius: '50%',
    fontSize: '18px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  // Messages
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
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
    padding: '10px 14px',
    borderRadius: '18px',
    wordWrap: 'break-word',
  },
  bubbleMine: {
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    color: '#fff',
    borderBottomRightRadius: '4px',
  },
  bubbleTheirs: {
    background: '#334155',
    color: '#e2e8f0',
    borderBottomLeftRadius: '4px',
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
        transform: translateY(-100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    @keyframes pulse-banner {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
      }
      50% {
        box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
      }
    }
    @keyframes pulse-btn {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    @keyframes shake {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-15deg); }
      75% { transform: rotate(15deg); }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default ChatWindow;
