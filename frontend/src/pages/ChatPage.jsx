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
  const [typingUsers, setTypingUsers] = useState([]);
  
  // Состояние звонка
  const [callState, setCallState] = useState('idle'); // idle | incoming | outgoing | active
  const [callType, setCallType] = useState(null);     // audio | video
  const [callId, setCallId] = useState(null);
  const [remoteUser, setRemoteUser] = useState(null);
  
  // Данные входящего звонка для отображения в UI (баннер и индикатор)
  const [incomingCallData, setIncomingCallData] = useState(null);
  
  const socketRef = useRef(null);
  
  // Refs для использования актуальных значений в обработчиках сокета
  const chatsRef = useRef(chats);
  const selectedChatRef = useRef(selectedChat);
  const callStateRef = useRef(callState);
  const callIdRef = useRef(callId);
  const currentUserIdRef = useRef(currentUserId);
  
  // Обновляем refs при изменении состояния
  useEffect(() => { chatsRef.current = chats; }, [chats]);
  useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { callIdRef.current = callId; }, [callId]);
  useEffect(() => { currentUserIdRef.current = currentUserId; }, [currentUserId]);

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

  // Подключение Socket.IO - только один раз при логине
  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
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
        if (selectedChatRef.current?._id === chatId) {
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

    // Новый чат создан (когда кто-то создал с нами чат)
    socket.on('chat:new', (newChat) => {
      console.log('[ChatPage] Received chat:new:', newChat);
      setChats((prev) => {
        // Проверяем что чата ещё нет в списке
        if (prev.some(c => c._id === newChat._id)) return prev;
        return [newChat, ...prev];
      });
      
      // Присоединяемся к комнате нового чата
      socket.emit('chat:join', { chatId: newChat._id });
    });

    // Сообщение удалено
    socket.on('message:deleted', ({ chatId, messageId }) => {
      console.log('[ChatPage] Message deleted:', messageId);
      setMessages((prev) => prev.filter(m => m._id !== messageId));
      
      // Обновляем lastMessage в списке чатов если удалено последнее сообщение
      setChats((prev) => prev.map(chat => {
        if (chat._id === chatId && chat.lastMessage?._id === messageId) {
          return { ...chat, lastMessage: null };
        }
        return chat;
      }));
    });

    // Чат удалён
    socket.on('chat:deleted', ({ chatId }) => {
      console.log('[ChatPage] Chat deleted:', chatId);
      setChats((prev) => prev.filter(c => c._id !== chatId));
      
      // Если удалён текущий выбранный чат - сбрасываем выбор
      if (selectedChatRef.current?._id === chatId) {
        setSelectedChat(null);
        setMessages([]);
      }
    });

    // === ЗВОНКИ ===
    socket.on('call:incoming', ({ callId: incomingCallId, chatId: incomingChatId, chatName, initiator, type }) => {
      console.log('[ChatPage] Incoming call:', { incomingCallId, incomingChatId, initiator, type });
      
      // Ищем чат для отображения
      const chat = chatsRef.current.find(c => c._id === incomingChatId);
      
      // Сохраняем данные входящего звонка для UI
      setIncomingCallData({
        callId: incomingCallId,
        chatId: incomingChatId,
        initiator: {
          _id: initiator._id,
          name: initiator.name || chatName || 'Пользователь',
          avatarUrl: initiator.avatarUrl
        },
        type
      });
      
      setCallState('incoming');
      setCallType(type);
      setCallId(incomingCallId);
      setRemoteUser({
        _id: initiator._id,
        name: initiator.name || chatName || 'Пользователь',
        avatarUrl: initiator.avatarUrl
      });
      
      // Если мы не в этом чате - переключаемся
      if (!selectedChatRef.current || selectedChatRef.current._id !== incomingChatId) {
        if (chat) {
          setSelectedChat(chat);
        }
      }
    });

    socket.on('call:participant_joined', ({ callId: cId, userId: joinedUserId, userName }) => {
      console.log('[ChatPage] Participant joined:', { cId, joinedUserId, userName, currentCallId: callIdRef.current, currentCallState: callStateRef.current, currentUserId: currentUserIdRef.current });
      
      // Игнорируем если это мы сами
      if (joinedUserId === currentUserIdRef.current) {
        console.log('[ChatPage] Ignoring self participant_joined');
        return;
      }
      
      // Если это наш звонок и мы инициатор (outgoing)
      if (callStateRef.current === 'outgoing') {
        setCallState('active');
      }
    });

    socket.on('call:ended', ({ callId: cId, reason }) => {
      console.log('[ChatPage] Call ended:', { cId, reason, currentCallId: callIdRef.current });
      resetCallState();
      setIncomingCallData(null);
    });

    socket.on('call:participant_left', ({ callId: cId, callEnded }) => {
      console.log('[ChatPage] Participant left:', { cId, callEnded });
      if (callEnded) {
        resetCallState();
        setIncomingCallData(null);
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO отключен');
    });

    return () => {
      socket.disconnect();
    };
  }, [token]); // ТОЛЬКО token - сокет создаётся один раз

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
    } catch (error) {
      console.error('Ошибка создания чата:', error);
      alert('Не удалось создать чат');
    }
  };

  // === Удаление ===
  const handleDeleteMessage = useCallback(async (messageId) => {
    if (!selectedChat || !token) return;
    
    try {
      await axios.delete(
        `${API_URL}/messages/${selectedChat._id}/${messageId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Сообщение удалится через socket событие message:deleted
    } catch (error) {
      console.error('Ошибка удаления сообщения:', error);
      alert(error.response?.data?.error || 'Не удалось удалить сообщение');
    }
  }, [selectedChat, token]);

  const handleDeleteChat = useCallback(async () => {
    if (!selectedChat || !token) return;
    
    try {
      await axios.delete(
        `${API_URL}/chats/${selectedChat._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Чат удалится через socket событие chat:deleted
    } catch (error) {
      console.error('Ошибка удаления чата:', error);
      alert(error.response?.data?.error || 'Не удалось удалить чат');
    }
  }, [selectedChat, token]);

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
    setIncomingCallData(null);
  };

  // Обработчик принятия звонка из баннера
  const handleAcceptCallFromBanner = useCallback((cId, type) => {
    console.log('[ChatPage] Accept call from banner:', cId, type);
    // Убираем баннер и переводим звонок в активное состояние
    setIncomingCallData(null);
    setCallState('active');
  }, []);

  // Обработчик отклонения звонка из баннера
  const handleDeclineCallFromBanner = useCallback((cId) => {
    console.log('[ChatPage] Decline call from banner:', cId);
    if (socketRef.current) {
      socketRef.current.emit('call:decline', { callId: cId });
    }
    resetCallState();
  }, []);
  
  // Колбэк когда звонок принят в CallModal
  const handleCallAccepted = useCallback(() => {
    console.log('[ChatPage] Call accepted in modal');
    setIncomingCallData(null);
    setCallState('active');
  }, []);

  return (
    <div style={styles.container}>
      {/* Сайдбар с чатами */}
      <div 
        className={`sidebar-wrapper ${selectedChat ? 'hidden' : ''}`}
        style={styles.sidebarWrapper}
      >
        <Sidebar
          token={token}
          chats={chats}
          selectedChat={selectedChat}
          onSelectChat={handleSelectChat}
          onCreateChat={handleCreateChat}
          onLogout={onLogout}
          incomingCallChatId={incomingCallData?.chatId}
        />
      </div>

      {/* Окно чата */}
      <div 
        className={`chat-window-wrapper ${selectedChat ? 'active' : ''}`}
        style={styles.chatWindowWrapper}
      >
        <ChatWindow
          token={token}
          chat={selectedChat}
          messages={messages}
          socket={socketRef.current}
          currentUserId={currentUserId}
          onStartCall={handleStartCall}
          typingUsers={typingUsers}
          incomingCall={incomingCallData}
          onAcceptCall={handleAcceptCallFromBanner}
          onDeclineCall={handleDeclineCallFromBanner}
          onBack={() => setSelectedChat(null)}
          onDeleteMessage={handleDeleteMessage}
          onDeleteChat={handleDeleteChat}
        />
      </div>

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
          onCallAccepted={handleCallAccepted}
          currentUserId={currentUserId}
          token={token}
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
  chatWindowWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minWidth: 0,
  },
};

// Добавляем медиа-запросы через CSS-in-JS
if (typeof window !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @media (max-width: 768px) {
      .mobile-menu-btn {
        display: none !important;
      }
      .sidebar-wrapper {
        position: absolute !important;
        top: 0;
        left: 0;
        height: 100% !important;
        z-index: 100;
        width: 100% !important;
        transform: translateX(0);
        transition: transform 0.3s ease;
      }
      .sidebar-wrapper.hidden {
        transform: translateX(-100%);
        pointer-events: none;
      }
      .chat-window-wrapper {
        position: absolute !important;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 99;
        transform: translateX(100%);
        transition: transform 0.3s ease;
      }
      .chat-window-wrapper.active {
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
