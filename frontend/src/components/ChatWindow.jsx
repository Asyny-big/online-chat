import React, { useEffect, useRef, useState, useCallback } from 'react';
import MessageInput from './MessageInput';
import { API_URL } from '../config';
import { PhoneIcon, VideoIcon, BackIcon, MoreVerticalIcon, TrashIcon, CheckIcon, CloseIcon, DownloadIcon, FileIcon } from './Icons';

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
              {incomingCall.type === 'video' ? <VideoIcon size={24} color="#10b981" /> : <PhoneIcon size={24} color="#10b981" />}
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
              <CloseIcon size={18} color="#ef4444" />
            </button>
            <button 
              onClick={() => onAcceptCall?.(incomingCall.callId, incomingCall.type)}
              style={styles.callBannerAccept}
              title="Принять"
            >
              {incomingCall.type === 'video' ? <VideoIcon size={20} color="#fff" /> : <PhoneIcon size={20} color="#fff" />}
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
              <BackIcon size={22} color="#64748b" />
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
            <PhoneIcon size={20} color="#64748b" />
          </button>
          <button
            onClick={() => onStartCall?.('video')}
            style={styles.callBtn}
            title="Видеозвонок"
          >
            <VideoIcon size={20} color="#64748b" />
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
              <MoreVerticalIcon size={20} color="#64748b" />
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
                  <TrashIcon size={16} color="#ef4444" />
                  <span>Удалить чат</span>
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
    background: '#f8fafc',
    height: '100%',
    minHeight: 0,
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
  },
  emptyIcon: {
    fontSize: '56px',
    marginBottom: '20px',
    opacity: 0.6,
  },
  emptyText: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#64748b',
    marginBottom: '8px',
  },
  emptyHint: {
    fontSize: '14px',
    color: '#94a3b8',
  },
  // Incoming call banner
  incomingCallBanner: {
    background: '#ffffff',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    boxShadow: '0 4px 20px rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    borderRadius: 0,
    animation: 'slideDown 0.3s ease',
  },
  callBannerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  callBannerIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: 'rgba(16, 185, 129, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'pulse 1.5s infinite',
  },
  callBannerInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  callBannerTitle: {
    color: '#1e293b',
    fontWeight: '600',
    fontSize: '15px',
  },
  callBannerSubtitle: {
    color: '#64748b',
    fontSize: '13px',
    marginTop: '2px',
  },
  callBannerActions: {
    display: 'flex',
    gap: '10px',
  },
  callBannerDecline: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '1.5px solid #fecaca',
    background: '#fef2f2',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  callBannerAccept: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: 'none',
    background: '#10b981',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
    animation: 'pulse 1.5s infinite',
  },
  // Header
  header: {
    padding: '14px 20px',
    borderBottom: '1px solid #e2e8f0',
    background: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  avatar: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: '600',
    fontSize: '17px',
    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)',
  },
  chatName: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: '#1e293b',
    letterSpacing: '-0.01em',
  },
  typingIndicator: {
    fontSize: '12px',
    color: '#3b82f6',
    marginTop: '2px',
    fontWeight: '500',
  },
  typingDots: {
    animation: 'blink 1s infinite',
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
  },
  backBtn: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    marginRight: '4px',
    transition: 'all 0.2s ease',
  },
  callBtn: {
    width: '42px',
    height: '42px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
    border: '1.5px solid #e2e8f0',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  // Messages
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    background: '#f8fafc',
  },
  noMessages: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
    fontSize: '14px',
    gap: '8px',
  },
  noMessagesIcon: {
    fontSize: '40px',
    opacity: 0.6,
  },
  // Message bubble
  messageRow: {
    display: 'flex',
    width: '100%',
  },
  bubble: {
    maxWidth: '70%',
    padding: '12px 16px',
    borderRadius: '20px',
    wordWrap: 'break-word',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
  },
  bubbleMine: {
    background: '#3b82f6',
    color: '#fff',
    borderBottomRightRadius: '6px',
  },
  bubbleTheirs: {
    background: '#ffffff',
    color: '#1e293b',
    borderBottomLeftRadius: '6px',
    border: '1px solid #e2e8f0',
  },
  senderName: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: '4px',
  },
  textContent: {
    fontSize: '15px',
    lineHeight: '1.45',
  },
  messageTime: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.7)',
    marginTop: '6px',
  },
  // Media
  mediaWrapper: {
    maxWidth: '300px',
  },
  imagePreview: {
    maxWidth: '100%',
    maxHeight: '320px',
    borderRadius: '14px',
    cursor: 'pointer',
    display: 'block',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  },
  videoPreview: {
    maxWidth: '100%',
    maxHeight: '320px',
    borderRadius: '14px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  },
  mediaCaption: {
    marginTop: '8px',
    fontSize: '14px',
  },
  // Audio
  audioWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: '220px',
    padding: '4px 0',
  },
  audioIcon: {
    fontSize: '18px',
    color: '#3b82f6',
  },
  audioPlayer: {
    height: '36px',
    flex: 1,
    borderRadius: '8px',
  },
  // File
  fileLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    background: 'rgba(59, 130, 246, 0.08)',
    borderRadius: '12px',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'all 0.2s ease',
  },
  fileIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    background: 'rgba(59, 130, 246, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    overflow: 'hidden',
    flex: 1,
  },
  fileName: {
    fontSize: '14px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '180px',
    color: '#1e293b',
  },
  fileSize: {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '2px',
  },
  downloadIcon: {
    opacity: 0.6,
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
    background: '#ffffff',
    borderRadius: '14px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12)',
    overflow: 'hidden',
    zIndex: 100,
    minWidth: '180px',
    border: '1px solid #e2e8f0',
  },
  menuItem: {
    width: '100%',
    padding: '14px 18px',
    background: 'transparent',
    border: 'none',
    color: '#ef4444',
    fontSize: '14px',
    fontWeight: '500',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    transition: 'background 0.2s ease',
  },
  // Модальное окно удаления чата
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modal: {
    background: '#ffffff',
    borderRadius: '20px',
    padding: '28px',
    maxWidth: '380px',
    width: '90%',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
  },
  modalIcon: {
    fontSize: '52px',
    marginBottom: '18px',
  },
  modalTitle: {
    color: '#1e293b',
    fontSize: '20px',
    fontWeight: '700',
    marginBottom: '12px',
    letterSpacing: '-0.02em',
  },
  modalText: {
    color: '#64748b',
    fontSize: '14px',
    lineHeight: '1.6',
    marginBottom: '28px',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  modalCancelBtn: {
    padding: '12px 28px',
    background: '#f1f5f9',
    border: 'none',
    borderRadius: '12px',
    color: '#64748b',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  modalDeleteBtn: {
    padding: '12px 28px',
    background: '#ef4444',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
    transition: 'all 0.2s ease',
  },
  // Удаление сообщения
  deleteMessageBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    opacity: 0.4,
    transition: 'opacity 0.2s ease',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
  },
  messageContextMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '4px',
    background: '#ffffff',
    borderRadius: '10px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
    overflow: 'hidden',
    zIndex: 100,
    border: '1px solid #e2e8f0',
  },
  contextMenuItem: {
    padding: '12px 18px',
    background: 'transparent',
    border: 'none',
    color: '#ef4444',
    fontSize: '13px',
    fontWeight: '500',
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
    background: '#ffffff',
    borderRadius: '14px',
    padding: '14px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12)',
    zIndex: 100,
    minWidth: '190px',
    border: '1px solid #e2e8f0',
  },
  deleteConfirmText: {
    color: '#1e293b',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '14px',
    textAlign: 'center',
  },
  deleteConfirmActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
  },
  deleteConfirmCancel: {
    padding: '8px 16px',
    background: '#f1f5f9',
    border: 'none',
    borderRadius: '8px',
    color: '#64748b',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  deleteConfirmYes: {
    padding: '8px 16px',
    background: '#ef4444',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '500',
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
