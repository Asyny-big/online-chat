import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { API_URL } from '../config';

/**
 * GroupCallModal - Компонент для групповых видео/аудио звонков (Discord-like UX)
 * Использует mesh-топологию WebRTC (каждый участник соединён с каждым)
 * 
 * Основные особенности:
 * - Main video (pinned/active speaker) + preview strip
 * - Active speaker detection через AudioContext (клиентская сторона)
 * - Bitrate control для оптимизации mesh до 10 участников
 * - Android WebView compatible
 * 
 * АРХИТЕКТУРА СТРИМОВ (streams-first):
 * - localStreamRef: ТОЛЬКО локальный поток (никогда не в общей map)
 * - remoteStreamsRef: Map<userId, MediaStream> — ТОЛЬКО remote потоки
 * - UI рендерится по наличию MediaStream, НЕ по participants
 * - ontrack использует addTrack паттерн, а не замену стрима
 */
function GroupCallModal({
  socket,
  callId,
  chatId,
  chatName,
  callType,
  isIncoming,
  initiator,
  existingParticipants = [],
  currentUserId,
  token,
  onClose,
  onJoin
}) {
  // ===== СОСТОЯНИЯ =====
  const [callStatus, setCallStatus] = useState(isIncoming ? 'incoming' : 'connecting');
  // participants хранит ТОЛЬКО метаданные (userId, userName), БЕЗ stream
  const [participants, setParticipants] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [iceServers, setIceServers] = useState([]);
  // Счётчик обновлений стримов для trigger ререндера
  const [streamUpdateCounter, setStreamUpdateCounter] = useState(0);
  
  // Discord-like UX состояния
  const [pinnedUserId, setPinnedUserId] = useState(null); // Закреплённый пользователь
  const [activeSpeakerId, setActiveSpeakerId] = useState(null); // Активный говорящий
  const [audioLevels, setAudioLevels] = useState({}); // { userId: volume }

  // ===== REFS =====
  const localVideoRef = useRef(null); // Для main video (локальное)
  const localPreviewVideoRef = useRef(null); // Для preview strip (локальное) - ОТДЕЛЬНЫЙ ref!
  const mainVideoRef = useRef(null); // Главное видео (remote)
  const peerConnectionsRef = useRef({}); // { oderId: RTCPeerConnection }
  const remoteStreamsRef = useRef(new Map()); // Map<oderId, MediaStream> - remote ТОЛЬКО
  const pendingCandidatesRef = useRef({}); // { oderId: ICECandidate[] }
  const ringtoneRef = useRef(null);
  const callIdRef = useRef(callId);
  const localStreamRef = useRef(null); // Локальный поток - ОТДЕЛЬНО от remoteStreamsRef
  
  // Active speaker detection refs
  const audioContextRef = useRef(null);
  const analysersRef = useRef({}); // { userId: AnalyserNode }
  const activeSpeakerTimerRef = useRef(null);
  const lastActiveSpeakerRef = useRef(null);

  // ===== UTILITY FUNCTIONS =====
  
  // Обновляем ref при изменении callId
  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);

  // Определение главного видео (pinned или active speaker)
  // ВАЖНО: возвращает userId ТОЛЬКО если у него есть реальный stream
  const getMainUserId = useCallback(() => {
    // Если закреплён пользователь И у него есть stream — показываем его
    if (pinnedUserId && remoteStreamsRef.current.has(pinnedUserId)) {
      return pinnedUserId;
    }
    // Если есть активный говорящий с реальным stream
    if (activeSpeakerId && activeSpeakerId !== currentUserId && remoteStreamsRef.current.has(activeSpeakerId)) {
      return activeSpeakerId;
    }
    // По умолчанию показываем локальное видео (null = local)
    return null;
  }, [pinnedUserId, activeSpeakerId, currentUserId]);

  // Установка bitrate для sender'а
  const setBitrate = useCallback(async (sender, maxBitrate, maxFramerate) => {
    const parameters = sender.getParameters();
    
    if (!parameters.encodings || parameters.encodings.length === 0) {
      parameters.encodings = [{}];
    }
    
    parameters.encodings[0].maxBitrate = maxBitrate * 1000; // kbps -> bps
    if (maxFramerate) {
      parameters.encodings[0].maxFramerate = maxFramerate;
    }
    
    try {
      await sender.setParameters(parameters);
    } catch (err) {
      console.warn('[GroupCall] Failed to set bitrate:', err);
    }
  }, []);

  // Применение bitrate к PeerConnection
  const applyBitrateSettings = useCallback(async (pc, isMainVideo = false) => {
    const senders = pc.getSenders();
    
    for (const sender of senders) {
      if (sender.track?.kind === 'video') {
        if (isMainVideo) {
          // Главное видео: высокое качество
          await setBitrate(sender, 2000, 30); // 2 Mbps, 30 fps
        } else {
          // Preview: низкое качество
          await setBitrate(sender, 300, 15); // 300 kbps, 15 fps
        }
      }
    }
  }, [setBitrate]);

  // ===== ACTIVE SPEAKER DETECTION =====
  
  // Инициализация анализатора аудио для потока
  const setupAudioAnalyser = useCallback((stream, userId) => {
    if (!audioContextRef.current) {
      // Создаём AudioContext (совместимо с Android WebView)
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const audioContext = audioContextRef.current;
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analysersRef.current[userId] = analyser;
    }
  }, []);

  // Подсчёт громкости (RMS)
  const getAudioVolume = useCallback((analyser) => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    return sum / dataArray.length;
  }, []);

  // Обновление активного говорящего (throttled)
  useEffect(() => {
    if (callStatus !== 'active') return;
    
    const interval = setInterval(() => {
      const volumes = {};
      
      // Проверяем локальное аудио
      if (analysersRef.current[currentUserId] && !isMuted) {
        volumes[currentUserId] = getAudioVolume(analysersRef.current[currentUserId]);
      }
      
      // Проверяем удалённые потоки
      Object.keys(analysersRef.current).forEach(userId => {
        if (userId !== currentUserId) {
          volumes[userId] = getAudioVolume(analysersRef.current[userId]);
        }
      });
      
      setAudioLevels(volumes);
      
      // Определяем самого громкого (порог > 20)
      let maxVolume = 20;
      let loudestUser = null;
      
      Object.entries(volumes).forEach(([userId, volume]) => {
        if (volume > maxVolume) {
          maxVolume = volume;
          loudestUser = userId;
        }
      });
      
      // Обновляем активного говорящего только если изменился
      if (loudestUser && loudestUser !== lastActiveSpeakerRef.current) {
        lastActiveSpeakerRef.current = loudestUser;
        setActiveSpeakerId(loudestUser);
      } else if (!loudestUser && lastActiveSpeakerRef.current) {
        // Сбрасываем через 2 секунды молчания
        clearTimeout(activeSpeakerTimerRef.current);
        activeSpeakerTimerRef.current = setTimeout(() => {
          lastActiveSpeakerRef.current = null;
          setActiveSpeakerId(null);
        }, 2000);
      }
    }, 400); // Обновление каждые 400ms
    
    return () => clearInterval(interval);
  }, [callStatus, currentUserId, isMuted, getAudioVolume]);

  // ===== ICE SERVERS =====
  
  // Получение ICE серверов
  useEffect(() => {
    const fetchIceServers = async () => {
      try {
        const res = await fetch(`${API_URL}/webrtc/ice`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setIceServers(data.iceServers || []);
      } catch (err) {
        console.error('[GroupCall] Failed to fetch ICE servers:', err);
        // Fallback к публичным STUN серверам
        setIceServers([
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]);
      }
    };
    fetchIceServers();
  }, [token]);

  // Воспроизведение рингтона для входящего звонка
  useEffect(() => {
    if (isIncoming && callStatus === 'incoming') {
      try {
        ringtoneRef.current = new Audio('/sounds/ringtone.mp3');
        ringtoneRef.current.loop = true;
        ringtoneRef.current.play().catch(() => {});
      } catch (e) {}
    }
    return () => {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current = null;
      }
    };
  }, [isIncoming, callStatus]);

  // ===== LOCAL STREAM =====
  
  // Получение локального медиа-потока
  const getLocalStream = useCallback(async () => {
    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: callType === 'video' ? { 
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: 'user'
        } : false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      localStreamRef.current = stream;
      
      // Настраиваем анализатор для локального аудио
      setupAudioAnalyser(stream, currentUserId);
      
      // Привязываем к ОБОИМ video refs (main и preview)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      if (localPreviewVideoRef.current) {
        localPreviewVideoRef.current.srcObject = stream;
      }
      
      return stream;
    } catch (err) {
      console.error('[GroupCall] Failed to get local stream:', err);
      alert('Не удалось получить доступ к камере/микрофону');
      return null;
    }
  }, [callType, currentUserId, setupAudioAnalyser]);

  // Синхронизация localStream с video refs при изменении layout
  useEffect(() => {
    if (localStream) {
      if (localVideoRef.current && !localVideoRef.current.srcObject) {
        localVideoRef.current.srcObject = localStream;
      }
      if (localPreviewVideoRef.current && !localPreviewVideoRef.current.srcObject) {
        localPreviewVideoRef.current.srcObject = localStream;
      }
    }
  }, [localStream, streamUpdateCounter]); // используем streamUpdateCounter для триггера ререндера вместо isLocalMain

  // ===== PEER CONNECTION =====
  
  // Создание PeerConnection для участника
  const createPeerConnection = useCallback((oderId, isInitiator = false) => {
    if (peerConnectionsRef.current[oderId]) {
      console.log('[GroupCall] PeerConnection already exists for:', oderId);
      return peerConnectionsRef.current[oderId];
    }

    console.log('[GroupCall] Creating PeerConnection for:', oderId, 'isInitiator:', isInitiator);
    
    const pc = new RTCPeerConnection({ iceServers });

    // Добавляем локальные треки
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Применяем начальные bitrate настройки (preview quality)
    setTimeout(() => applyBitrateSettings(pc, false), 100);

    // ICE кандидаты
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('group-call:signal', {
          callId: callIdRef.current,
          oderId,
          signal: {
            type: 'ice-candidate',
            candidate: event.candidate
          }
        });
      }
    };

    // Получение удалённого потока (addTrack паттерн)
    pc.ontrack = (event) => {
      console.log('[GroupCall] Received remote track from:', oderId, 'kind:', event.track?.kind);

      // Гарантируем метаданные участника для UI (иначе stream есть, но не рендерится)
      if (oderId !== currentUserId) {
        setParticipants(prev => {
          if (!prev.find(p => p.oderId === oderId)) {
            return [...prev, { oderId, userName: 'Участник' }];
          }
          return prev;
        });
      }
      
      // Получаем или создаём MediaStream для этого пользователя
      let remoteStream = remoteStreamsRef.current.get(oderId);
      if (!remoteStream) {
        remoteStream = new MediaStream();
        remoteStreamsRef.current.set(oderId, remoteStream);
        console.log('[GroupCall] Created new MediaStream for:', oderId);
      }
      
      // Добавляем трек в существующий стрим (не заменяем стрим целиком!)
      const track = event.track;
      if (track) {
        // Проверяем, нет ли уже такого трека
        const existingTrack = remoteStream.getTracks().find(t => t.id === track.id);
        if (!existingTrack) {
          remoteStream.addTrack(track);
          console.log('[GroupCall] Added track to stream:', oderId, track.kind);
        }
        
        // Обработка удаления трека
        track.onended = () => {
          console.log('[GroupCall] Track ended:', oderId, track.kind);
          remoteStream.removeTrack(track);
        };
      }
      
      // Настраиваем анализатор аудио (только один раз для audio)
      if (event.track?.kind === 'audio' && !analysersRef.current[oderId]) {
        setupAudioAnalyser(remoteStream, oderId);
      }
      
      // Trigger ререндер UI
      setStreamUpdateCounter(prev => prev + 1);
    };

    // Состояние соединения
    pc.onconnectionstatechange = () => {
      console.log('[GroupCall] Connection state for', oderId, ':', pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.log('[GroupCall] Connection failed/disconnected for:', oderId);
      }
    };

    peerConnectionsRef.current[oderId] = pc;

    // Применяем отложенные ICE кандидаты
    if (pendingCandidatesRef.current[oderId]) {
      pendingCandidatesRef.current[oderId].forEach(candidate => {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
          console.error('[GroupCall] Error adding pending ICE candidate:', err);
        });
      });
      delete pendingCandidatesRef.current[oderId];
    }

    return pc;
  }, [iceServers, socket, applyBitrateSettings, setupAudioAnalyser]);

  // ===== BITRATE OPTIMIZATION =====
  
  // Обновление bitrate при изменении главного видео
  useEffect(() => {
    const mainUserId = getMainUserId();
    
    Object.entries(peerConnectionsRef.current).forEach(([oderId, pc]) => {
      const isMain = oderId === mainUserId;
      applyBitrateSettings(pc, isMain);
    });
  }, [pinnedUserId, activeSpeakerId, getMainUserId, applyBitrateSettings]);

  // ===== SIGNALING =====
  
  // Отправка offer новому участнику
  const sendOffer = useCallback(async (oderId) => {
    const pc = createPeerConnection(oderId, true);
    
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socket.emit('group-call:signal', {
        callId: callIdRef.current,
        oderId,
        signal: {
          type: 'offer',
          sdp: pc.localDescription
        }
      });
      console.log('[GroupCall] Sent offer to:', oderId);
    } catch (err) {
      console.error('[GroupCall] Error creating offer:', err);
    }
  }, [createPeerConnection, socket]);

  // Обработка входящего сигнала
  const handleSignal = useCallback(async ({ fromUserId, signal }) => {
    console.log('[GroupCall] Received signal from:', fromUserId, signal.type);

    // Если это существующий участник (инициатор/раньше подключившийся), но мы не получили
    // group-call:participant-joined, добавляем его в participants, иначе UI не покажет stream.
    if (fromUserId && fromUserId !== currentUserId) {
      setParticipants(prev => {
        if (!prev.find(p => p.oderId === fromUserId)) {
          return [...prev, { oderId: fromUserId, userName: 'Участник' }];
        }
        return prev;
      });
    }

    if (signal.type === 'offer') {
      const pc = createPeerConnection(fromUserId, false);
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        socket.emit('group-call:signal', {
          callId: callIdRef.current,
          oderId: fromUserId,
          signal: {
            type: 'answer',
            sdp: pc.localDescription
          }
        });
        console.log('[GroupCall] Sent answer to:', fromUserId);
      } catch (err) {
        console.error('[GroupCall] Error handling offer:', err);
      }
    } else if (signal.type === 'answer') {
      const pc = peerConnectionsRef.current[fromUserId];
      if (pc && pc.signalingState !== 'stable') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          console.log('[GroupCall] Set remote answer from:', fromUserId);
        } catch (err) {
          console.error('[GroupCall] Error setting remote answer:', err);
        }
      }
    } else if (signal.type === 'ice-candidate') {
      const pc = peerConnectionsRef.current[fromUserId];
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (err) {
          console.error('[GroupCall] Error adding ICE candidate:', err);
        }
      } else {
        // Откладываем кандидата до установки remote description
        if (!pendingCandidatesRef.current[fromUserId]) {
          pendingCandidatesRef.current[fromUserId] = [];
        }
        pendingCandidatesRef.current[fromUserId].push(signal.candidate);
      }
    }
  }, [createPeerConnection, socket]);

  // Присоединение к звонку
  const joinCall = useCallback(async () => {
    setCallStatus('connecting');
    
    // Останавливаем рингтон
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current = null;
    }

    // Получаем локальный поток
    const stream = await getLocalStream();
    if (!stream) {
      onClose();
      return;
    }

    // Уведомляем сервер о присоединении
    socket.emit('group-call:join', {
      callId: callIdRef.current,
      chatId
    }, (response) => {
      if (response.error) {
        console.error('[GroupCall] Error joining call:', response.error);
        alert(response.error);
        onClose();
        return;
      }

      console.log('[GroupCall] Joined call, existing participants:', response.participants);
      setCallStatus('active');

      // ВАЖНО: заполняем participants существующими участниками, иначе поздно вошедший
      // будет видеть только себя (streams приходят, но не рендерятся без метаданных).
      if (response.participants && response.participants.length > 0) {
        setParticipants(prev => {
          const merged = [...prev];
          response.participants.forEach(p => {
            if (!p?.oderId || p.oderId === currentUserId) return;
            if (!merged.find(x => x.oderId === p.oderId)) {
              merged.push({ oderId: p.oderId, userName: p.userName || 'Участник' });
            }
          });
          return merged;
        });
      }
      
      // Создаём соединения с существующими участниками
      if (response.participants && response.participants.length > 0) {
        response.participants.forEach(p => {
          if (p.oderId !== currentUserId) {
            // Отправляем offer каждому существующему участнику
            sendOffer(p.oderId);
          }
        });
      }
    });
  }, [getLocalStream, socket, chatId, currentUserId, sendOffer, onClose]);

  // Начало звонка (для инициатора)
  const startCall = useCallback(async () => {
    setCallStatus('connecting');

    const stream = await getLocalStream();
    if (!stream) {
      onClose();
      return;
    }

    setCallStatus('active');
    onJoin?.();
  }, [getLocalStream, onClose, onJoin]);

  // Автоматический запуск для не-входящих звонков
  useEffect(() => {
    if (!isIncoming && callStatus === 'connecting') {
      startCall();
    }
  }, [isIncoming, callStatus, startCall]);

  // ===== CLEANUP =====
  // ВАЖНО: cleanup должен быть объявлен ДО useEffect/socket handlers.
  // Иначе ссылка на cleanup в dependency array попадает в TDZ и в production build падает
  // с ошибкой вида: "Cannot access '<minified>' before initialization".
  const cleanup = useCallback(() => {
    // Останавливаем локальный поток
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Останавливаем screen sharing
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
    }

    // Закрываем все peer connections
    Object.values(peerConnectionsRef.current).forEach(pc => {
      pc.close();
    });
    peerConnectionsRef.current = {};
    
    // Останавливаем и очищаем все remote streams
    remoteStreamsRef.current.forEach((stream) => {
      stream.getTracks().forEach(track => track.stop());
    });
    remoteStreamsRef.current = new Map();

    // Очищаем audio analysers
    analysersRef.current = {};
    
    // Закрываем AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Останавливаем рингтон
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current = null;
    }
    
    // Очищаем таймеры
    if (activeSpeakerTimerRef.current) {
      clearTimeout(activeSpeakerTimerRef.current);
    }
  }, [screenStream]);

  // Socket обработчики
  useEffect(() => {
    if (!socket) return;

    // Новый участник присоединился
    const handleParticipantJoined = ({ oderId, userName }) => {
      console.log('[GroupCall] Participant joined:', oderId, userName);
      if (oderId !== currentUserId) {
        // Добавляем в participants ТОЛЬКО метаданные (БЕЗ stream)
        // Stream будет получен через ontrack
        setParticipants(prev => {
          if (!prev.find(p => p.oderId === oderId)) {
            return [...prev, { oderId, userName }];
          }
          return prev;
        });
      }
    };

    // Участник покинул звонок
    const handleParticipantLeft = ({ oderId }) => {
      console.log('[GroupCall] Participant left:', oderId);
      
      // Закрываем соединение
      const pc = peerConnectionsRef.current[oderId];
      if (pc) {
        pc.close();
        delete peerConnectionsRef.current[oderId];
      }
      
      // Удаляем stream
      const stream = remoteStreamsRef.current.get(oderId);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        remoteStreamsRef.current.delete(oderId);
      }
      
      // Удаляем audio analyser
      delete analysersRef.current[oderId];
      
      // Удаляем из участников
      setParticipants(prev => prev.filter(p => p.oderId !== oderId));
      
      // Trigger ререндер
      setStreamUpdateCounter(prev => prev + 1);
      
      // Сбрасываем pinned если это был он
      if (pinnedUserId === oderId) {
        setPinnedUserId(null);
      }
    };

    // Входящий сигнал
    const handleIncomingSignal = (data) => {
      if (data.callId === callIdRef.current) {
        handleSignal(data);
      }
    };

    // Звонок завершён
    const handleCallEnded = ({ callId: endedCallId, reason }) => {
      if (endedCallId === callIdRef.current) {
        console.log('[GroupCall] Call ended:', reason);
        cleanup();
        onClose();
      }
    };

    socket.on('group-call:participant-joined', handleParticipantJoined);
    socket.on('group-call:participant-left', handleParticipantLeft);
    socket.on('group-call:signal', handleIncomingSignal);
    socket.on('group-call:ended', handleCallEnded);

    return () => {
      socket.off('group-call:participant-joined', handleParticipantJoined);
      socket.off('group-call:participant-left', handleParticipantLeft);
      socket.off('group-call:signal', handleIncomingSignal);
      socket.off('group-call:ended', handleCallEnded);
    };
  }, [socket, currentUserId, callStatus, handleSignal, onClose, cleanup, pinnedUserId]);

  // Завершение звонка
  const handleEndCall = useCallback(() => {
    socket.emit('group-call:leave', { callId: callIdRef.current });
    cleanup();
    onClose();
  }, [socket, cleanup, onClose]);

  // Отклонение входящего звонка
  const handleDecline = useCallback(() => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current = null;
    }
    onClose();
  }, [onClose]);

  // Переключение микрофона
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // Переключение камеры
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, []);

  // Screen sharing
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Останавливаем screen sharing
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
      }
      
      // Возвращаем видео с камеры
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          Object.values(peerConnectionsRef.current).forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(videoTrack);
            }
          });
        }
      }
      
      setIsScreenSharing(false);
      socket.emit('group-call:screen-share', { 
        callId: callIdRef.current, 
        isSharing: false 
      });
    } else {
      // Начинаем screen sharing
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: false
        });
        
        setScreenStream(stream);
        const screenTrack = stream.getVideoTracks()[0];
        
        // Заменяем видео трек во всех соединениях
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });
        
        // Обработка завершения screen sharing пользователем
        screenTrack.onended = () => {
          toggleScreenShare();
        };
        
        setIsScreenSharing(true);
        socket.emit('group-call:screen-share', { 
          callId: callIdRef.current, 
          isSharing: true 
        });
      } catch (err) {
        console.error('[GroupCall] Screen share error:', err);
      }
    }
  }, [isScreenSharing, screenStream, socket]);

  // Cleanup при unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // ===== RENDER =====

  // Получаем список remote участников с РЕАЛЬНЫМИ стримами
  // useMemo + streamUpdateCounter для ререндера при обновлении стримов
  // ВАЖНО: этот hook должен вызываться всегда (иначе React #310 при смене callStatus)
  const remoteParticipantsWithStreams = useMemo(() => {
    // Триггер зависимости от streamUpdateCounter (не используется напрямую)
    void streamUpdateCounter;

    return participants
      .filter(p => p.oderId !== currentUserId)
      .map(p => ({
        ...p,
        stream: remoteStreamsRef.current.get(p.oderId) || null,
        hasStream: remoteStreamsRef.current.has(p.oderId)
      }));
  }, [participants, currentUserId, streamUpdateCounter]);

  // Определяем главного участника (ТОЛЬКО если есть реальный stream)
  const mainUserId = getMainUserId();
  const mainRemoteStream = mainUserId ? remoteStreamsRef.current.get(mainUserId) : null;
  const mainParticipant = mainUserId
    ? remoteParticipantsWithStreams.find(p => p.oderId === mainUserId)
    : null;
  const isLocalMain = mainUserId === null; // Если null - показываем локальное видео

  // Все remote участники для preview strip (кроме главного)
  const remotePreviewParticipants = remoteParticipantsWithStreams.filter(p => p.oderId !== mainUserId);

  // Формируем preview list
  // Если локальное видео главное - показываем только remote в превью
  // Если remote главное - добавляем локальное видео в превью
  const showLocalInPreview = !isLocalMain && localStream;

  // Общее количество участников (для UI)
  const totalParticipants = remoteParticipantsWithStreams.filter(p => p.hasStream).length + 1;
  
  // Рендер входящего звонка
  if (callStatus === 'incoming') {
    return (
      <div style={styles.overlay}>
        <div style={styles.incomingModal}>
          <div style={styles.incomingIcon}>👥</div>
          <h2 style={styles.incomingTitle}>Групповой звонок</h2>
          <p style={styles.incomingSubtitle}>{chatName}</p>
          <p style={styles.incomingCaller}>
            {initiator?.name || 'Участник'} начал {callType === 'video' ? 'видео' : 'аудио'} звонок
          </p>
          
          <div style={styles.incomingActions}>
            <button onClick={handleDecline} style={styles.declineBtn}>
              <span>✕</span>
              <span style={styles.btnLabel}>Отклонить</span>
            </button>
            <button onClick={joinCall} style={styles.acceptBtn}>
              <span>{callType === 'video' ? '🎥' : '📞'}</span>
              <span style={styles.btnLabel}>Присоединиться</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== DISCORD-LIKE LAYOUT =====

  // Рендер активного звонка (Discord UX)
  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Заголовок */}
        <div style={styles.header}>
          <div style={styles.headerInfo}>
            <span style={styles.headerIcon}>👥</span>
            <div>
              <h3 style={styles.chatName}>{chatName}</h3>
              <p style={styles.participantCount}>
                {totalParticipants} участник(ов)
              </p>
            </div>
          </div>
          <div style={styles.callStatus}>
            {callStatus === 'connecting' ? '🔄 Подключение...' : '🟢 В звонке'}
          </div>
        </div>

        {/* MAIN VIDEO - Главное видео (60-75% экрана) */}
        <div style={styles.mainVideoContainer}>
          {isLocalMain ? (
            // Локальное видео как главное (ВСЕГДА показываем, если мы одни или выбраны)
            <div style={styles.mainVideoWrapper}>
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  ...styles.mainVideo,
                  ...(isVideoOff ? styles.videoHidden : {})
                }}
              />
              {isVideoOff && (
                <div style={styles.mainVideoPlaceholder}>
                  <span style={styles.mainVideoAvatar}>👤</span>
                  <p style={styles.mainVideoName}>Вы</p>
                </div>
              )}
              <div style={styles.mainVideoLabel}>
                Вы {isScreenSharing && '(Демонстрация экрана)'}
              </div>
              {isMuted && <div style={styles.mainMutedIndicator}>🔇</div>}
            </div>
          ) : mainRemoteStream && mainParticipant ? (
            // Удалённое видео как главное (ТОЛЬКО если есть реальный stream)
            <div 
              style={{
                ...styles.mainVideoWrapper,
                ...(mainParticipant.oderId === activeSpeakerId ? styles.activeSpeaker : {})
              }}
            >
              <MainVideoPlayer 
                stream={mainRemoteStream} 
                ref={mainVideoRef}
              />
              <div style={styles.mainVideoLabel}>
                {mainParticipant.userName || 'Участник'}
                {mainParticipant.oderId === pinnedUserId && ' 📌'}
              </div>
              {mainParticipant.oderId === activeSpeakerId && (
                <div style={styles.activeSpeakerBorder} />
              )}
              {/* Кнопка открепления */}
              {pinnedUserId === mainParticipant.oderId && (
                <button 
                  onClick={() => setPinnedUserId(null)}
                  style={styles.unpinBtn}
                  title="Открепить"
                >
                  ✕
                </button>
              )}
            </div>
          ) : (
            // Fallback: показываем локальное видео если remote недоступен
            <div style={styles.mainVideoWrapper}>
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  ...styles.mainVideo,
                  ...(isVideoOff ? styles.videoHidden : {})
                }}
              />
              {isVideoOff && (
                <div style={styles.mainVideoPlaceholder}>
                  <span style={styles.mainVideoAvatar}>👤</span>
                  <p style={styles.mainVideoName}>Вы</p>
                </div>
              )}
              <div style={styles.mainVideoLabel}>
                Вы {isScreenSharing && '(Демонстрация экрана)'}
              </div>
              {isMuted && <div style={styles.mainMutedIndicator}>🔇</div>}
            </div>
          )}
        </div>

        {/* PREVIEW STRIP - Горизонтальная лента превью */}
        {(showLocalInPreview || remotePreviewParticipants.length > 0) && (
          <div style={styles.previewStrip}>
            <div style={styles.previewScrollContainer}>
              {/* Локальное видео в preview (если remote на главном экране) */}
              {showLocalInPreview && (
                <div
                  key="local-preview"
                  style={{
                    ...styles.previewItem,
                    ...(currentUserId === activeSpeakerId ? styles.previewItemActive : {})
                  }}
                  onClick={() => setPinnedUserId(null)} // null = показать локальное как main
                  title="Нажмите, чтобы показать своё видео"
                >
                  <video
                    ref={localPreviewVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      ...styles.previewVideo,
                      ...(isVideoOff ? styles.videoHidden : {})
                    }}
                  />
                  {isVideoOff && (
                    <div style={styles.previewPlaceholder}>
                      <span>👤</span>
                    </div>
                  )}
                  <div style={styles.previewLabel}>Вы</div>
                  {isMuted && <div style={styles.previewMuted}>🔇</div>}
                  {currentUserId === activeSpeakerId && <div style={styles.previewActiveBorder} />}
                </div>
              )}
              
              {/* Remote участники в preview */}
              {remotePreviewParticipants.map((participant) => {
                const isActive = participant.oderId === activeSpeakerId;
                const volume = audioLevels[participant.oderId] || 0;
                
                return (
                  <div
                    key={participant.oderId}
                    style={{
                      ...styles.previewItem,
                      ...(isActive ? styles.previewItemActive : {})
                    }}
                    onClick={() => setPinnedUserId(participant.oderId)}
                    title="Нажмите, чтобы закрепить"
                  >
                    {/* Показываем видео ТОЛЬКО если есть реальный stream */}
                    {participant.hasStream && participant.stream ? (
                      <PreviewVideoPlayer stream={participant.stream} />
                    ) : (
                      <div style={styles.previewPlaceholder}>
                        <span>👤</span>
                        <small style={styles.connectingText}>⏳</small>
                      </div>
                    )}
                    <div style={styles.previewLabel}>
                      {participant.userName || 'Участник'}
                    </div>
                    {/* Индикатор громкости */}
                    {volume > 20 && (
                      <div style={styles.volumeIndicator}>🔊</div>
                    )}
                    {/* Визуальная рамка active speaker */}
                    {isActive && <div style={styles.previewActiveBorder} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Панель управления */}
        <div style={styles.controls}>
          <button
            onClick={toggleMute}
            style={{
              ...styles.controlBtn,
              ...(isMuted ? styles.controlBtnActive : {})
            }}
            title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>

          {callType === 'video' && (
            <button
              onClick={toggleVideo}
              style={{
                ...styles.controlBtn,
                ...(isVideoOff ? styles.controlBtnActive : {})
              }}
              title={isVideoOff ? 'Включить камеру' : 'Выключить камеру'}
            >
              {isVideoOff ? '📵' : '📹'}
            </button>
          )}

          {callType === 'video' && (
            <button
              onClick={toggleScreenShare}
              style={{
                ...styles.controlBtn,
                ...(isScreenSharing ? styles.controlBtnScreen : {})
              }}
              title={isScreenSharing ? 'Остановить демонстрацию' : 'Демонстрация экрана'}
            >
              🖥️
            </button>
          )}

          <button
            onClick={handleEndCall}
            style={styles.endCallBtn}
            title="Завершить звонок"
          >
            📞
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== VIDEO PLAYER COMPONENTS =====

// Главное видео (высокое качество)
const MainVideoPlayer = React.forwardRef(({ stream }, ref) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted // Android WebView требует muted для autoplay
      style={styles.mainVideo}
    />
  );
});

// Preview видео (низкое качество)
function PreviewVideoPlayer({ stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted // Android WebView требует muted для autoplay
      style={styles.previewVideo}
    />
  );
}

// ===== STYLES (Discord-like) =====
// ===== STYLES (Discord-like) =====

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modal: {
    width: '100%',
    height: '100%',
    maxWidth: '1920px',
    maxHeight: '1080px',
    background: '#1e1e1e',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    margin: '16px',
  },
  header: {
    padding: '12px 20px',
    background: '#0f0f0f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #2a2a2a',
    flexShrink: 0,
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerIcon: {
    fontSize: '24px',
  },
  chatName: {
    margin: 0,
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
  },
  participantCount: {
    margin: 0,
    color: '#b3b3b3',
    fontSize: '13px',
  },
  callStatus: {
    color: '#22c55e',
    fontSize: '14px',
  },
  
  // ===== MAIN VIDEO (Discord style) =====
  mainVideoContainer: {
    flex: 1,
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 0, // Важно для flex
  },
  mainVideoWrapper: {
    position: 'relative',
    width: '100%',
    height: '100%',
    maxHeight: '75vh',
    background: '#0f0f0f',
    borderRadius: '12px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'box-shadow 0.2s ease',
  },
  mainVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain', // Сохраняем пропорции
  },
  mainVideoPlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    color: '#666',
  },
  mainVideoAvatar: {
    fontSize: '120px',
  },
  mainVideoName: {
    fontSize: '20px',
    color: '#999',
    margin: 0,
  },
  mainVideoLabel: {
    position: 'absolute',
    bottom: '16px',
    left: '16px',
    background: 'rgba(0, 0, 0, 0.8)',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
  },
  mainMutedIndicator: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'rgba(239, 68, 68, 0.9)',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
  },
  unpinBtn: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'rgba(0, 0, 0, 0.7)',
    border: 'none',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    color: '#fff',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
  },
  videoHidden: {
    display: 'none',
  },
  
  // Active speaker визуальная рамка
  activeSpeaker: {
    boxShadow: '0 0 0 3px #22c55e, 0 0 20px rgba(34, 197, 94, 0.5)',
  },
  activeSpeakerBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    border: '3px solid #22c55e',
    borderRadius: '12px',
    pointerEvents: 'none',
    animation: 'pulse 2s infinite',
  },
  
  // ===== PREVIEW STRIP (Горизонтальная лента) =====
  previewStrip: {
    padding: '0 16px 12px 16px',
    background: '#1e1e1e',
    borderTop: '1px solid #2a2a2a',
    flexShrink: 0,
  },
  previewScrollContainer: {
    display: 'flex',
    gap: '12px',
    overflowX: 'auto',
    overflowY: 'hidden',
    paddingBottom: '4px',
    // Стилизация scrollbar (WebKit)
    scrollbarWidth: 'thin',
    scrollbarColor: '#3a3a3a #1e1e1e',
  },
  previewItem: {
    position: 'relative',
    minWidth: '180px',
    width: '180px',
    height: '120px',
    background: '#0f0f0f',
    borderRadius: '8px',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    flexShrink: 0,
  },
  previewItemActive: {
    boxShadow: '0 0 0 2px #22c55e',
  },
  previewVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  previewPlaceholder: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '48px',
    color: '#444',
  },
  previewLabel: {
    position: 'absolute',
    bottom: '6px',
    left: '6px',
    background: 'rgba(0, 0, 0, 0.7)',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500',
    maxWidth: 'calc(100% - 12px)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  connectingText: {
    display: 'block',
    fontSize: '10px',
    marginTop: '4px',
    opacity: 0.7,
  },
  previewMuted: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    background: 'rgba(239, 68, 68, 0.9)',
    borderRadius: '50%',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
  },
  volumeIndicator: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    fontSize: '16px',
  },
  previewActiveBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    border: '2px solid #22c55e',
    borderRadius: '8px',
    pointerEvents: 'none',
  },
  
  // ===== CONTROLS =====
  controls: {
    padding: '16px',
    background: '#0f0f0f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    borderTop: '1px solid #2a2a2a',
    flexShrink: 0,
  },
  controlBtn: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    border: 'none',
    background: '#3a3a3a',
    color: '#fff',
    fontSize: '24px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  controlBtnActive: {
    background: '#ef4444',
  },
  controlBtnScreen: {
    background: '#22c55e',
  },
  endCallBtn: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    border: 'none',
    background: '#ef4444',
    color: '#fff',
    fontSize: '24px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transform: 'rotate(135deg)',
    transition: 'all 0.2s ease',
  },
  
  // ===== INCOMING CALL =====
  incomingModal: {
    background: '#1e1e1e',
    borderRadius: '24px',
    padding: '32px',
    textAlign: 'center',
    maxWidth: '360px',
    animation: 'fadeIn 0.3s ease',
  },
  incomingIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  incomingTitle: {
    color: '#fff',
    fontSize: '24px',
    fontWeight: '600',
    margin: '0 0 8px 0',
  },
  incomingSubtitle: {
    color: '#a855f7',
    fontSize: '16px',
    margin: '0 0 8px 0',
  },
  incomingCaller: {
    color: '#b3b3b3',
    fontSize: '14px',
    margin: '0 0 24px 0',
  },
  incomingActions: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center',
  },
  declineBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '16px 24px',
    background: '#ef4444',
    border: 'none',
    borderRadius: '16px',
    color: '#fff',
    fontSize: '24px',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  acceptBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '16px 24px',
    background: '#22c55e',
    border: 'none',
    borderRadius: '16px',
    color: '#fff',
    fontSize: '24px',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  btnLabel: {
    fontSize: '12px',
    fontWeight: '500',
  },
};

// ===== CSS ANIMATIONS (inject to document.head) =====
if (typeof document !== 'undefined') {
  const styleId = 'group-call-animations';
  
  if (!document.getElementById(styleId)) {
    const styleTag = document.createElement('style');
    styleTag.id = styleId;
    styleTag.textContent = `
      /* Fade in animation */
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      
      /* Pulse animation for active speaker */
      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.7;
        }
      }
      
      /* Preview hover effect */
      .preview-item:hover {
        transform: scale(1.05);
      }
      
      /* Scrollbar styling (WebKit) */
      .preview-scroll-container::-webkit-scrollbar {
        height: 6px;
      }
      
      .preview-scroll-container::-webkit-scrollbar-track {
        background: #1e1e1e;
      }
      
      .preview-scroll-container::-webkit-scrollbar-thumb {
        background: #3a3a3a;
        border-radius: 3px;
      }
      
      .preview-scroll-container::-webkit-scrollbar-thumb:hover {
        background: #4a4a4a;
      }
      
      /* Mobile adaptations */
      @media (max-width: 768px) {
        .group-call-modal {
          margin: 0 !important;
          border-radius: 0 !important;
          max-width: 100% !important;
          max-height: 100% !important;
        }
        
        .preview-item {
          min-width: 140px !important;
          width: 140px !important;
          height: 100px !important;
        }
        
        .main-video-label {
          font-size: 12px !important;
          padding: 6px 10px !important;
        }
      }
      
      /* Android WebView optimizations */
      @media (hover: none) and (pointer: coarse) {
        .control-btn:active {
          transform: scale(0.95);
        }
        
        .preview-item:active {
          transform: scale(0.98);
        }
      }
    `;
    document.head.appendChild(styleTag);
  }
}

export default GroupCallModal;
