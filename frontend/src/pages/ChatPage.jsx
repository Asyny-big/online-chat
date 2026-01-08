import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { API_URL, SOCKET_URL } from '../config';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import CallModal from '../components/CallModal';

function ChatPage({ token, onLogout }) {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  
  // Состояние звонка
  const [callState, setCallState] = useState('idle'); // idle | incoming | outgoing | active
  const [callType, setCallType] = useState(null);     // audio | video
  const [callId, setCallId] = useState(null);
  const [remoteUser, setRemoteUser] = useState(null);
  
  const socketRef = useRef(null);

  // Получение текущего пользователя
  useEffect(() => {
    if (!token) return;
    
    axios
      .get(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => setCurrentUserId(res.data._id))
      .catch(err => console.error('Failed to get current user:', err));
  }, [token]);

  // Загрузка чатов при монтировании
  useEffect(() => {
    if (!token) return;

    axios
      .get(`${API_URL}/chats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setChats(res.data || []))
      .catch(() => setChats([]));
  }, [token]);

  // Подключение Socket.IO
  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket.IO подключен:', socket.id);
    });

    // Новое сообщение
    socket.on('message:new', (payload) => {
      const chatId = payload?.chatId;
      const message = payload?.message ?? payload;

      if (!chatId || !message) return;

      // Обновление последнего сообщения в списке чатов
      setChats((prev) => {
        const idx = prev.findIndex((c) => c._id === chatId);
        if (idx === -1) return prev;

        const updated = [...prev];
        const chat = { ...updated[idx], lastMessage: message };
        updated.splice(idx, 1);
        updated.unshift(chat);
        return updated;
      });

      // Добавление сообщения в текущий чат
      setMessages((prev) => {
        if (selectedChat?._id === chatId) {
          // Проверка на дубликат
          if (prev.some(m => m._id === message._id)) return prev;
          return [...prev, message];
        }
        return prev;
      });
    });

    // Индикатор печати
    socket.on('typing:update', ({ chatId, userId, userName, isTyping }) => {
      setTypingUsers(prev => {
        if (isTyping) {
          if (prev.some(t => t.chatId === chatId && t.userId === userId)) return prev;
          return [...prev, { chatId, userId, userName }];
        } else {
          return prev.filter(t => !(t.chatId === chatId && t.userId === userId));
        }
      });
    });

    // === ЗВОНКИ ===
    socket.on('call:incoming', ({ callId, chatId, chatName, initiator, type }) => {
      setCallState('incoming');
      setCallType(type);
      setCallId(callId);
      setRemoteUser(initiator);
    });

    socket.on('call:participant_joined', ({ callId: cId, userId, userName }) => {
      if (cId === callId && callState === 'outgoing') {
        setCallState('active');
      }
    });

    socket.on('call:ended', ({ callId: cId, reason }) => {
      if (cId === callId || callState !== 'idle') {
        resetCallState();
      }
    });

    socket.on('call:participant_left', ({ callId: cId, callEnded }) => {
      if (callEnded && (cId === callId || callState !== 'idle')) {
        resetCallState();
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO отключен');
    });

    return () => {
      socket.disconnect();
    };
  }, [token, selectedChat, callId, callState]);

  // Загрузка сообщений при выборе чата
  useEffect(() => {
    if (!token || !selectedChat) {
      setMessages([]);
      return;
    }

    axios
      .get(`${API_URL}/messages/${selectedChat._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setMessages(res.data || []))
      .catch(() => setMessages([]));

    // Присоединение к комнате чата
    if (socketRef.current) {
      socketRef.current.emit('chat:join', { chatId: selectedChat._id });
    }
  }, [token, selectedChat]);

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    setIsMobileMenuOpen(false); // Закрыть мобильное меню
  };

  const handleCreateChat = async (userId) => {
    try {
      const res = await axios.post(
        `${API_URL}/chats/private`,
        { userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const newChat = res.data;

      setChats((prev) => {
        const exists = prev.find((c) => c._id === newChat._id);
        if (exists) return prev;
        return [newChat, ...prev];
      });

      setSelectedChat(newChat);
      setIsMobileMenuOpen(false);
    } catch (error) {
      console.error('Ошибка создания чата:', error);
      alert('Не удалось создать чат');
    }
  };

  // === Звонки ===
  const handleStartCall = useCallback((type) => {
    if (!selectedChat || !socketRef.current) return;

    // Найти собеседника
    const otherParticipant = selectedChat.participants?.find(
      p => (p.user?._id || p.user) !== currentUserId
    );
    
    const targetUser = otherParticipant?.user || otherParticipant;
    
    setRemoteUser({
      _id: targetUser?._id || targetUser,
      name: selectedChat.displayName || selectedChat.name || 'Пользователь'
    });
    setCallType(type);
    setCallState('outgoing');

    socketRef.current.emit('call:start', {
      chatId: selectedChat._id,
      type
    }, (response) => {
      if (response.error) {
        alert(response.error);
        resetCallState();
      } else {
        setCallId(response.callId);
      }
    });
  }, [selectedChat, currentUserId]);

  const resetCallState = () => {
    setCallState('idle');
    setCallType(null);
    setCallId(null);
    setRemoteUser(null);
  };

  return (
    <div style={styles.container}>
      {/* Мобильная кнопка меню */}
      <button
        style={styles.mobileMenuBtn}
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? '✕' : '☰'}
      </button>

      {/* Overlay для мобильного */}
      {isMobileMenuOpen && (
        <div
          style={styles.overlay}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div style={{
        ...styles.sidebarWrapper,
        ...(isMobileMenuOpen ? styles.sidebarOpen : {})
      }}>
        <Sidebar
          token={token}
          chats={chats}
          selectedChat={selectedChat}
          onSelectChat={handleSelectChat}
          onCreateChat={handleCreateChat}
          onLogout={onLogout}
        />
      </div>

      <ChatWindow
        token={token}
        chat={selectedChat}
        messages={messages}
        socket={socketRef.current}
        currentUserId={currentUserId}
        onStartCall={handleStartCall}
        typingUsers={typingUsers}
      />

      {/* Модальное окно звонка */}
      {callState !== 'idle' && (
        <CallModal
          socket={socketRef.current}
          callState={callState}
          callType={callType}
          callId={callId}
          chatId={selectedChat?._id}
          remoteUser={remoteUser}
          onClose={resetCallState}
        />
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    height: '100dvh', // для мобильных браузеров
    overflow: 'hidden',
    background: '#0f172a',
    position: 'relative',
  },
  sidebarWrapper: {
    width: '320px',
    flexShrink: 0,
    height: '100%',
    transition: 'transform 0.3s ease',
  },
  sidebarOpen: {},
  mobileMenuBtn: {
    display: 'none',
    position: 'fixed',
    top: '12px',
    left: '12px',
    zIndex: 1001,
    width: '40px',
    height: '40px',
    background: '#3b82f6',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '20px',
    cursor: 'pointer',
  },
  overlay: {
    display: 'none',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    zIndex: 99,
  },
};

// Добавляем медиа-запросы через CSS-in-JS
if (typeof window !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @media (max-width: 768px) {
      .mobile-menu-btn {
        display: flex !important;
        align-items: center;
        justify-content: center;
      }
      .sidebar-wrapper {
        position: fixed !important;
        top: 0;
        left: 0;
        height: 100% !important;
        z-index: 100;
        transform: translateX(-100%);
        width: 280px !important;
      }
      .sidebar-wrapper.open {
        transform: translateX(0);
      }
      .overlay {
        display: block !important;
      }
    }
    
    @keyframes blink {
      0%, 50%, 100% { opacity: 1; }
      25%, 75% { opacity: 0.3; }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default ChatPage;
