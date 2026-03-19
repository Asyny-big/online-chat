import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { API_URL, SOCKET_URL } from '@/config';
import Sidebar from '@/components/Sidebar';
import ChatWindow from '@/components/ChatWindow';
import CallModal from '@/components/CallModal';
import GroupCallModalLiveKit from '@/components/GroupCallModalLiveKit';
import { useHrumToast } from '@/components/HrumToast';
import { getTransactions } from '@/domains/hrum/api/economyApi';
import { consumePendingPushAction, pushEvents } from '@/mobile/pushNotifications';

const WALLET_UPDATE_EVENT = 'govchat:wallet-update';

function extractParticipantUserId(participant) {
  return String(
    participant?.user?._id
      || participant?.user
      || participant?._id
      || participant?.id
      || ''
  ).trim();
}

function isPrivateChatWithUser(chat, targetUserId, viewerUserId = '') {
  if (!chat || chat.type !== 'private') return false;
  const normalizedTargetUserId = String(targetUserId || '').trim();
  if (!normalizedTargetUserId) return false;

  const participantIds = Array.isArray(chat.participants)
    ? chat.participants.map(extractParticipantUserId).filter(Boolean)
    : [];

  if (!participantIds.includes(normalizedTargetUserId)) return false;

  const normalizedViewerUserId = String(viewerUserId || '').trim();
  if (!normalizedViewerUserId) return true;

  return participantIds.includes(normalizedViewerUserId);
}

const DELETED_MESSAGE_TEXT = '\u0421\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0443\u0434\u0430\u043b\u0435\u043d\u043e';
const DEFAULT_PRIVATE_USER_NAME = '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c';
const DEFAULT_GROUP_CHAT_NAME = '\u0413\u0440\u0443\u043f\u043f\u043e\u0432\u043e\u0439 \u0447\u0430\u0442';

function getMessageIdentity(message) {
  return String(message?.messageId || message?._id || '').trim();
}

function getMessageTimestamp(message) {
  const value = message?.createdAt ? Date.parse(message.createdAt) : 0;
  return Number.isFinite(value) ? value : 0;
}

function getMessageRevision(message) {
  const value = Number(message?.revision ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getMessageMutationTimestamp(message) {
  const rawValue = message?.updatedAt || message?.editedAt || message?.createdAt || null;
  const value = rawValue ? Date.parse(rawValue) : 0;
  return Number.isFinite(value) ? value : 0;
}

function shouldReplaceMessageState(currentMessage, nextMessage) {
  if (!nextMessage?._id) return false;
  if (!currentMessage?._id) return true;

  const currentRevision = getMessageRevision(currentMessage);
  const nextRevision = getMessageRevision(nextMessage);
  if (nextRevision !== currentRevision) {
    return nextRevision > currentRevision;
  }

  const currentTimestamp = getMessageMutationTimestamp(currentMessage);
  const nextTimestamp = getMessageMutationTimestamp(nextMessage);
  if (nextTimestamp !== currentTimestamp) {
    return nextTimestamp >= currentTimestamp;
  }

  if (Boolean(nextMessage.deleted) !== Boolean(currentMessage.deleted)) {
    return Boolean(nextMessage.deleted);
  }

  if (Boolean(nextMessage.edited) !== Boolean(currentMessage.edited)) {
    return Boolean(nextMessage.edited);
  }

  return getMessageTimestamp(nextMessage) >= getMessageTimestamp(currentMessage);
}

function buildChatLastMessage(message) {
  if (!message) return null;

  return {
    ...message,
    _id: message._id || message.messageId,
    messageId: getMessageIdentity(message),
    type: message.deleted ? 'text' : message.type,
    text: message.deleted ? DELETED_MESSAGE_TEXT : (message.text || '')
  };
}

function shouldReplaceLastMessage(currentLastMessage, nextMessage) {
  if (!nextMessage) return false;
  if (!currentLastMessage) return true;

  const currentId = getMessageIdentity(currentLastMessage);
  const nextId = getMessageIdentity(nextMessage);
  if (currentId && nextId && currentId === nextId) {
    return true;
  }

  return getMessageTimestamp(nextMessage) >= getMessageTimestamp(currentLastMessage);
}

function upsertMessage(messages, incomingMessage, { appendIfMissing = true } = {}) {
  if (!incomingMessage?._id) return messages;

  const nextMessages = [...messages];
  const existingIndex = nextMessages.findIndex((item) => item._id === incomingMessage._id);

  if (existingIndex >= 0) {
    if (!shouldReplaceMessageState(nextMessages[existingIndex], incomingMessage)) {
      return messages;
    }
    nextMessages[existingIndex] = incomingMessage;
  } else if (appendIfMissing) {
    nextMessages.push(incomingMessage);
  } else {
    return messages;
  }

  return nextMessages.sort((left, right) => getMessageTimestamp(left) - getMessageTimestamp(right));
}

function ChatPageInner({
  token,
  onLogout,
  pendingPrivateChatTarget = null,
  onPendingPrivateChatHandled = null
}) {
  const { showEarn } = useHrumToast();
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);

  // Состояние звонка (для 1-to-1)
  const [callState, setCallState] = useState('idle'); // idle | incoming | outgoing | active
  const [callType, setCallType] = useState(null);     // audio | video
  const [callId, setCallId] = useState(null);
  const [remoteUser, setRemoteUser] = useState(null);

  // Данные входящего звонка для отображения в UI (баннер и индикатор)
  const [incomingCallData, setIncomingCallData] = useState(null);

  // Состояние группового звонка
  const [groupCallState, setGroupCallState] = useState('idle'); // idle | incoming | active
  const [groupCallData, setGroupCallData] = useState(null);

  const socketRef = useRef(null);
  const economyProbeTimersRef = useRef([]);
  const messagesRef = useRef(messages);
  const messagesRequestIdRef = useRef(0);
  const pendingMessageUpdatesRef = useRef(new Map());
  const recentPrivateCallEventsRef = useRef(new Map());

  // Refs для использования актуальных значений в обработчиках сокета
  const chatsRef = useRef(chats);
  const selectedChatRef = useRef(selectedChat);
  const callStateRef = useRef(callState);
  const callIdRef = useRef(callId);
  const currentUserIdRef = useRef(currentUserId);
  const groupCallStateRef = useRef(groupCallState);
  const groupCallDataRef = useRef(groupCallData);
  const handledPrivateChatRequestIdRef = useRef('');

  // Обновляем refs при изменении состояния
  useEffect(() => { chatsRef.current = chats; }, [chats]);
  useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { callIdRef.current = callId; }, [callId]);
  useEffect(() => { currentUserIdRef.current = currentUserId; }, [currentUserId]);
  useEffect(() => { groupCallStateRef.current = groupCallState; }, [groupCallState]);
  useEffect(() => { groupCallDataRef.current = groupCallData; }, [groupCallData]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const shouldHandlePrivateCallEvent = useCallback((direction, rawCallId) => {
    const callId = String(rawCallId || '').trim();
    if (!callId) return false;

    const key = `${direction}:${callId}`;
    const now = Date.now();
    recentPrivateCallEventsRef.current.forEach((handledAt, storedKey) => {
      if (now - handledAt > 15000) {
        recentPrivateCallEventsRef.current.delete(storedKey);
      }
    });

    const lastHandledAt = recentPrivateCallEventsRef.current.get(key);
    if (lastHandledAt && now - lastHandledAt < 1500) {
      return false;
    }

    recentPrivateCallEventsRef.current.set(key, now);
    return true;
  }, []);

  const fetchChats = useCallback(async () => {
    if (!token) {
      setChats([]);
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/chats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const nextChats = Array.isArray(response.data) ? response.data : [];
      setChats(nextChats);
      const currentSelectedChatId = String(selectedChatRef.current?._id || '').trim();
      if (!currentSelectedChatId) {
        return;
      }
      const refreshedSelectedChat = nextChats.find((chat) => chat?._id === currentSelectedChatId) || null;
      if (refreshedSelectedChat) {
        setSelectedChat(refreshedSelectedChat);
      } else if (selectedChatRef.current?._id) {
        setSelectedChat(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('[ChatPage] Failed to fetch chats:', error);
      setChats([]);
    }
  }, [token]);

  const fetchMessagesForChat = useCallback(async (chatId) => {
    if (!token || !chatId) {
      setMessages([]);
      return;
    }

    const requestId = messagesRequestIdRef.current + 1;
    messagesRequestIdRef.current = requestId;

    try {
      const response = await axios.get(`${API_URL}/messages/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (messagesRequestIdRef.current !== requestId || selectedChatRef.current?._id !== chatId) {
        return;
      }
      const fetchedMessages = Array.isArray(response.data) ? response.data : [];
      const pendingUpdates = pendingMessageUpdatesRef.current.get(chatId);
      let mergedMessages = fetchedMessages;

      if (pendingUpdates?.size) {
        pendingUpdates.forEach((pendingMessage, messageId) => {
          if (!mergedMessages.some((item) => item._id === messageId)) {
            return;
          }

          mergedMessages = upsertMessage(mergedMessages, pendingMessage, { appendIfMissing: false });
          pendingUpdates.delete(messageId);
        });

        if (pendingUpdates.size === 0) {
          pendingMessageUpdatesRef.current.delete(chatId);
        }
      }

      setMessages(mergedMessages);
    } catch (error) {
      console.error('[ChatPage] Failed to fetch messages:', error);
      if (messagesRequestIdRef.current !== requestId || selectedChatRef.current?._id !== chatId) {
        return;
      }
      setMessages([]);
    }
  }, [token]);

  const syncChatLastMessage = useCallback((chatId, message, { promoteToTop = false } = {}) => {
    if (!chatId || !message) return;

    setChats((prev) => {
      const index = prev.findIndex((chat) => chat._id === chatId);
      if (index < 0) return prev;

      const currentChat = prev[index];
      if (!shouldReplaceLastMessage(currentChat.lastMessage, message)) {
        return prev;
      }

      const nextChat = {
        ...currentChat,
        lastMessage: buildChatLastMessage(message)
      };
      const nextChats = [...prev];
      nextChats[index] = nextChat;

      if (!promoteToTop || index === 0) {
        return nextChats;
      }

      nextChats.splice(index, 1);
      nextChats.unshift(nextChat);
      return nextChats;
    });
  }, []);

  const applyIncomingMessage = useCallback((chatId, message) => {
    if (!chatId || !message?._id) return;

    syncChatLastMessage(chatId, message, { promoteToTop: true });
    setMessages((prev) => {
      if (selectedChatRef.current?._id !== chatId) {
        return prev;
      }

      let nextMessages = upsertMessage(prev, message);
      const pendingUpdates = pendingMessageUpdatesRef.current.get(chatId);
      const pendingMessage = pendingUpdates?.get(message._id);

      if (pendingMessage) {
        nextMessages = upsertMessage(nextMessages, pendingMessage, { appendIfMissing: false });
        pendingUpdates.delete(message._id);
        if (pendingUpdates.size === 0) {
          pendingMessageUpdatesRef.current.delete(chatId);
        }
      }

      return nextMessages;
    });
  }, [syncChatLastMessage]);

  const applyUpdatedMessage = useCallback((chatId, message) => {
    if (!chatId || !message?._id) return;

    syncChatLastMessage(chatId, message, { promoteToTop: false });
    if (selectedChatRef.current?._id !== chatId) {
      const pendingUpdates = pendingMessageUpdatesRef.current.get(chatId) || new Map();
      pendingUpdates.set(message._id, message);
      pendingMessageUpdatesRef.current.set(chatId, pendingUpdates);
      return;
    }

    setMessages((prev) => {
      const hasMessage = prev.some((item) => item._id === message._id);
      if (!hasMessage) {
        const pendingUpdates = pendingMessageUpdatesRef.current.get(chatId) || new Map();
        pendingUpdates.set(message._id, message);
        pendingMessageUpdatesRef.current.set(chatId, pendingUpdates);
        void fetchMessagesForChat(chatId);
        return prev;
      }
      return upsertMessage(prev, message, { appendIfMissing: false });
    });
  }, [fetchMessagesForChat, syncChatLastMessage]);

  const applyDeletedMessage = useCallback((payload = {}) => {
    const chatId = String(payload.chatId || '').trim();
    const messageId = String(payload.messageId || '').trim();
    const message = payload.message || null;

    if (!chatId || !messageId) return;

    if (payload.scope === 'for_me') {
      setMessages((prev) => {
        if (selectedChatRef.current?._id !== chatId) {
          return prev;
        }
        return prev.filter((item) => item._id !== messageId);
      });
      return;
    }

    if (message?._id) {
      applyUpdatedMessage(chatId, message);
      return;
    }

    setMessages((prev) => {
      if (selectedChatRef.current?._id !== chatId) {
        return prev;
      }
      return prev.filter((item) => item._id !== messageId);
    });
  }, [applyUpdatedMessage]);

  useEffect(() => {
    const target = pendingPrivateChatTarget;
    const requestId = String(target?.requestId || '').trim();
    const targetUserId = String(target?.userId || '').trim();

    if (!token || !targetUserId) return;
    if (requestId && handledPrivateChatRequestIdRef.current === requestId) return;

    let cancelled = false;

    const openOrCreatePrivateChat = async () => {
      try {
        const existingChat = chatsRef.current.find((chat) =>
          isPrivateChatWithUser(chat, targetUserId, currentUserIdRef.current)
        );

        if (existingChat) {
          if (!cancelled) {
            setSelectedChat(existingChat);
          }
          return;
        }

        const response = await axios.post(
          `${API_URL}/chats/private`,
          { userId: targetUserId },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const privateChat = response?.data || null;
        if (!privateChat || cancelled) return;

        setChats((prev) => {
          const existingIndex = prev.findIndex((chat) => chat._id === privateChat._id);
          if (existingIndex >= 0) {
            const next = [...prev];
            next[existingIndex] = { ...next[existingIndex], ...privateChat };
            return next;
          }
          return [privateChat, ...prev];
        });

        setSelectedChat(privateChat);
      } catch (error) {
        console.error('[ChatPage] Failed to open/create private chat from search:', error);
        if (!cancelled) {
          alert(error?.response?.data?.error || 'Не удалось открыть диалог');
        }
      } finally {
        handledPrivateChatRequestIdRef.current = requestId || `${targetUserId}:${Date.now()}`;
        if (!cancelled) {
          onPendingPrivateChatHandled?.(requestId);
        }
      }
    };

    void openOrCreatePrivateChat();

    return () => {
      cancelled = true;
    };
  }, [token, pendingPrivateChatTarget, onPendingPrivateChatHandled]);

  const ensureChatSelected = useCallback(async (chatId, chatName = '') => {
    if (!chatId || !token) return null;

    let nextChat = chatsRef.current.find((chat) => chat._id === chatId) || null;
    if (!nextChat) {
      try {
        const res = await axios.get(`${API_URL}/chats/${chatId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        nextChat = res.data || null;
      } catch (_) {
        // fallback below
      }

      if (!nextChat && chatName) {
        nextChat = {
          _id: chatId,
          type: 'private',
          name: chatName,
          displayName: chatName,
          participants: []
        };
      }

      if (nextChat) {
        setChats((prev) => {
          const existingIndex = prev.findIndex((chat) => chat._id === nextChat._id);
          if (existingIndex >= 0) {
            const copy = [...prev];
            copy[existingIndex] = { ...copy[existingIndex], ...nextChat };
            return copy;
          }
          return [nextChat, ...prev];
        });
      }
    }

    if (nextChat) {
      setSelectedChat(nextChat);
    }

    return nextChat;
  }, [token]);

  const handlePushOpen = useCallback(async (payloadRaw) => {
    const payload = payloadRaw || {};
    const type = String(payload.type || '').toUpperCase();
    const chatId = String(payload.chatId || '').trim();
    const chatName = String(payload.chatName || '').trim();
    const senderName = String(payload.senderName || '').trim() || 'Контакт';
    const callType = String(payload.callType || '').toLowerCase() === 'video' ? 'video' : 'audio';
    const callIdFromPush = String(payload.callId || payload.roomId || '').trim();
    const callId = callIdFromPush || `push-${Date.now()}`;
    const isGroupCall = payload.isGroupCall === true || String(payload.isGroupCall || '').toLowerCase() === 'true';

    if (chatId) {
      await ensureChatSelected(chatId, chatName);
    }

    if (type !== 'INCOMING_CALL') {
      return;
    }

    if (callStateRef.current !== 'idle' || groupCallStateRef.current !== 'idle') {
      return;
    }

    if (isGroupCall) {
      setGroupCallState('incoming');
      setGroupCallData({
        callId,
        chatId,
        chatName: chatName || (chatsRef.current.find((chat) => chat._id === chatId)?.name || 'Групповой чат'),
        initiator: {
          _id: String(payload.senderId || '').trim(),
          name: senderName
        },
        type: callType,
        participantCount: 1
      });
      return;
    }

    setIncomingCallData({
      callId,
      chatId,
      initiator: {
        _id: String(payload.senderId || '').trim(),
        name: senderName
      },
      type: callType
    });
    setCallState('incoming');
    setCallType(callType);
    setCallId(callId);
    setRemoteUser({
      _id: String(payload.senderId || '').trim(),
      name: senderName
    });
  }, [ensureChatSelected]);

  const economyProbe = useCallback(
    async (expectedReasonCode) => {
      if (!token) return;
      try {
        const data = await getTransactions({ token, limit: 1 });
        const t = data?.items?.[0];
        if (!t || t.reasonCode !== expectedReasonCode) return;
        const raw = String(t.deltaHrum ?? '').trim();
        if (!raw) return;
        const abs = raw.startsWith('-') ? raw.slice(1) : raw.startsWith('+') ? raw.slice(1) : raw;
        showEarn({ amountHrum: abs, txId: t.id });
      } catch (_) { }
    },
    [token, showEarn]
  );

  const economyProbeCallStart = useCallback(() => {
    const timerOne = setTimeout(() => economyProbe('earn:call_start'), 800);
    const timerTwo = setTimeout(() => economyProbe('earn:call_start'), 2200);
    economyProbeTimersRef.current.push(timerOne, timerTwo);
  }, [economyProbe]);

  useEffect(() => {
    return () => {
      economyProbeTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      economyProbeTimersRef.current = [];
    };
  }, []);

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
    if (!token) {
      setChats([]);
      return;
    }

    void fetchChats();
  }, [token, fetchChats]);

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
      const activeChatId = selectedChatRef.current?._id;
      void fetchChats();
      if (activeChatId) {
        socket.emit('chat:join', { chatId: activeChatId });
        void fetchMessagesForChat(activeChatId);
      }
      console.log('Socket.IO подключен:', socket.id);
    });

    // Новое сообщение
    socket.on('message:new', (payload) => {
      const chatId = payload?.chatId;
      const message = payload?.message ?? payload;
      applyIncomingMessage(chatId, message);
    });

    socket.on('message:updated', (payload) => {
      const chatId = payload?.chatId || payload?.message?.chat;
      const message = payload?.message ?? null;
      applyUpdatedMessage(chatId, message);
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
    socket.on('message:deleted', (payload) => {
      applyDeletedMessage(payload);
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
    socket.on('call:sync', ({ callId: syncCallId, chatId: syncChatId, chatName, targetUser, initiator, type, direction, status }) => {
      if (!syncCallId || !syncChatId) return;
      if (!shouldHandlePrivateCallEvent(direction === 'outgoing' ? 'outgoing' : 'incoming', syncCallId)) return;
      const normalizedStatus = String(status || 'ringing').toLowerCase();
      const normalizedInitiator = initiator && typeof initiator === 'object' ? initiator : {};
      const normalizedTargetUser = targetUser && typeof targetUser === 'object' ? targetUser : {};
      if (callIdRef.current && callIdRef.current !== syncCallId) {
        resetCallState();
      }
      if (groupCallDataRef.current?.callId) {
        resetGroupCallState();
      }
      if (callIdRef.current === syncCallId && callStateRef.current !== 'idle') {
        const shouldUpgradeToActive = normalizedStatus === 'active' && callStateRef.current !== 'active';
        if (!shouldUpgradeToActive) {
          return;
        }
      }

      const existingChat = chatsRef.current.find(c => c._id === syncChatId);
      const peer = direction === 'outgoing' ? normalizedTargetUser : normalizedInitiator;
      const chat = existingChat || {
        _id: syncChatId,
        type: 'private',
        displayName: chatName || peer?.name || 'Пользователь',
        name: chatName || peer?.name || 'Пользователь',
        participants: []
      };

      if (!existingChat) {
        setChats(prev => prev.some(c => c._id === syncChatId) ? prev : [chat, ...prev]);
      }

      if (!selectedChatRef.current || selectedChatRef.current._id !== syncChatId) {
        setSelectedChat(chat);
      }

      if (direction === 'outgoing') {
        setIncomingCallData(null);
        setRemoteUser({
          _id: normalizedTargetUser?._id,
          name: targetUser?.name || chat?.displayName || chat?.name || 'Пользователь',
          avatarUrl: normalizedTargetUser?.avatarUrl || null
        });
        setCallType(type || 'video');
        setCallId(syncCallId);
        setCallState(normalizedStatus === 'active' ? 'active' : 'outgoing');
        return;
      }

      if (normalizedStatus === 'active') {
        setIncomingCallData(null);
        setCallState('active');
        setCallType(type);
        setCallId(syncCallId);
        setRemoteUser({
          _id: normalizedInitiator?._id,
          name: initiator?.name || chatName || 'Пользователь',
          avatarUrl: normalizedInitiator?.avatarUrl || null
        });
        return;
      }

      setIncomingCallData({
        callId: syncCallId,
        chatId: syncChatId,
        initiator: {
          _id: initiator?._id,
          name: initiator?.name || chatName || 'Пользователь',
          avatarUrl: initiator?.avatarUrl || null
        },
        type
      });
      setCallState('incoming');
      setCallType(type);
      setCallId(syncCallId);
      setRemoteUser({
        _id: initiator?._id,
        name: initiator?.name || chatName || 'Пользователь',
        avatarUrl: initiator?.avatarUrl || null
      });
    });

    socket.on('call:sync:complete', ({ privateCallIds = [], groupCallIds = [] } = {}) => {
      const activePrivateCallIds = new Set((Array.isArray(privateCallIds) ? privateCallIds : []).map((value) => String(value || '').trim()).filter(Boolean));
      const activeGroupCallIds = new Set((Array.isArray(groupCallIds) ? groupCallIds : []).map((value) => String(value || '').trim()).filter(Boolean));
      const currentPrivateCallId = String(callIdRef.current || '').trim();
      const currentGroupCallId = String(groupCallDataRef.current?.callId || '').trim();

      if (currentPrivateCallId && !activePrivateCallIds.has(currentPrivateCallId)) {
        setIncomingCallData(null);
        setCallState('idle');
        setCallType(null);
        setCallId(null);
        setRemoteUser(null);
      }

      if (currentGroupCallId && !activeGroupCallIds.has(currentGroupCallId)) {
        setGroupCallState('idle');
        setGroupCallData(null);
      }

      setChats((prev) => prev.map((chat) => {
        if (!chat?.activeGroupCall?.callId) {
          return chat;
        }

        return activeGroupCallIds.has(String(chat.activeGroupCall.callId))
          ? chat
          : { ...chat, activeGroupCall: null };
      }));
    });

    socket.on('call:start:ai', ({ callId: startedCallId, chatId: startedChatId, targetUser, type }) => {
      console.log('[ChatPage] AI started outgoing call:', { startedCallId, startedChatId, targetUser, type });
      if (!shouldHandlePrivateCallEvent('outgoing', startedCallId)) {
        return;
      }

      if (callStateRef.current !== 'idle' || groupCallStateRef.current !== 'idle') {
        return;
      }

      const existingChat = chatsRef.current.find(c => c._id === startedChatId);
      const chat = existingChat || {
        _id: startedChatId,
        type: 'private',
        displayName: targetUser?.name || 'Пользователь',
        name: targetUser?.name || 'Пользователь',
        participants: []
      };

      if (!existingChat) {
        setChats(prev => prev.some(c => c._id === startedChatId) ? prev : [chat, ...prev]);
      }

      if (!selectedChatRef.current || selectedChatRef.current._id !== startedChatId) {
        setSelectedChat(chat);
      }

      setIncomingCallData(null);
      setRemoteUser({
        _id: targetUser?._id,
        name: targetUser?.name || chat?.displayName || chat?.name || 'Пользователь',
        avatarUrl: targetUser?.avatarUrl || null
      });
      setCallType(type || 'video');
      setCallId(startedCallId);
      setCallState('outgoing');
    });

    socket.on('call:incoming', ({ callId: incomingCallId, chatId: incomingChatId, chatName, initiator, type }) => {
      console.log('[ChatPage] Incoming call:', { incomingCallId, incomingChatId, initiator, type });
      if (!shouldHandlePrivateCallEvent('incoming', incomingCallId)) {
        return;
      }
      const normalizedInitiator = initiator && typeof initiator === 'object' ? initiator : {};
      if ((callStateRef.current !== 'idle' || groupCallStateRef.current !== 'idle') && callIdRef.current !== incomingCallId) {
        return;
      }

      // Ищем чат для отображения
      const chat = chatsRef.current.find(c => c._id === incomingChatId);

      // Сохраняем данные входящего звонка для UI
      setIncomingCallData({
        callId: incomingCallId,
        chatId: incomingChatId,
        initiator: {
          _id: normalizedInitiator._id,
          name: initiator.name || chatName || 'Пользователь',
          avatarUrl: normalizedInitiator.avatarUrl || null
        },
        type
      });

      setCallState('incoming');
      setCallType(type);
      setCallId(incomingCallId);
      setRemoteUser({
        _id: normalizedInitiator._id,
        name: initiator.name || chatName || 'Пользователь',
        avatarUrl: normalizedInitiator.avatarUrl || null
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
      if (!cId || callIdRef.current !== cId) {
        return;
      }

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
      if (!cId || callIdRef.current !== cId) {
        return;
      }
      resetCallState();
      setIncomingCallData(null);
    });

    socket.on('call:participant_left', ({ callId: cId, callEnded }) => {
      console.log('[ChatPage] Participant left:', { cId, callEnded });
      if (callEnded && cId && callIdRef.current === cId) {
        resetCallState();
        setIncomingCallData(null);
      }
    });

    // === ГРУППОВЫЕ ЗВОНКИ ===
    socket.on('group-call:sync', ({ callId, chatId, chatName, initiator, type, participantCount, direction, status }) => {
      if (!callId || !chatId) return;
      const normalizedStatus = String(status || 'ringing').toLowerCase();
      if (groupCallDataRef.current?.callId && groupCallDataRef.current.callId !== callId) {
        resetGroupCallState();
      }
      if (callIdRef.current) {
        resetCallState();
      }
      if (groupCallDataRef.current?.callId === callId) {
        const shouldUpgradeToActive = normalizedStatus === 'active' && groupCallStateRef.current !== 'active';
        if (!shouldUpgradeToActive) {
          return;
        }
      }

      const existingChat = chatsRef.current.find(chat => chat._id === chatId);
      const fallbackChat = existingChat || {
        _id: chatId,
        type: 'group',
        displayName: chatName || 'Групповой чат',
        name: chatName || 'Групповой чат',
        participants: []
      };

      setChats(prev => {
        const index = prev.findIndex(chat => chat._id === chatId);
        if (index >= 0) {
          return prev.map(chat => {
            if (chat._id === chatId) {
              return {
                ...chat,
                activeGroupCall: { callId, initiator, type, participantCount }
              };
            }
            return chat;
          });
        }

        return [{
          ...fallbackChat,
          activeGroupCall: { callId, initiator, type, participantCount }
        }, ...prev];
      });

      if (groupCallStateRef.current !== 'idle') return;

      const nextState = direction === 'outgoing' || normalizedStatus === 'active' ? 'active' : 'incoming';
      setGroupCallState(nextState);
      setGroupCallData({
        callId,
        chatId,
        chatName: chatName || chatsRef.current.find(c => c._id === chatId)?.name || 'Групповой чат',
        initiator,
        type,
        participantCount,
        autoJoin: direction === 'outgoing' || normalizedStatus === 'active',
        isExisting: true
      });
    });

    socket.on('group-call:incoming', ({ callId, chatId, chatName, initiator, type, participantCount }) => {
      console.log('[ChatPage] Incoming group call:', { callId, chatId, chatName, initiator });

      // Если уже в звонке - игнорируем
      if (callStateRef.current !== 'idle' || groupCallStateRef.current !== 'idle') {
        console.log('[ChatPage] Already in call, ignoring incoming group call');
        return;
      }

      setGroupCallState('incoming');
      setGroupCallData({
        callId,
        chatId,
        chatName,
        initiator,
        type,
        participantCount
      });

      // Переключаемся на чат если не выбран
      const chat = chatsRef.current.find(c => c._id === chatId);
      if (chat && (!selectedChatRef.current || selectedChatRef.current._id !== chatId)) {
        setSelectedChat(chat);
      }
    });

    socket.on('group-call:started', ({ callId, chatId, initiator, type, participantCount }) => {
      console.log('[ChatPage] Group call started in chat:', chatId);
      // Обновляем информацию о чате
      setChats(prev => prev.map(chat => {
        if (chat._id === chatId) {
          return {
            ...chat,
            activeGroupCall: { callId, initiator, type, participantCount }
          };
        }
        return chat;
      }));
    });

    socket.on('group-call:updated', ({ callId, chatId, participantCount }) => {
      console.log('[ChatPage] Group call updated:', { chatId, participantCount });
      setChats(prev => prev.map(chat => {
        if (chat._id === chatId && chat.activeGroupCall) {
          return {
            ...chat,
            activeGroupCall: { ...chat.activeGroupCall, participantCount }
          };
        }
        return chat;
      }));
    });

    socket.on('group-call:ended', ({ callId, chatId, reason }) => {
      console.log('[ChatPage] Group call ended:', { chatId, reason });
      // Очищаем информацию о звонке в чате
      setChats(prev => prev.map(chat => {
        if (chat._id === chatId) {
          return { ...chat, activeGroupCall: null };
        }
        return chat;
      }));

      // Если мы были в этом звонке - закрываем модал
      if (groupCallDataRef.current?.chatId === chatId) {
        resetGroupCallState();
      }
    });

    // Обновление чата (название, аватар)
    socket.on('chat:updated', ({ chatId, name, avatarUrl }) => {
      setChats(prev => prev.map(chat => {
        if (chat._id === chatId) {
          return { ...chat, name, avatarUrl, displayName: name };
        }
        return chat;
      }));
    });

    socket.on('wallet:update', (payload) => {
      const detail = payload && typeof payload === 'object' ? payload : {};
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(WALLET_UPDATE_EVENT, { detail }));
      }

      const tx = detail.tx || detail.transaction || detail.txItem || null;
      const txId = tx?.id || detail.txId || detail.eventId;
      const rawDelta = detail.deltaHrum ?? tx?.deltaHrum;
      const raw = String(rawDelta ?? '').trim();
      if (!raw) return;

      if (raw.startsWith('+')) {
        const amount = raw.slice(1);
        if (amount) showEarn({ amountHrum: amount, txId });
      } else {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed > 0) {
          showEarn({ amountHrum: String(parsed), txId });
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO отключен');
    });

    return () => {
      economyProbeTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      economyProbeTimersRef.current = [];
      socket.disconnect();
    };
  }, [token, showEarn, applyDeletedMessage, applyIncomingMessage, applyUpdatedMessage, fetchChats, fetchMessagesForChat, shouldHandlePrivateCallEvent]); // showEarn stable callback from provider

  useEffect(() => {
    if (!token) return;

    const onPushOpen = (event) => {
      const data = event?.detail || {};
      void handlePushOpen(data);
    };

    window.addEventListener(pushEvents.OPEN_EVENT, onPushOpen);

    const pending = consumePendingPushAction();
    if (pending) {
      void handlePushOpen(pending);
    }

    return () => {
      window.removeEventListener(pushEvents.OPEN_EVENT, onPushOpen);
    };
  }, [token, handlePushOpen]);

  // Загрузка сообщений при выборе чата
  useEffect(() => {
    if (!token || !selectedChat) {
      setMessages([]);
      return;
    }

    void fetchMessagesForChat(selectedChat._id);

    // Присоединение к комнате чата
    if (socketRef.current) {
      socketRef.current.emit('chat:join', { chatId: selectedChat._id });
    }
  }, [token, selectedChat, fetchMessagesForChat]);

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

  // Добавление чата напрямую (для групповых чатов)
  const handleAddChat = useCallback((chat) => {
    setChats((prev) => {
      const exists = prev.find((c) => c._id === chat._id);
      if (exists) return prev;
      return [chat, ...prev];
    });
  }, []);

  // === Удаление ===
  const handleEditMessage = useCallback(async (messageId, text) => {
    if (!token) return;
    const chatId = selectedChatRef.current?._id;
    const currentMessage = messagesRef.current.find((item) => item._id === messageId) || null;
    const optimisticUpdatedAt = new Date().toISOString();
    const optimisticMessage = currentMessage
      ? {
          ...currentMessage,
          text,
          edited: true,
          editedAt: optimisticUpdatedAt,
          updatedAt: optimisticUpdatedAt,
          revision: getMessageRevision(currentMessage) + 1
        }
      : null;

    try {
      if (chatId && optimisticMessage) {
        applyUpdatedMessage(chatId, optimisticMessage);
      }
      const response = await axios.patch(
        `${API_URL}/messages/${messageId}`,
        {
          text,
          expectedRevision: currentMessage ? getMessageRevision(currentMessage) : undefined,
          expectedUpdatedAt: currentMessage?.updatedAt || currentMessage?.editedAt || currentMessage?.createdAt
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response?.data?.message) {
        applyUpdatedMessage(response.data.message.chat || chatId, response.data.message);
      }
    } catch (error) {
      if (chatId && currentMessage) {
        applyUpdatedMessage(chatId, currentMessage);
        void fetchMessagesForChat(chatId);
      }
      console.error('Ошибка редактирования сообщения:', error);
      alert(error.response?.data?.error || 'Не удалось обновить сообщение');
      throw error;
    }
  }, [token, applyUpdatedMessage, fetchMessagesForChat]);

  const handleDeleteMessage = useCallback(async (messageId) => {
    const chatId = selectedChatRef.current?._id;
    if (!chatId || !token) return;
    const currentMessage = messagesRef.current.find((item) => item._id === messageId) || null;
    const optimisticUpdatedAt = new Date().toISOString();
    const optimisticMessage = currentMessage
      ? {
          ...currentMessage,
          text: '',
          attachment: null,
          edited: false,
          editedAt: null,
          deleted: true,
          updatedAt: optimisticUpdatedAt,
          revision: getMessageRevision(currentMessage) + 1
        }
      : null;

    try {
      if (optimisticMessage) {
        applyDeletedMessage({
          chatId,
          messageId,
          message: optimisticMessage,
          scope: 'for_all'
        });
      }
      const response = await axios.delete(
        `${API_URL}/messages/${messageId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            expectedRevision: currentMessage ? getMessageRevision(currentMessage) : undefined,
            expectedUpdatedAt: currentMessage?.updatedAt || currentMessage?.editedAt || currentMessage?.createdAt
          }
        }
      );

      if (response?.data) {
        applyDeletedMessage({
          chatId: response.data.message?.chat || chatId,
          messageId,
          message: response.data.message || null,
          scope: response.data.scope || 'for_all'
        });
      }
    } catch (error) {
      if (currentMessage) {
        applyUpdatedMessage(chatId, currentMessage);
        void fetchMessagesForChat(chatId);
      }
      console.error('Ошибка удаления сообщения:', error);
      alert(error.response?.data?.error || 'Не удалось удалить сообщение');
    }
  }, [token, applyDeletedMessage, applyUpdatedMessage, fetchMessagesForChat]);

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
        economyProbeCallStart();
      }
    });
  }, [selectedChat, currentUserId, economyProbeCallStart]);

  const resetCallState = () => {
    setCallState('idle');
    setCallType(null);
    setCallId(null);
    setRemoteUser(null);
    setIncomingCallData(null);
  };

  const resetGroupCallState = () => {
    setGroupCallState('idle');
    setGroupCallData(null);
  };

  // === ГРУППОВЫЕ ЗВОНКИ ===
  const handleStartGroupCall = useCallback((type) => {
    if (!selectedChat || !socketRef.current || selectedChat.type !== 'group') return;

    // Если мы уже знаем, что в чате идёт групповой звонок — просто присоединяемся.
    const knownActiveCallId = selectedChat.activeGroupCall?.callId;
    const knownActiveType = selectedChat.activeGroupCall?.type;
    if (knownActiveCallId) {
      setGroupCallState('active');
      setGroupCallData({
        callId: knownActiveCallId,
        chatId: selectedChat._id,
        chatName: selectedChat.name || selectedChat.displayName,
        type: knownActiveType || type,
        autoJoin: true,
        isExisting: true
      });
      return;
    }

    socketRef.current.emit('group-call:start', {
      chatId: selectedChat._id,
      type
    }, (response) => {
      if (response.error === 'already_active') {
        // Звонок уже активен - предлагаем присоединиться
        if (window.confirm('В группе уже идёт звонок. Присоединиться?')) {
          setGroupCallState('active');
          setGroupCallData({
            callId: response.callId,
            chatId: selectedChat._id,
            chatName: selectedChat.name || selectedChat.displayName,
            type: response.type || type,
            autoJoin: true,
            isExisting: true
          });
        }
      } else if (response.error) {
        alert(response.error);
      } else {
        // Успешно начали звонок
        setGroupCallState('active');
        setGroupCallData({
          callId: response.callId,
          chatId: selectedChat._id,
          chatName: selectedChat.name || selectedChat.displayName,
          type,
          isInitiator: true
        });
        economyProbeCallStart();
      }
    });
  }, [selectedChat, economyProbeCallStart]);

  const handleJoinGroupCall = useCallback((callIdFromUi, typeFromUi) => {
    // Присоединение может происходить из баннера входящего звонка.
    const data = groupCallDataRef.current;
    if (!data && (!callIdFromUi || !selectedChatRef.current?._id)) return;

    const callId = callIdFromUi || data?.callId;
    const chatId = data?.chatId || selectedChatRef.current?._id;
    const chatName = data?.chatName || selectedChatRef.current?.name || selectedChatRef.current?.displayName;
    const type = typeFromUi || data?.type || selectedChatRef.current?.activeGroupCall?.type || 'video';

    setGroupCallState('active');
    setGroupCallData({
      ...(data || {}),
      callId,
      chatId,
      chatName,
      type,
      autoJoin: true,
      isExisting: true
    });
  }, []);

  const handleDeclineGroupCall = useCallback(() => {
    resetGroupCallState();
  }, []);

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
    <div className="chat-page-layout">
      {/* Сайдбар с чатами */}
      <div className={`chat-sidebar-wrapper ${selectedChat ? 'hidden' : ''}`}>
        <Sidebar
          token={token}
          chats={chats}
          selectedChat={selectedChat}
          onSelectChat={handleSelectChat}
          onCreateChat={handleCreateChat}
          onAddChat={handleAddChat}
          onOpenNewDialog={() => { window.location.hash = '#/search'; }}
          onLogout={onLogout}
          onNavigateToProfile={() => { window.location.hash = '#/profile'; }}
          incomingCallChatId={incomingCallData?.chatId}
        />
      </div>

      {/* Окно чата */}
      <div className={`chat-window-wrapper ${selectedChat ? 'active' : ''}`}>
        <ChatWindow
          token={token}
          chat={selectedChat}
          messages={messages}
          socket={socketRef.current}
          currentUserId={currentUserId}
          onStartCall={handleStartCall}
          onStartGroupCall={handleStartGroupCall}
          typingUsers={typingUsers}
          incomingCall={incomingCallData}
          incomingGroupCall={groupCallState === 'incoming' ? groupCallData : null}
          onAcceptCall={handleAcceptCallFromBanner}
          onDeclineCall={handleDeclineCallFromBanner}
          onAcceptGroupCall={handleJoinGroupCall}
          onDeclineGroupCall={handleDeclineGroupCall}
          onBack={() => setSelectedChat(null)}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onDeleteChat={handleDeleteChat}
        />
      </div>

      {/* Модальное окно 1-to-1 звонка */}
      {callState !== 'idle' && selectedChat?.type === 'private' && (
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

      {/* Модальное окно группового звонка */}
      {groupCallState !== 'idle' && groupCallData && (
        <GroupCallModalLiveKit
          socket={socketRef.current}
          callId={groupCallData.callId}
          chatId={groupCallData.chatId}
          chatName={groupCallData.chatName}
          callType={groupCallData.type}
          isIncoming={groupCallState === 'incoming'}
          autoJoin={!!groupCallData.autoJoin}
          initiator={groupCallData.initiator}
          existingParticipants={groupCallData.existingParticipants || []}
          currentUserId={currentUserId}
          token={token}
          onClose={resetGroupCallState}
          onJoin={handleJoinGroupCall}
        />
      )}

      <style>{`
        .chat-page-layout {
            display: flex;
            height: 100vh;
            height: 100dvh;
            overflow: hidden;
            background: var(--bg-primary);
            position: relative;
        }

        .chat-sidebar-wrapper {
            width: 320px;
            flex-shrink: 0;
            height: 100%;
            transition: transform 0.3s ease;
            border-right: 1px solid var(--border-color);
        }

        .chat-window-wrapper {
            flex: 1;
            display: flex;
            flex-direction: column;
            height: 100%;
            min-width: 0;
        }

        @media (max-width: 768px) {
            .chat-sidebar-wrapper {
                position: absolute;
                top: 0; left: 0;
                width: 100%; height: 100%;
                z-index: 10;
                background-color: var(--bg-primary);
                transform: translateX(0);
            }
            
            .chat-sidebar-wrapper.hidden {
                transform: translateX(-100%);
                pointer-events: none;
            }

            .chat-window-wrapper {
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                z-index: 20;
                background-color: var(--bg-primary);
                transform: translateX(100%);
                transition: transform 0.3s ease;
            }

            .chat-window-wrapper.active {
                transform: translateX(0);
            }
        }
      `}</style>
    </div>
  );
}

export default ChatPageInner;
