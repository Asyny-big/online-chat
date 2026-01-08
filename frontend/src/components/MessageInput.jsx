import React, { useState } from 'react';

function MessageInput({ chatId, socket }) {
  const [input, setInput] = useState('');

  const handleSend = (e) => {
    e.preventDefault();

    if (!input.trim() || !chatId || !socket) return;

    socket.emit('message:send', {
      chatId,
      text: input.trim(),
    });

    setInput('');
  };

  return (
    <form onSubmit={handleSend} style={styles.form}>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Введите сообщение"
        style={styles.textarea}
        rows={3}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(e);
          }
        }}
      />
      <button type="submit" style={styles.button}>
        Отправить
      </button>
    </form>
  );
}

const styles = {
  form: {
    display: 'flex',
    gap: '12px',
    padding: '16px',
    borderTop: '1px solid #334155',
    background: '#1e293b',
  },
  textarea: {
    flex: 1,
    padding: '12px',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    resize: 'none',
    outline: 'none',
    fontFamily: 'inherit',
  },
  button: {
    padding: '12px 24px',
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    alignSelf: 'flex-end',
  },
};

export default MessageInput;
