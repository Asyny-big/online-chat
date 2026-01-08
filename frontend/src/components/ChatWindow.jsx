import React, { useEffect, useRef } from 'react';
import MessageInput from './MessageInput';

function ChatWindow({ token, chat, messages, socket }) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!chat) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyText}>Выберите чат</div>
        <div style={styles.emptyHint}>
          Или найдите пользователя по номеру телефона
        </div>
      </div>
    );
  }

  const displayName = chat.displayName || chat.name || 'Чат';

  return (
    <div style={styles.container}>
      {/* Шапка */}
      <div style={styles.header}>
        <h3 style={styles.chatName}>{displayName}</h3>
      </div>

      {/* Список сообщений */}
      <div style={styles.messagesContainer}>
        {messages.length === 0 ? (
          <div style={styles.noMessages}>Нет сообщений</div>
        ) : (
          messages.map((msg, idx) => {
            const senderName = msg.sender?.name || msg.username || 'Аноним';
            const text = msg.text || '';
            const time = msg.createdAt
              ? new Date(msg.createdAt).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';

            return (
              <div key={msg._id || idx} style={styles.message}>
                <div style={styles.messageSender}>{senderName}</div>
                <div style={styles.messageText}>{text}</div>
                <div style={styles.messageTime}>{time}</div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Поле ввода */}
      <MessageInput chatId={chat._id} socket={socket} />
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#0f172a',
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f172a',
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
  header: {
    padding: '16px',
    borderBottom: '1px solid #334155',
    background: '#1e293b',
  },
  chatName: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#fff',
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  noMessages: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: '14px',
    marginTop: '32px',
  },
  message: {
    marginBottom: '16px',
    padding: '12px',
    background: '#1e293b',
    borderRadius: '8px',
    borderLeft: '3px solid #3b82f6',
  },
  messageSender: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: '4px',
  },
  messageText: {
    fontSize: '14px',
    color: '#e2e8f0',
    marginBottom: '4px',
    wordWrap: 'break-word',
  },
  messageTime: {
    fontSize: '11px',
    color: '#64748b',
  },
};

export default ChatWindow;
