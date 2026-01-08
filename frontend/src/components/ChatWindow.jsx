import React, { useEffect, useRef, useState } from 'react';
import MessageInput from './MessageInput';
import { API_URL } from '../config';

function ChatWindow({ token, chat, messages, socket, currentUserId, onStartCall, typingUsers }) {
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

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

  return (
    <div style={styles.container}>
      {/* Шапка с кнопками звонков */}
      <div style={styles.header}>
        <div style={styles.headerInfo}>
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
    </div>
  );
}

// Компонент сообщения
function MessageBubble({ message, isMine }) {
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
      <div style={{
        ...styles.bubble,
        ...(isMine ? styles.bubbleMine : styles.bubbleTheirs),
      }}>
        {!isMine && senderName && (
          <div style={styles.senderName}>{senderName}</div>
        )}
        {renderContent()}
        <div style={{
          ...styles.messageTime,
          textAlign: isMine ? 'right' : 'left',
        }}>
          {time}
        </div>
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
};

export default ChatWindow;
