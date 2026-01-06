import React, { useState, useEffect, useRef } from "react";
import { createPortal } from 'react-dom';
import axios from "axios";
import * as chatStyles from "./styles/chatStyles";
import io from "socket.io-client";
import { API_URL, SOCKET_URL } from "./config";
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

function parseToken(token) {
  if (!token) return "";
  try {
    const t = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const n = decodeURIComponent(
      atob(t)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(n).username || "";
  } catch {
    return "";
  }
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState("");
  const typingTimeoutRef = useRef(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState("private"); // 'private' | 'group'
  const [newChannel, setNewChannel] = useState(""); // Название группы
  const [targetPhone, setTargetPhone] = useState(""); // Телефон собеседника
  const [authMode, setAuthMode] = useState("login");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [userProfile, setUserProfile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    name: "",
    password: "",
    city: "",
    status: "",
    age: "",
  });
  const [showProfile, setShowProfile] = useState(false);
  const [registering, setRegistering] = useState(false);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRefChat = React.useRef(null); // для вложений в чат
  const fileInputRefAvatar = React.useRef(null); // для аватара профиля
  const [avatarVersion, setAvatarVersion] = useState(Date.now());
  const [fileToSend, setFileToSend] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [modalMedia, setModalMedia] = useState(null); // {type, url, name}
  const [attachBtnHover, setAttachBtnHover] = useState(false); // Состояние для ховера кнопки вложений
  const [showCustomizer, setShowCustomizer] = useState(false); // новое состояние
  const [theme, setTheme] = useState(chatStyles.themes[0]); // выбранная тема
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const recordTimerRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [videoCall, setVideoCall] = useState({ active: false, incoming: false, from: null });
  const [videoStreams, setVideoStreams] = useState({ local: null, remotes: {} }); // remotes: {socketId: MediaStream}
  const [videoPeers, setVideoPeers] = useState({}); // {socketId: RTCPeerConnection}
  const [videoError, setVideoError] = useState("");
  const [videoConnecting, setVideoConnecting] = useState(false);
  const [mySocketId, setMySocketId] = useState(null);
  const [activeCallInChannel, setActiveCallInChannel] = useState(null); // новое состояние для отслеживания активного звонка в канале
  const [activeCallsInChannels, setActiveCallsInChannels] = useState({}); // новое состояние для отслеживания звонков в каналах
  // НОВОЕ: состояния для управления микрофоном и камерой
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const pushInitRef = useRef(false);
  const pushListenersRef = useRef([]);
  const channelsRef = useRef([]);
  const activeCallRef = useRef(null);
  const authTokenRef = useRef(token);
  const devicePushTokenRef = useRef(null);
  const pendingServerRegistrationRef = useRef(false);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          setToken(null);
          localStorage.removeItem("token");
          setAuthMode("login");
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  // --- WebRTC helpers ---
  const localVideoRef = useRef(null);
  const remoteVideosRef = useRef({}); // {socketId: ref}
  const videoPeersRef = useRef({}); // Добавляем ref для синхронного доступа к peers

  const isNativeApp = () => {
    try {
      if (typeof Capacitor?.isNativePlatform === 'function') {
        return Capacitor.isNativePlatform();
      }
      return Capacitor?.getPlatform && Capacitor.getPlatform() !== 'web';
    } catch {
      return false;
    }
  };

  const cleanupPushListeners = () => {
    pushListenersRef.current.forEach((handle) => {
      try {
        handle?.remove?.();
      } catch {
        /* noop */
      }
    });
    pushListenersRef.current = [];
  };

  const registerPushTokenWithServer = async (pushToken) => {
    // Backend endpoint likely removed. Disabling push registration.
    return;
    /*
    if (!pushToken || !authTokenRef.current) return;
    try {
      await axios.post(`${API_URL}/push/register`, { token: pushToken }, {
        headers: { Authorization: `Bearer ${authTokenRef.current}` },
      });
      pendingServerRegistrationRef.current = false;
    } catch (err) {
      console.warn('Не удалось зарегистрировать токен FCM', err?.message || err);
      pendingServerRegistrationRef.current = true;
    }
    */
  };

  const focusChannelFromNotification = (channelId) => {
    if (!channelId) return;
    setSelectedChannel((prev) => (prev === channelId ? prev : channelId));
  };

  const scheduleNativeNotification = async ({ title, body, extra = {}, isCall = false }) => {
    if (!isNativeApp()) return;
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Number(String(Date.now()).slice(-9)),
            title,
            body,
            extra,
            channelId: isCall ? 'govchat-calls' : 'govchat-messages',
            actionTypeId: isCall ? 'call-actions' : undefined,
            sound: 'default',
          },
        ],
      });
    } catch (err) {
      console.warn('Local notification error', err?.message || err);
    }
  };

  // НОВОЕ: функция переключения микрофона
  const toggleMicrophone = () => {
    if (videoStreams.local) {
      const audioTrack = videoStreams.local.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
        console.log("Microphone", audioTrack.enabled ? "enabled" : "disabled");
      }
    }
  };

  // НОВОЕ: функция переключения камеры
  const toggleCamera = () => {
    if (videoStreams.local) {
      const videoTrack = videoStreams.local.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraEnabled(videoTrack.enabled);
        console.log("Camera", videoTrack.enabled ? "enabled" : "disabled");
      }
    }
  };

  // --- Видеозвонок: инициация ---
  const startVideoCall = async () => {
    requestMediaPermissions();
    if (!selectedChannel) {
      alert("Выберите канал для начала видеозвонка");
      return;
    }
    
    console.log("Starting video call in channel:", selectedChannel);
    setVideoError("");
    setVideoConnecting(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      console.log("Got local stream");
      setVideoStreams(s => ({ ...s, local: stream }));
      setVideoCall({ active: true, incoming: false, from: null, channel: selectedChannel });
      setActiveCallInChannel(null); // убираем уведомление о входящем звонке
      // НОВОЕ: сбрасываем состояния микрофона и камеры
      setMicEnabled(true);
      setCameraEnabled(true);
      
      // Сначала присоединяемся к звонку
      // socketRef.current.emit("video-call-join", { channel: selectedChannel });
      
      // Затем инициируем звонок для других
      console.log("Sending initiate signal to channel:", selectedChannel);
      socketRef.current.emit("call:start", { chatId: selectedChannel }, (res) => {
          if (res && res.error) {
              setVideoError(res.error);
              endVideoCall();
          } else if (res && res.callId) {
             setVideoCall(prev => ({ ...prev, callId: res.callId }));
          }
      });
      setVideoConnecting(false);
      
    } catch (error) {
      console.error("Error starting video call:", error);
      setVideoError("Ошибка доступа к камере/микрофону: " + error.message);
      setVideoConnecting(false);
      setVideoCall({ active: false, incoming: false, from: null });
    }
  };

  // --- Видеозвонок: принять входящий ---
  const acceptVideoCall = async (override) => {
    requestMediaPermissions();
    const targetChannel = override?.channel || activeCallRef.current?.channel || activeCallInChannel?.channel;
    if (!targetChannel) {
      setVideoError("Не удалось определить канал звонка");
      return;
    }
    const fromUser = override?.from || activeCallRef.current?.from || activeCallInChannel?.from;
    console.log("Accepting video call from:", fromUser, "in channel:", targetChannel);
    setVideoError("");
    setVideoConnecting(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      console.log("Got local stream for incoming call");
      setVideoStreams(s => ({ ...s, local: stream }));
      setVideoCall({ 
        active: true, 
        incoming: false, 
        from: null, 
        channel: targetChannel 
      });
      setActiveCallInChannel(null); // убираем уведомление
      // НОВОЕ: сбрасываем состояния микрофона и камеры
      setMicEnabled(true);
      setCameraEnabled(true);
      
      // Присоединяемся к звонку
      const callId = override?.callId || activeCallInChannel?.callId;
      if (callId) {
          socketRef.current.emit("call:accept", { callId }, (res) => {
             if (res && res.call) {
                  // handle success, set callId in state
                  setVideoCall(prev => ({ ...prev, callId }));
                  // Process participants if needed
             }
          });
      } else {
          console.error("No callId to accept");
      }
      
      setVideoConnecting(false);
      
    } catch (error) {
      console.error("Error accepting video call:", error);
      setVideoError("Ошибка доступа к камере/микрофону: " + error.message);
      setVideoConnecting(false);
      setVideoCall({ active: false, incoming: false, from: null });
    }
  };

  // --- Видеозвонок: создать PeerConnection ---
  const createPeer = async (peerId, isInitiator, localStream = null) => {
    if (videoPeersRef.current[peerId]) {
      console.log("Peer already exists for:", peerId);
      return videoPeersRef.current[peerId];
    }
    
    // Используем переданный поток или текущий локальный
    const streamToUse = localStream || videoStreams.local;
    if (!streamToUse) {
      console.log("No local stream available for peer:", peerId);
      return null;
    }
    
    console.log("Creating peer connection for:", peerId, "as initiator:", isInitiator);
    
    const pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: [
            "stun:95.81.119.128:3478",
            "stun:stun.l.google.com:19302"
          ]
        },
        {
          urls: [
            "turn:95.81.119.128:3478?transport=udp",
            "turn:95.81.119.128:3478?transport=tcp"
          ],
          username: "govchat",
          credential: "supersecretpassword"
        }
      ],
      iceCandidatePoolSize: 10
    });
    
    // Сразу сохраняем в ref для синхронного доступа
    videoPeersRef.current[peerId] = pc;
    
    // Добавить локальные треки
    streamToUse.getTracks().forEach(track => {
      console.log("Adding track to peer:", peerId, track.kind);
      pc.addTrack(track, streamToUse);
    });
    
    // Обработка ICE кандидатов
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("Sending ICE candidate to:", peerId, event.candidate.type);
        socketRef.current.emit("video-signal", {
          channel: selectedChannel,
          to: peerId,
          data: { candidate: event.candidate }
        });
      } else {
        console.log("ICE gathering completed for:", peerId);
      }
    };
    
    // Обработка удаленного потока
    pc.ontrack = (event) => {
      console.log("Received remote stream from:", peerId, "tracks:", event.streams[0].getTracks().length);
      const remoteStream = event.streams[0];
      
      // Проверяем что поток содержит треки
      if (remoteStream.getTracks().length > 0) {
        setVideoStreams(s => ({
          ...s,
          remotes: { ...s.remotes, [peerId]: remoteStream }
        }));
      } else {
        console.warn("Received empty stream from:", peerId);
      }
    };
    
    // Расширенный мониторинг состояния соединения
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${peerId}:`, pc.connectionState);
      
      if (pc.connectionState === "connected") {
        console.log("✅ WebRTC connection established with:", peerId);
        setVideoError(""); // Очищаем ошибки при успешном соединении
      } else if (pc.connectionState === "connecting") {
        console.log("🔄 Connecting to:", peerId);
      } else if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        console.log("❌ Connection failed/closed with:", peerId, "- removing peer");
        
        // Показываем ошибку только если это было активное соединение
        if (pc.connectionState === "failed") {
          setVideoError("Не удалось установить соединение. Проверьте подключение к интернету.");
        }
        
        // Небольшая задержка перед удалением для возможного восстановления
        setTimeout(() => {
          if (videoPeersRef.current[peerId] && 
              ["disconnected", "failed", "closed"].includes(videoPeersRef.current[peerId].connectionState)) {
            removePeer(peerId);
          }
        }, 3000);
      }
    };
    
    // Мониторинг ICE состояния
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${peerId}:`, pc.iceConnectionState);
      
      if (pc.iceConnectionState === "failed") {
        console.log("ICE connection failed with:", peerId, "- attempting restart");
        // Попытка перезапуска ICE
        pc.restartIce();
      }
    };
    
    // Обновить state
    setVideoPeers(peers => ({ ...peers, [peerId]: pc }));
    
    // Создать offer если мы инициаторы
    if (isInitiator) {
      try {
        console.log("Creating offer for:", peerId);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
          voiceActivityDetection: false // отключаем VAD для стабильности
        });
        await pc.setLocalDescription(offer);
        
        console.log("Sending offer to:", peerId);
        socketRef.current.emit("video-signal", {
          channel: selectedChannel,
          to: peerId,
          data: offer
        });
      } catch (error) {
        console.error("Error creating offer for", peerId, ":", error);
        setVideoError("Ошибка создания предложения соединения");
      }
    }
    
    return pc;
  };

  // --- Видеозвонок: удалить PeerConnection ---
  const removePeer = (peerId) => {
    console.log("Removing peer:", peerId);
    
    // Удаляем из ref
    if (videoPeersRef.current[peerId]) {
      videoPeersRef.current[peerId].close();
      delete videoPeersRef.current[peerId];
    }
    
    setVideoPeers(peers => {
      const { [peerId]: removed, ...rest } = peers;
      return rest;
    });
    
    setVideoStreams(s => {
      const { [peerId]: removed, ...rest } = s.remotes || {};
      return { ...s, remotes: rest };
    });
  };

  // --- Видеозвонок: завершить ---
  const endVideoCall = () => {
    console.log("Ending video call");
    
    // Закрыть все peer connections через ref
    Object.values(videoPeersRef.current).forEach(pc => {
      if (pc) pc.close();
    });
    videoPeersRef.current = {};
    setVideoPeers({});
    
    // Остановить локальный поток
    if (videoStreams.local) {
      videoStreams.local.getTracks().forEach(track => {
        track.stop();
      });
    }
    
    setVideoStreams({ local: null, remotes: {} });
    setVideoCall({ active: false, incoming: false, from: null });
    setVideoConnecting(false);
    
    if (videoCall.callId) {
      socketRef.current.emit("call:leave", { callId: videoCall.callId });
    }
    
    // НОВОЕ: сбрасываем состояния микрофона и камеры
    setMicEnabled(true);
    setCameraEnabled(true);
  };

  // --- Видеозвонок: покинуть звонок ---
  const leaveVideoCall = () => {
    if (videoCall.active && selectedChannel) {
      socketRef.current.emit("video-call-leave", { channel: selectedChannel });
    }
    endVideoCall();
  };

  // --- Отклонить входящий звонок ---
  const declineVideoCall = () => {
    setActiveCallInChannel(null);
  };

  // Определяем кнопку видеозвонка
  const videoCallButton = selectedChannel ? (
    <button
      style={{
        ...chatStyles.videoCallBtn,
        ...(videoCall.active ? chatStyles.videoCallBtnActive : {}),
      }}
      onClick={videoCall.active ? leaveVideoCall : startVideoCall}
      disabled={videoConnecting}
      title={videoCall.active ? "Завершить видеозвонок" : "Начать видеозвонок"}
    >
      {videoConnecting ? "⏳" : videoCall.active ? "📹" : "📹"}
    </button>
  ) : null;

  // Функция для старта записи аудио
  const startRecording = async () => {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      alert("Ваш браузер не поддерживает запись аудио");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new window.MediaRecorder(stream);
      let chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setRecording(false);
        setRecordTime(0);
        stream.getTracks().forEach(track => track.stop());
      };
      setMediaRecorder(recorder);
      setRecording(true);
      setRecordTime(0);
      recordTimerRef.current = setInterval(() => {
        setRecordTime(rt => rt + 1);
      }, 1000);
      chunks = [];
      recorder.start();
    } catch (err) {
      alert("Ошибка доступа к микрофону");
    }
  };

  // Функция для остановки записи аудио
  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setMediaRecorder(null);
    }
    setRecording(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  // Функция для отправки аудиосообщения
  const sendAudioMessage = async () => {
    if (!audioBlob || !selectedChannel) return;
    const t = parseToken(token);
    const formData = new FormData();
    formData.append("file", audioBlob, "voice-message.webm");
    const uploadRes = await axios.post(
      `${API_URL}/upload`,
      formData,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const msg = {
      text: "",
      sender: t,
      channel: selectedChannel,
      fileUrl: uploadRes.data.url,
      fileType: uploadRes.data.fileType,
      originalName: uploadRes.data.originalName || "voice-message.webm"
    };
    socketRef.current && socketRef.current.emit("join", selectedChannel);
    socketRef.current.emit("message", msg);
    setAudioBlob(null);
    setAudioUrl(null);
  };

  function requestMediaPermissions() {
    // Если приложение запущено как нативное (Capacitor)
    if (window.Capacitor && window.Capacitor.isNativePlatform) {
      // Используем require, чтобы не попадал в веб-сборку
      const { Camera } = require('@capacitor/camera');
      Camera.requestPermissions()
        .then(res => {
          console.log('Capacitor camera permissions:', res);
        })
        .catch(err => {
          alert('Не удалось получить разрешения на камеру/микрофон: ' + err.message);
        });
    } else {
      // Для браузера — getUserMedia сам покажет запрос
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          stream.getTracks().forEach(track => track.stop()); // сразу останавливаем, только для запроса
          console.log('Browser permissions granted');
        })
        .catch(err => {
          alert('Для звонка требуется доступ к камере и микрофону: ' + err.message);
        });
    }
  }

  const resolveFileUrl = (url) => {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    // url like /uploads/...

    try {
      let base = '';
      if (API_URL && API_URL.startsWith('http')) {
        base = API_URL.replace(/\/api\/?$/, ''); // Remove /api suffix
      } else if (SOCKET_URL && SOCKET_URL.startsWith('http')) {
        base = SOCKET_URL.replace(/\/$/, '');
      } else if (typeof window !== 'undefined' && window.location && window.location.origin && !window.location.origin.startsWith('file:')) {
        base = window.location.origin;
      }
      return (base ? base.replace(/\/$/, '') : '') + url;
    } catch (e) {
      return url;
    }
  };

  useEffect(() => {
    setUsername(parseToken(token));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const fetchProfile = async () => {
      try {
        const res = await axios.get(`${API_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUserProfile(res.data);
        // Применяем тему из профиля
        if (res.data.theme && (res.data.theme.pageBg || res.data.theme.chatBg)) {
          const found = chatStyles.themes.find(
            t => t.pageBg === res.data.theme.pageBg && t.chatBg === res.data.theme.chatBg
          );
          setTheme(found || { ...chatStyles.themes[0], ...res.data.theme });
        } else {
          setTheme(chatStyles.themes[0]);
        }
      } catch (err) {
        console.error("Profile fetch error", err);
        if (err.response && err.response.status === 401) {
             setToken(null); 
             localStorage.removeItem("token");
        }
        setUserProfile(null);
        setTheme(chatStyles.themes[0]);
      }
    };
    fetchProfile();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API_URL}/chats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        // Сортировка чатов: сначала с новыми сообщениями
        const sorted = res.data.sort((a, b) => {
           const dateA = a.lastMessage ? new Date(a.lastMessage.createdAt) : new Date(a.createdAt);
           const dateB = b.lastMessage ? new Date(b.lastMessage.createdAt) : new Date(b.createdAt);
           return dateB - dateA;
        });
        setChannels(sorted);
      })
      .catch((err) => {
          console.error("Chats fetch error", err);
          setChannels([]);
      });

    socketRef.current = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'] 
    });

    socketRef.current.on("message:new", ({ chatId, message }) => {
      // Обновляем список сообщений если открыт этот чат
      if (chatId === selectedChannel) {
        setMessages((prev) => [...prev, message]);
      }
      
      // Обновляем channel list, чтобы поднять чат вверх и обновить lastMessage
      setChannels(prev => {
          const chatIndex = prev.findIndex(c => c._id === chatId);
          if (chatIndex === -1) return prev; // Если чат новый, он придет через chat:new
          const updatedChat = { ...prev[chatIndex], lastMessage: message };
          const newChannels = [...prev];
          newChannels.splice(chatIndex, 1);
          newChannels.unshift(updatedChat);
          return newChannels;
      });
    });

    socketRef.current.on("typing:update", ({ chatId, userId, userName, isTyping }) => {
       if (chatId !== selectedChannel) return;
       // Logic to show typing user
       if (isTyping) {
            setTyping(`${userName} печатает...`);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setTyping(""), 2000);
       } else {
           setTyping("");
       }
    });

    socketRef.current.on("chat:new", (chat) => {
        setChannels(prev => [chat, ...prev]);
        // Если мы создали чат, можно сразу в него перейти (опционально)
    });

    // Новые обработчики для отслеживания активных звонков
    // Mapped from video-call-status? Backend doesn't seem to emit this exactly.
    // Keeping old logic commented or removed if not supported?
    // Backend 'call:incoming' is supported.

    /* 
    socketRef.current.on("video-call-status", ...); 
    */

    return () => {
      socketRef.current && socketRef.current.disconnect();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [token, selectedChannel]); // Добавлен selectedChannel в зависимости для update

  // Хранение актуальных ссылок на данные для пушей
  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  useEffect(() => {
    activeCallRef.current = activeCallInChannel;
  }, [activeCallInChannel]);

  useEffect(() => {
    authTokenRef.current = token;
  }, [token]);

  // Единая инициализация пуш-уведомлений и локальных уведомлений Android
  useEffect(() => {
    if (!isNativeApp()) {
      cleanupPushListeners();
      pushInitRef.current = false;
      return;
    }

    const initPush = async () => {
      try {
        const perm = await PushNotifications.checkPermissions();
        if (perm.receive !== 'granted') {
          const req = await PushNotifications.requestPermissions();
          if (req.receive !== 'granted') {
            return;
          }
        }

        await LocalNotifications.requestPermissions();
        await LocalNotifications.registerActionTypes([
          {
            id: 'call-actions',
            actions: [
              { id: 'accept-call', title: 'Принять' },
              { id: 'decline-call', title: 'Отклонить', destructive: true },
            ],
          },
        ]);

        if (Capacitor?.getPlatform && Capacitor.getPlatform() === 'android') {
          await LocalNotifications.createChannel({
            id: 'govchat-messages',
            name: 'Сообщения ГоВЧат',
            importance: 5,
            sound: 'default',
          });
          await LocalNotifications.createChannel({
            id: 'govchat-calls',
            name: 'Звонки ГоВЧат',
            importance: 5,
            sound: 'default',
            vibration: true,
          });
        }

        const registrationHandle = await PushNotifications.addListener('registration', async ({ value }) => {
          if (!value) return;
          if (devicePushTokenRef.current === value) {
            if (!authTokenRef.current) {
              pendingServerRegistrationRef.current = true;
            }
            return;
          }
          devicePushTokenRef.current = value;
          if (authTokenRef.current) {
            await registerPushTokenWithServer(value);
          } else {
            pendingServerRegistrationRef.current = true;
          }
        });
        pushListenersRef.current.push(registrationHandle);

        const regErrorHandle = await PushNotifications.addListener('registrationError', (err) => {
          console.warn('FCM registration error', err?.error ?? err);
        });
        pushListenersRef.current.push(regErrorHandle);

        const receiveHandle = await PushNotifications.addListener('pushNotificationReceived', async (notification) => {
          const data = notification.data || {};
          const channelId = data.channelId || data.channel;
          const channelName = data.channelName || channelsRef.current.find((c) => c._id === channelId)?.name || 'канал';
          const senderName = data.caller || data.sender || 'Пользователь';
          const isCall = data.type === 'call';
          const title = notification.title || (isCall ? `Входящий звонок` : `Новое сообщение в #${channelName}`);
          const body = notification.body || (isCall
            ? `${senderName} звонит в #${channelName}`
            : `${senderName}: ${data.preview || data.messageText || ''}`);
          if (isCall) {
            setActiveCallInChannel((prev) => {
              if (prev && prev.channel === channelId) return prev;
              return { from: senderName, channel: channelId };
            });
          }
          await scheduleNativeNotification({
            title,
            body,
            extra: { ...data, channelId, channelName, caller: senderName },
            isCall,
          });
        });
        pushListenersRef.current.push(receiveHandle);

        const actionHandle = await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
          const payload = event.notification?.data || {};
          const channelId = payload.channelId || payload.channel;
          if (channelId) focusChannelFromNotification(channelId);
        });
        pushListenersRef.current.push(actionHandle);

        const localActionHandle = await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
          const payload = event.notification?.extra || {};
          const channelId = payload.channelId || payload.channel;
          if (channelId) focusChannelFromNotification(channelId);
          if (event.actionId === 'accept-call') {
            setActiveCallInChannel({ from: payload.caller || payload.sender || 'Пользователь', channel: channelId });
            acceptVideoCall({ channel: channelId, from: payload.caller || payload.sender });
          } else if (event.actionId === 'decline-call') {
            setActiveCallInChannel(null);
          }
        });
        pushListenersRef.current.push(localActionHandle);

        await PushNotifications.register();
        pushInitRef.current = true;
      } catch (err) {
        console.warn('Push init failed', err?.message || err);
      }
    };

    initPush();

    return () => {
      cleanupPushListeners();
      pushInitRef.current = false;
    };
  }, [token]);

  // Регистрируем сохранённый push-токен на сервере, когда появляется auth token
  useEffect(() => {
    if (!token || !devicePushTokenRef.current || !isNativeApp()) return;
    if (!pendingServerRegistrationRef.current) return;
    registerPushTokenWithServer(devicePushTokenRef.current);
  }, [token]);

  useEffect(() => {
    if (token && selectedChannel) {
      axios
        .get(`${API_URL}/messages/${selectedChannel}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => setMessages(res.data))
        .catch(err => console.error(err));
        
      socketRef.current && socketRef.current.emit("chat:join", { chatId: selectedChannel });
      // НОВОЕ: Сбрасываем уведомление о звонке при смене канала
      setActiveCallInChannel(null);
    }
  }, [token, selectedChannel]);

  useEffect(() => {
    messagesEndRef.current && messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!socketRef.current) return;
    // Handled in main useEffect
  }, [selectedChannel]);

  // Вспомогательная функция для получения названия чата
  const getChatDisplayName = (chat) => {
    if (!chat) return "";
    // Если есть явное имя (группа) - возвращаем его
    if (chat.name) return chat.name;
    
    // Если это приватный чат, ищем собеседника
    if (chat.participants && userProfile) {
      const other = chat.participants.find(p => p._id !== userProfile._id && p.id !== userProfile._id);
      if (other) return other.name || other.phone || "Неизвестный";
    }
    return "Чат";
  };

  // Вспомогательная функция для получения ID отправителя из сообщения
  const getSenderId = (msg) => {
     if (typeof msg.sender === 'object' && msg.sender !== null) {
         return msg.sender._id || msg.sender.id;
     }
     return msg.sender; // Если это string ID
  };

  const getSenderName = (msg) => {
      if (typeof msg.sender === 'object' && msg.sender !== null) {
          return msg.sender.name || msg.sender.phone;
      }
      // Если это просто ID и у нас нет объекта, пытаемся найти в participant'ах текущего канала
      if (channels) {
          const currentChat = channels.find(c => c._id === selectedChannel);
          if (currentChat && currentChat.participants) {
               const p = currentChat.participants.find(part => (part._id || part.id) === msg.sender);
               if (p) return p.name;
          }
      }
      return msg.sender; 
  };

  const themedPageStyle = {
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    color: '#ffffff',
  };

  return (
    <div style={themedPageStyle} className="govchat-page">
      {/* Мобильный header */}
      {isMobile && mobileHeader}
      {/* На мобильном — показываем кнопку видеозвонка справа сверху поверх header */}
      {isMobile && videoCallButton && (
        <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 8px)', right: 12, zIndex: 150 }}>
          {videoCallButton}
        </div>
      )}
      {/* Мобильное меню */}
      {isMobile && mobileMenuOpen && mobileMenu}
      {/* Сайдбар только на десктопе */}
      {!isMobile && desktopMenu}
      
      {/* Чат всегда на экране, но с отступом сверху на мобиле */}
      <div
        style={{
          ...chatStyles.chatContainer,
          ...(isMobile
            ? {
                paddingTop: `calc(56px + env(safe-area-inset-top))`, // учитываем высоту header + safe-area
                height: `calc(100vh - (56px + env(safe-area-inset-top)))`, // уменьшить высоту чата на мобильном
                maxHeight: `calc(100vh - (56px + env(safe-area-inset-top)))`,
              }
            : {}),
        }}
        className="govchat-chat-container"
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          marginBottom: 10,
          minHeight: 32,
          marginTop: isMobile ? 18 : 0 // добавлено для мобильных
        }}>
          <div style={chatStyles.chatTitle}>
             {selectedChannel ? getChatDisplayName(channels.find(c => c._id === selectedChannel)) : "Чат"}
          </div>
          {/* Кнопка видеозвонка справа от "Чат" */}
          <div style={{ marginLeft: "auto", marginRight: 8 }}>
            {!isMobile && videoCallButton}
          </div>
        </div>
        
        {/* Уведомление о видеозвонке */}
        {videoCallBanner}
        
        <div
          className="govchat-chat-box"
          style={themedChatBoxStyle}
        >
          {messages.map((msg) => {
            // Исправленная проверка "мое сообщение"
            const senderId = getSenderId(msg);
            const isMine = userProfile && (senderId === userProfile._id || senderId === userProfile.id);
            const senderName = getSenderName(msg); // Получаем имя для отображения

            // Формат времени
            const time = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            return (
              <div key={msg._id || Math.random()} style={chatStyles.messageRow(isMine)}>
                <div style={chatStyles.message(isMine)}>
                  {!isMine && (
                    <span style={chatStyles.messageSender}>
                      {senderName}:
                    </span>
                  )}
                  {msg.text}
                  {/* Превью файлов */}
                  {msg.fileUrl && msg.fileType && (
                    <span style={{ display: "block", marginTop: 8 }}>
                      {msg.fileType.startsWith("audio/") ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <audio src={resolveFileUrl(msg.fileUrl)} controls style={{ maxWidth: 220, borderRadius: 8, background: "#232526" }} />
                          <a href={resolveFileUrl(msg.fileUrl)} download style={{ color: '#00c3ff', fontSize: 13 }}>Скачать</a>
                        </div>
                      ) : msg.fileType.startsWith("image/") ? (
                        <img
                          src={resolveFileUrl(msg.fileUrl)}
                          alt={msg.originalName || "image"}
                          style={{ maxWidth: 120, maxHeight: 120, borderRadius: 8, cursor: "pointer", boxShadow: "0 2px 8px #00c3ff33" }}
                          onClick={() => setModalMedia({ type: "image", url: resolveFileUrl(msg.fileUrl), name: msg.originalName })}
                        />
                      ) : msg.fileType.startsWith("video/") ? (
                        <video
                          src={resolveFileUrl(msg.fileUrl)}
                          controls={true}
                          style={{ maxWidth: 120, maxHeight: 120, borderRadius: 8, cursor: "pointer", boxShadow: "0 2px 8px #00c3ff33" }}
                          onClick={() => setModalMedia({ type: "video", url: resolveFileUrl(msg.fileUrl), name: msg.originalName })}
                        >
                          Ваш браузер не поддерживает видео.
                        </video>
                      ) : (
                        // Превью для документов
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            cursor: "pointer",
                            background: "#232526",
                            borderRadius: 8,
                            padding: "8px 12px",
                            boxShadow: "0 2px 8px #00c3ff22",
                            maxWidth: 220,
                            minWidth: 0,
                            color: "#fff"
                          }}
                          onClick={() => {
                            // Определяем тип документа для предпросмотра
                            const ext = (msg.originalName || "").split('.').pop().toLowerCase();
                            if (msg.fileType === "application/pdf") {
                              setModalMedia({ type: "pdf", url: resolveFileUrl(msg.fileUrl), name: msg.originalName });
                            } else {
                              setModalMedia({ type: "doc", url: resolveFileUrl(msg.fileUrl), name: msg.originalName, ext });
                            }
                          }}
                          title={msg.originalName}
                        >
                          {/* Иконка документа по расширению */}
                          <span style={{ fontSize: 28 }}>
                            {(() => {
                              const ext = (msg.originalName || "").split('.').pop().toLowerCase();
                              if (ext === "pdf") return "📄";
                              if (["doc", "docx"].includes(ext)) return "📝";
                              if (["xls", "xlsx"].includes(ext)) return "📊";
                              if (["ppt", "pptx"].includes(ext)) return "📈";
                              if (["txt", "rtf"].includes(ext)) return "📃";
                              return "📁";
                            })()}
                          </span>
                          <span style={{
                            fontSize: 14,
                            color: "#fff",
                            wordBreak: "break-all",
                            flex: 1,
                            minWidth: 0,
                          }}>
                            {msg.originalName}
                          </span>
                        </span>
                      )}
                      {/* Кнопка скачать убрана отсюда */}
                    </span>
                  )}
                  {/* Время сообщения под текстом, меньшим шрифтом */}
                  <div style={{ color: "#b2bec3", fontSize: 11, marginTop: 4, textAlign: isMine ? "right" : "left" }}>
                    {time}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        {/* typing вынесен в отдельный flex-контейнер над inputRow */}
        <div style={{ minHeight: 22, display: "flex", alignItems: "flex-end", marginBottom: 2 }}>
          {typing && (
            <div style={{
              ...chatStyles.typing,
              margin: 0,
              paddingLeft: 8,
              paddingRight: 8,
              background: "none",
              borderRadius: 0,
              position: "relative",
              zIndex: 2,
              width: "fit-content",
              maxWidth: "80%",
              alignSelf: "flex-start",
              boxShadow: "none"
            }}>
              {typing}
            </div>
          )}
        </div>
        {/* Превью выбранного файла теперь над inputRow (и на мобильном, и на десктопе) */}
        {fileToSend && (
          <div
            style={{
              ...(isMobile
                ? {
                    position: "fixed",
                    left: 0,
                    right: 0,
                    bottom: 58,
                    zIndex: 1002,
                    background: "#35363a",
                    borderRadius: "12px 12px 0 0",
                    padding: "6px 8px 6px 8px", // уменьшили паддинги
                    maxWidth: "100vw",
                    width: "100vw",
                    display: "flex",
                    alignItems: "center",
                    gap: 10, // уменьшили gap
                    boxShadow: "0 -2px 12px #0005",
                    justifyContent: "flex-start",
                    minHeight: 44, // уменьшили высоту
                  }
                : {
                    margin: "0 0 8px 0",
                    padding: "6px 10px",
                    background: "#35363a",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    maxWidth: 320,
                  }),
              position: isMobile ? "fixed" : undefined,
            }}
          >
            {/* Кнопка крестика для отмены - на мобильном абсолютная слева */}
            {isMobile && (
              <button
                style={{
                  position: "absolute",
                  left: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#ff7675",
                  fontWeight: 700,
                  fontSize: 22,
                  cursor: "pointer",
                  padding: 0,
                  zIndex: 2,
                }}
                title="Удалить файл"
                onClick={() => {
                  setFileToSend(null);
                  setFilePreviewUrl(null);
                  if (fileInputRefChat.current) fileInputRefChat.current.value = "";
                }}
              >
                ✕
              </button>
            )}
            {/* Сдвигаем содержимое вправо если мобильный */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              marginLeft: isMobile ? 36 : 0, // отступ под крестик
            }}>
              {fileToSend.type.startsWith("image/") && filePreviewUrl && (
                <img
                  src={filePreviewUrl}
                  alt="preview"
                  style={{
                    maxWidth: isMobile ? 56 : 48, // уменьшили размер
                    maxHeight: isMobile ? 56 : 48,
                    borderRadius: 8,
                    objectFit: "cover",
                  }}
                />
              )}
              {fileToSend.type.startsWith("video/") && filePreviewUrl && (
                <video
                  src={filePreviewUrl}
                  style={{
                    maxWidth: isMobile ? 56 : 48,
                    maxHeight: isMobile ? 56 : 48,
                    borderRadius: 8,
                    objectFit: "cover",
                  }}
                  controls
                />
              )}
              {!fileToSend.type.startsWith("image/") && !fileToSend.type.startsWith("video/") && (
                <span role="img" aria-label="file" style={{ fontSize: isMobile ? 26 : 22 }}>📎</span>
              )}
              <span
                style={{
                  color: "#fff",
                  fontSize: isMobile ? 14 : 14,
                  wordBreak: "break-all",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {fileToSend.name}
              </span>
              {/* На десктопе крестик справа, на мобиле убираем */}
              {!isMobile && (
                <button
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "none",
                    color: "#ff7675",
                    fontWeight: 700,
                    fontSize: 16,
                    cursor: "pointer",
                    padding: 0,
                  }}
                  title="Удалить файл"
                  onClick={() => {
                    setFileToSend(null);
                    setFilePreviewUrl(null);
                    if (fileInputRefChat.current) fileInputRefChat.current.value = "";
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* --- Блок предпрослушивания и отправки голосового сообщения --- */}
        {audioBlob && audioUrl && (
          isMobile ? (
            <div style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 58, // чуть выше inputRow (учитываем высоту inputRow)
              zIndex: 1001,
              background: "#35363a",
              borderRadius: "12px 12px 0 0",
              padding: "10px 12px 10px 12px",
              maxWidth: "100vw",
              width: "100vw",
              display: "flex",
              alignItems: "center",
              gap: 10,
              boxShadow: "0 -2px 12px #0005",
              justifyContent: "center",
              minHeight: 48
            }}>
              <audio src={audioUrl} controls style={{ height: 28, maxWidth: 180, borderRadius: 8, background: "#232526" }} />
              <button
                style={{
                  background: "#ff7675",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: "pointer",
                  marginLeft: 4
                }}
                onClick={sendAudioMessage}
                title="Отправить голосовое"
              >
                ➤
              </button>
              <button
                style={{
                  background: "none",
                  color: "#ff7675",
                  border: "none",
                  fontWeight: 700,
                  fontSize: 20,
                  cursor: "pointer"
                }}
                title="Удалить запись"
                onClick={() => {
                  setAudioBlob(null);
                  setAudioUrl(null);
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              margin: "8px 0 0 0",
              background: "#35363a",
              borderRadius: 8,
              padding: "8px 16px",
              maxWidth: 420
            }}>
              <audio src={audioUrl} controls style={{ height: 32, maxWidth: 220, borderRadius: 8 }} />
              <button
                style={{
                  background: "#ff7675",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: "pointer",
                  marginLeft: 4
                }}
                onClick={sendAudioMessage}
                title="Отправить голосовое"
              >
                Отправить
              </button>
              <button
                style={{
                  background: "none",
                  color: "#ff7675",
                  border: "none",
                  fontWeight: 700,
                  fontSize: 18,
                  cursor: "pointer"
                }}
                title="Удалить запись"
                onClick={() => {
                  setAudioBlob(null);
                  setAudioUrl(null);
                }}
              >
                ✕
              </button>
            </div>
          )
        )}
        <div
          style={{
            ...chatStyles.inputRow,
            ...(isMobile ? { padding: "6px 2vw 6px 2vw" } : {}),
          }}
          className="govchat-input-row"
        >
          {/* Кнопка вложения */}
          <button
            style={{
              ...(attachBtnHover
                ? { ...chatStyles.attachBtn, ...chatStyles.attachBtnHover }
                : chatStyles.attachBtn),
              ...(isMobile
                ? {
                    width: 34,
                    height: 34,
                    minWidth:  34,
                    minHeight: 34,
                    fontSize: 18,
                    marginRight: 2,
                  }
                : {}),
            }}
            type="button"
            onClick={() => fileInputRefChat.current && fileInputRefChat.current.click()}
            title="Прикрепить файл"
            tabIndex={-1}
            onMouseEnter={() => setAttachBtnHover(true)}
            onMouseLeave={() => setAttachBtnHover(false)}
            disabled={false}
          >
            <span style={{
              color: "#222",
              fontSize: isMobile ? 18 : 22,
              display: "flex",
              alignItems: "center"
            }}>📎</span>
          </button>
          <input
            ref={fileInputRefChat}
            type="file"
            style={{ display: "none" }}
            onChange={e => {
              if (e.target.files?.[0]) setFileToSend(e.target.files[0]);
            }}
          />
          {/* Кнопка записи голосового (всегда показывать, уменьшить на мобиле) */}
          <button
            style={{
              ...chatStyles.attachBtn,
              background: recording ? "#ff7675" : "#fff",
              color: recording ? "#fff" : "#222",
              marginRight: 2,
              marginLeft: 0,
              border: recording ? "2px solid #ff7675" : "none",
              ...(isMobile
                ? {
                    width: 34,
                    height: 34,
                    minWidth: 34,
                    minHeight: 34,
                    fontSize: 18,
                  }
                : {}),
            }}
            type="button"
            onClick={() => {
              if (!recording) startRecording();
              else stopRecording();
            }}
            title={recording ? "Остановить запись" : "Записать голосовое"}
            disabled={fileToSend || audioBlob}
          >
            {recording ? (
              <span style={{
                color: "#fff",
                fontSize: isMobile ? 18 : 22,
                display: "flex",
                alignItems: "center"
              }}>⏺</span>
            ) : (
              <span style={{
                color: "#222",
                fontSize: isMobile ? 18 : 22,
                display: "flex",
                alignItems: "center"
              }}>🎤</span>
            )}
          </button>
          {/* Отображение времени записи */}
          {recording && (
            <span style={{
              color: "#ff7675",
              fontWeight: 600,
              minWidth: isMobile ? 28 : 40,
              fontSize: isMobile ? 13 : 16,
            }}>
              {`${Math.floor(recordTime / 60)
                .toString()
                .padStart(2, "0")}:${(recordTime % 60).toString().padStart(2, "0")}`}
            </span>
          )}
          {/* Поле ввода */}
          <input
            style={{
              ...chatStyles.input,
              ...(isMobile ? { fontSize: 14, padding: "8px 10px" } : {}),
            }}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (selectedChannel && !e.repeat) {
                // Emit start typing, backend handles broadcasting
                socketRef.current.emit("typing:start", { chatId: selectedChannel });
                // We should probably emit stop after some time or on blur, but keeping it simple
                // Maybe auto-stop on backend or just let it timeout on client?
                // For now, valid endpoint.
                
                if (e.key === "Enter") {
                    socketRef.current.emit("typing:stop", { chatId: selectedChannel });
                    handleSend();
                }
              }
            }}
            disabled={!selectedChannel}
            placeholder={
              selectedChannel
                ? "Введите сообщение..."

                : "Выберите канал"
            }
          />
          {/* Кнопка отправки */}
          <button
            style={{
              ...(isMobile
                ? {
                    background: "linear-gradient(90deg,#00c3ff,#3a7bd5)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    width: 34,
                    height: 34,
                    minWidth: 34,
                    minHeight: 34,
                    padding: 0,
                    fontSize: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 8px #00c3ff33",
                    marginLeft: 2,
                  }
                : chatStyles.sendBtn),
            }}
            onClick={handleSend}
            disabled={!selectedChannel || (!input.trim() && !fileToSend)}
            title="Отправить"
          >
            {isMobile
              ? <span style={{ fontSize: 18, color: "#fff" }}>➤</span>
              : "Отправить"}
          </button>
        </div>
        
        {/* Модальные окна видеозвонка */}
        {videoCallModal}
        
        {/* Модальное окно для просмотра фото/видео */}
        {modalMedia && (
          <div
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0,0,0,0.7)",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={() => setModalMedia(null)}
          >
            <div
              style={{
                background: "#232526",
                borderRadius: 12,
                padding: 24,
                maxWidth: "90vw",
                maxHeight: "90vh",
                boxShadow: "0 4px 32px #000a",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
              }}
              onClick={e => e.stopPropagation()}
            >
              <button
                style={{
                  position: "absolute",
                  top: 8,
                  right: 12,
                  background: "none",
                  border: "none",
                  color: "#fff",
                  fontSize: 28,
                  fontWeight: 700,
                  cursor: "pointer",
                  zIndex: 2,
                }}
                onClick={() => setModalMedia(null)}
                title="Закрыть"
              >✕</button>
              {modalMedia.type === "image" ? (
                <>
                  <img
                    src={modalMedia.url}
                    alt={modalMedia.name}
                    style={{ maxWidth: "70vw", maxHeight: "70vh", borderRadius: 10, marginBottom: 16 }}
                  />
                  {/* Название изображения над кнопкой скачать */}
                  {modalMedia.name && (
                    <div style={{
                      color: "#fff",
                      fontSize: 16,
                      marginBottom: 16,
                      wordBreak: "break-all",
                      textAlign: "center",
                      maxWidth: "60vw",
                    }}>
                      {modalMedia.name}
                    </div>
                  )}
                </>
              ) : modalMedia.type === "video" ? (
                <video
                  src={modalMedia.url}
                  controls
                  autoPlay
                  style={{ maxWidth: "70vw", maxHeight: "70vh", borderRadius: 10, marginBottom: 16, background: "#000" }}
                />
              ) : modalMedia.type === "pdf" ? (
                <iframe
                  src={modalMedia.url}
                  title={modalMedia.name}
                  style={{
                    width: "70vw",
                    height: "70vh",
                    border: "none",
                    borderRadius: 10,
                    background: "#fff",
                    marginBottom: 16,
                  }}
                />
              ) : modalMedia.type === "doc" ? (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 200,
                  minWidth: 200,
                  marginBottom: 16,
                }}>
                  <span style={{ fontSize: 64, marginBottom: 16 }}>
                    {(() => {
                      const ext = (modalMedia.ext || "").toLowerCase();
                      if (ext === "pdf") return "📄";
                      if (["doc", "docx"].includes(ext)) return "📝";
                      if (["xls", "xlsx"].includes(ext)) return "📊";
                      if (["ppt", "pptx"].includes(ext)) return "📈";
                      if (["txt", "rtf"].includes(ext)) return "📃";
                      return "📁";
                    })()}
                  </span>
                  <div style={{ color: "#fff", fontSize: 18, marginBottom: 8, wordBreak: "break-all", textAlign: "center" }}>
                    {modalMedia.name}
                  </div>
                  <div style={{ color: "#b2bec3", fontSize: 15, marginBottom: 18 }}>
                    Предпросмотр недоступен для этого типа файла
                  </div>
                </div>
              ) : null}
              <button
                style={{
                  background: "linear-gradient(90deg,#00c3ff,#3a7bd5)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 22px",
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px #00c3ff33",
                  textDecoration: "none",
                }}
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const response = await fetch(modalMedia.url, { credentials: "same-origin" });
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = modalMedia.name || "file";
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                      window.URL.revokeObjectURL(url);
                      a.remove();
                    }, 200);
                  } catch (err) {
                    alert("Ошибка скачивания файла");
                  }
                }}
              >
                Скачать
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Модальное окно профиля */}
      {showProfile && (
        <div
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.12)",
            zIndex: 99,
            transition: "background 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={handleProfilePopupBgClick}
        >
          <div
            style={{
              ...chatStyles.profilePopup,
              ...(isMobile
                ? {
                    position: "fixed",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "92vw",
                    maxWidth: 340,
                    minWidth: 0,
                    height: "auto",
                    maxHeight: "72vh",
                    minHeight: 240,
                    borderRadius: 18,
                    padding: "14px 8px 8px 8px",
                    boxShadow: "0 2px 16px #00c3ff33",
                    fontSize: 15,

                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-start",
                  }
                : {
                    transform: showProfile ? "translateY(0)" : "translateY(120%)",
                    opacity: showProfile ? 1 : 0,
                    pointerEvents: showProfile ? "auto" : "none",
                  }),
              transition: "transform 0.32s cubic-bezier(.4,1.4,.6,1), opacity 0.22s",
            }}
            className="govchat-profile-popup"
            onClick={e => e.stopPropagation()}
          >
            {/* Фиксированная шапка для мобильного */}
            {isMobile && (
              <div style={{
                position: "sticky",
                top: 0,
                left: 0,
                width: "100%",
                background: "#232526",
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 4px 0 0",
                minHeight: 36,
                marginBottom: 8,
              }}>
                <div style={{ fontWeight: 700, fontSize: 17, color: "#00c3ff", flex: 1, textAlign: "center" }}>
                  Профиль
                </div>
                {/* Крестик справа сверху */}
                <button
                  style={{
                    ...chatStyles.profileCloseBtn,
                    position: "static",
                    right: 0,
                    top: 0,
                    width: 32,
                    height: 32,
                    fontSize: 22,
                    marginRight: 4,
                    marginTop: 0,
                    marginBottom: 0,
                    background: "none",
                    color: "#b2bec3",
                    boxShadow: "none",
                  }}
                  onClick={() => setShowProfile(false)}
                  title="Закрыть"
                >✕</button>
              </div>
            )}
            {/* Новый аватар/значок профиля */}
            <div
              style={{
                ...chatStyles.profileAvatar,
                ...(isMobile
                  ? { width: 70, height: 70, margin: "8px auto 8px auto", fontSize: 36 }
                  : {}),
              }}
              className="govchat-profile-avatar"
            >
              <div
                style={{
                  position: "relative",
                  width: isMobile ? 70 : 90,
                  height: isMobile ? 70 : 90,
                  borderRadius: "50%",
                  overflow: "hidden",
                  cursor: "pointer",
                  border: "2px solid #00c3ff",
                  margin: "0 auto",
                  background: "#35363a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onClick={() => fileInputRefAvatar.current && fileInputRefAvatar.current.click()}
                title="Изменить фото"
              >
                {/* Показываем пользовательский аватар только если он есть и не дефолтный */}
                {userProfile?.avatarUrl &&
                  userProfile.avatarUrl !== "/uploads/avatar-default.png" ? (
                  <img
                    key={userProfile.avatarUrl + avatarVersion}
                    src={
                      userProfile.avatarUrl
                        ? userProfile.avatarUrl + "?t=" + avatarVersion
                        : "/uploads/avatar-default.png"
                    }
                    alt="avatar"
                    style={{
                      width: isMobile ? 70 : 90,
                      height: isMobile ? 70 : 90,
                      borderRadius: "50%",
                      objectFit: "cover",
                      display: "block",
                    }}
                    onError={e => {
                      e.target.onerror = null;
                      e.target.src =
                        `${window.location.protocol}//${window.location.hostname}:5000/uploads/avatar-default.png`;
                    }}
                  />
                ) : (
                  // Показываем дефолтную картинку, если нет пользовательской
                  <img
                    src={"/uploads/avatar-default.png"}
                    alt="avatar"
                    style={{
                      width: isMobile ? 70 : 90,
                      height: isMobile ? 70 : 90,
                      borderRadius: "50%",
                      objectFit: "cover",
                      display: "block",
                    }}
                    onError={e => {
                      e.target.onerror = null;
                      e.target.src =
                        "https://ui-avatars.com/api/?name=" +
                        encodeURIComponent(userProfile?.username || "U") +
                        "&background=00c3ff&color=fff&size=90";
                    }}
                  />
                )}
                <input
                  ref={fileInputRefAvatar}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async e => {
                    if (!e.target.files?.[0]) return;
                    const formData = new FormData();
                    formData.append("file", e.target.files[0]);
                    const uploadRes = await axios.post(
                      `${API_URL}/upload?avatar=1`,
                      formData,
                      {
                        headers: { Authorization: `Bearer ${token}` },
                      }
                    );
                    await axios.patch(
                      `${API_URL}/profile`,
                      { avatarUrl: uploadRes.data.url },
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                    const profileRes = await axios.get(`${API_URL}/profile`, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    setUserProfile(profileRes.data);
                    setAvatarVersion(Date.now());
                  }}
                />
              </div>
            </div>
            {/* Содержимое профиля с прокруткой */}
            <div style={{
              flex: 1,
              overflowY: "auto",
              minHeight: 0,
              marginBottom: 10,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              ...(isMobile ? { padding: "0 4px" } : {})
            }}>
              {userProfile && !editMode && (
                <>
                  {!isMobile && (
                    <div style={chatStyles.profileTitle} className="govchat-profile-title">Профиль</div>
                  )}
                  <div style={chatStyles.profileField}>
                    <span style={chatStyles.profileLabel}>Ник:</span> {userProfile.username}
                  </div>
                  <div style={chatStyles.profileField}>
                    <span style={chatStyles.profileLabel}>Возраст:</span> {userProfile.age ?? "—"}
                  </div>
                  <div style={chatStyles.profileField}>
                    <span style={chatStyles.profileLabel}>Город:</span> {userProfile.city ?? "—"}
                  </div>
                  <div style={chatStyles.profileField}>
                    <span style={chatStyles.profileLabel}>Семейный статус:</span> {userProfile.status ?? "—"}
                  </div>
                  {/* Кнопки теперь внутри скроллируемой области, сразу после информации */}
                  <div style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 18,
                    justifyContent: "flex-end",
                    flexWrap: isMobile ? "wrap" : "nowrap",
                  }}>
                    <button
                      style={{
                        ...chatStyles.profileEditBtn,
                        ...(isMobile ? { fontSize: 14, padding: "7px 12px" } : {})
                      }}
                      onClick={() => {
                        setEditData({
                          username: userProfile.username || "",
                          password: "",
                          city: userProfile.city || "",
                          status: userProfile.status || "",
                          age: userProfile.age || "",
                        });
                        setEditMode(true);
                      }}
                    >
                      Редактировать
                    </button>
                    <button
                      style={{
                        ...chatStyles.profileLogoutBtn,
                        ...(isMobile ? { fontSize: 14, padding: "7px 12px" } : {})
                      }}
                      onClick={() => {
                        localStorage.removeItem("token");
                        window.location.reload();
                      }}
                    >
                      Выйти
                    </button>
                  </div>
                </>
              )}
              {userProfile && editMode && (
                <>
                  {!isMobile && (
                    <div style={chatStyles.profileTitle}>Редактирование профиля</div>
                  )}
                  <div style={chatStyles.profileField}>
                    <span style={chatStyles.profileLabel}>Ник:</span>
                    <input
                      style={{
                        ...chatStyles.profileInput,
                        ...(isMobile ? { fontSize: 14, padding: "6px 8px" } : {})
                      }}
                      value={editData.username}
                      onChange={e => setEditData(d => ({ ...d, username: e.target.value }))}
                    />
                  </div>
                  <div style={chatStyles.profileField}>
                    <span style={chatStyles.profileLabel}>Пароль:</span>
                    <input
                      style={{
                        ...chatStyles.profileInput,
                        ...(isMobile ? { fontSize: 14, padding: "6px 8px" } : {})
                      }}
                      type="password"
                      value={editData.password}
                      placeholder="Новый пароль"
                      onChange={e => setEditData(d => ({ ...d, password: e.target.value }))}
                    />
                  </div>
                  <div style={chatStyles.profileField}>
                    <span style={chatStyles.profileLabel}>Возраст:</span>
                    <input
                      style={{
                        ...chatStyles.profileInput,
                        ...(isMobile ? { fontSize: 14, padding: "6px 8px" } : {})
                      }}
                      type="number"
                      min={0}
                      value={editData.age}
                      onChange={e => setEditData(d => ({ ...d, age: e.target.value }))}
                    />
                  </div>
                  <div style={chatStyles.profileField}>
                    <span style={chatStyles.profileLabel}>Город:</span>
                    <input
                      style={{
                        ...chatStyles.profileInput,
                        ...(isMobile ? { fontSize: 14, padding: "6px 8px" } : {})
                      }}
                      value={editData.city}
                      onChange={e => setEditData(d => ({ ...d, city: e.target.value }))}
                    />
                  </div>
                  <div style={chatStyles.profileField}>
                    <span style={chatStyles.profileLabel}>Семейный статус:</span>
                    <input
                      style={{
                        ...chatStyles.profileInput,
                        ...(isMobile ? { fontSize: 14, padding: "6px 8px" } : {})
                      }}
                      value={editData.status}
                      onChange={e => setEditData(d => ({ ...d, status: e.target.value }))}
                    />
                  </div>
                  {/* Кнопки теперь внутри скроллируемой области, сразу после полей */}
                  <div style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 10,
                    justifyContent: "flex-end",
                    flexWrap: isMobile ? "wrap" : "nowrap",
                  }}>
                    <button
                      style={{
                        ...chatStyles.profileEditBtn,
                        ...(isMobile ? { fontSize: 14, padding: "7px 12px" } : {})
                      }}
                      onClick={handleProfileSave}
                    >
                      Сохранить
                    </button>
                    <button
                      style={{
                        ...chatStyles.profileCloseBtn,
                        position: "static",
                        width: "auto",
                        height: "auto",
                        fontSize: isMobile ? 14 : 15,
                        marginLeft: 0,
                        marginTop: 0,
                        marginBottom: 0,
                        background: "#35363a",
                        color: "#b2bec3",
                        boxShadow: "0 2px 8px #0002",
                        ...(isMobile ? { padding: "7px 12px" } : {})
                      }}
                      onClick={() => setEditMode(false)}
                    >
                      Отмена
                    </button>
                  </div>
                </>
              )}
              {!userProfile && (
                <div style={{ color: "#b2bec3", marginBottom: 8 }}>Загрузка...</div>
              )}
            </div>
            {/* Кнопки убраны из нижней части popup */}
          </div>
        </div>
      )}
      {/* Модальное окно кастомизации */}
      {showCustomizer && (
        <div
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.12)",
            zIndex: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowCustomizer(false)}
        >
          <div
            style={{
              background: "#232526",
              borderRadius: 16,
              boxShadow: "0 2px 16px #00c3ff33",
              padding: "32px 32px 24px 32px",
              minWidth: 320,
              maxWidth: 420,
              zIndex: 121,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative",
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              style={{
                position: "absolute",
                top: 10,
                right: 16,
                background: "none",
                color: "#b2bec3",
                border: "none",
                borderRadius: "50%",
                width: 32,
                height: 32,
                fontSize: 22,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.2s, color 0.2s",
                zIndex: 122,
              }}
              onClick={() => setShowCustomizer(false)}
              title="Закрыть"
            >✕</button>
            <div style={{ fontWeight: 700, fontSize: 20, color: "#ffb347", marginBottom: 18 }}>
              Кастомизация оформления
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}>
              {chatStyles.themes.map((t) => (
                <button
                  key={t.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    width: "100%",
                    background: t.pageBg,
                    border: theme.name === t.name ? "2px solid #00c3ff" : "2px solid transparent",
                    borderRadius: 10,
                    padding: "12px 18px",
                    cursor: "pointer",
                    color: "#222",
                    fontWeight: 600,
                    fontSize: 16,
                    boxShadow: theme.name === t.name ? "0 2px 12px #00c3ff44" : "0 2px 8px #0002",
                    transition: "border 0.2s, box-shadow 0.2s",
                  }}
                  onClick={() => handleThemeSelect(t)}
                >
                  <span style={{
                    width: 32, height: 32, borderRadius: 8, background: t.chatBg,
                    border: "1.5px solid #fff", display: "inline-block", marginRight: 8
                  }} />
                  <span style={{ color: "#fff", textShadow: "0 1px 4px #0005" }}>{t.name}</span>
                  {theme.name === t.name && (
                    <span style={{ marginLeft: "auto", color: "#00c3ff", fontSize: 22 }}>✔</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;