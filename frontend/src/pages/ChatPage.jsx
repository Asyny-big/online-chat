import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { API_URL, SOCKET_URL } from '../config';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';

function ChatPage({ token, onLogout }) {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const socketRef = useRef(null);

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
      if (selectedChat?._id === chatId) {
        setMessages((prev) => [...prev, message]);
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO отключен');
    });

    return () => {
      socket.disconnect();
    };
  }, [token, selectedChat]);

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

  return (
    <div style={styles.container}>
      <Sidebar
        token={token}
        chats={chats}
        selectedChat={selectedChat}
        onSelectChat={handleSelectChat}
        onCreateChat={handleCreateChat}
        onLogout={onLogout}
      />
      <ChatWindow
        token={token}
        chat={selectedChat}
        messages={messages}
        socket={socketRef.current}
      />
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    background: '#0f172a',
  },
};

export default ChatPage;
