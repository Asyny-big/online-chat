import React, { useEffect, useRef, useState, useCallback } from 'react';
import { API_URL } from '../config';

// Простой рингтон (Web Audio API)
function createRingtone() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let oscillator = null;
    let gainNode = null;
    let isPlaying = false;
    let intervalId = null;
    
    const playTone = () => {
      if (!isPlaying) return;
      
      oscillator = audioContext.createOscillator();
      gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 440;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.2;
      
      oscillator.start();
      
      setTimeout(() => {
        if (oscillator) {
          try { oscillator.stop(); } catch(e) {}
        }
      }, 400);
    };
    
    return {
      play: () => {
        if (isPlaying) return;
        isPlaying = true;
        audioContext.resume();
        playTone();
        intervalId = setInterval(playTone, 1000);
      },
      stop: () => {
        if (!isPlaying) return;
        isPlaying = false;
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        if (oscillator) {
          try { oscillator.stop(); } catch(e) {}
        }
      }
    };
  } catch (e) {
    console.error('Ringtone error:', e);
    return { play: () => {}, stop: () => {} };
  }
}

function CallModal({
  socket,
  callState,      // 'idle' | 'outgoing' | 'incoming' | 'active'
  callType,       // 'audio' | 'video'
  callId,
  chatId,
  remoteUser,     // { _id, name, avatarUrl }
  onClose,
  onCallAccepted, // Колбэк когда звонок принят
  currentUserId,
  token,          // JWT токен для авторизации запросов
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  // videoMode описывает, ЧТО именно мы отправляем в видеотреке: камера или демонстрация экрана.
  // Это локальное состояние (UI/логика) + мы синхронизируем его с собеседником через socket.
  const [localVideoMode, setLocalVideoMode] = useState('camera'); // 'camera' | 'screen'
  const [remoteVideoMode, setRemoteVideoMode] = useState('camera'); // 'camera' | 'screen'
  const [callDuration, setCallDuration] = useState(0);
  const [connectionState, setConnectionState] = useState('new');
  const [hasLocalStream, setHasLocalStream] = useState(false);
  const [facingMode, setFacingMode] = useState('user'); // 'user' = фронтальная, 'environment' = задняя
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [iceServers, setIceServers] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const timerRef = useRef(null);
  const ringtoneRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const isInitiatorRef = useRef(false);
  const remoteUserIdRef = useRef(null); // ID собеседника для отправки сигналов
  const localVideoModeRef = useRef('camera');

  useEffect(() => {
    localVideoModeRef.current = localVideoMode;
  }, [localVideoMode]);

  // Явно НЕ поддерживаем screen share в мобильных браузерах.
  // (Android WebView/Chrome mobile и iOS Safari имеют другие ограничения; под них будет отдельная логика в будущем.)
  const isMobileBrowser = () => {
    try {
      const ua = navigator.userAgent || '';
      const uaDataMobile = navigator.userAgentData?.mobile;
      if (uaDataMobile === true) return true;
      if (/Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(ua)) return true;
      // Фолбэк: coarse pointer часто означает touch-девайс
      if (window.matchMedia?.('(pointer:coarse)')?.matches) return true;
    } catch (e) {
      // Если что-то пошло не так — считаем что НЕ mobile, чтобы не ломать десктоп.
    }
    return false;
  };

  const getVideoSender = (pc) => pc?.getSenders?.().find(s => s.track?.kind === 'video') || null;

  // Универсальная логика замены исходящего видеотрека в существующем RTCPeerConnection.
  // Важно: не делаем renegotiation (offer/answer), только sender.replaceTrack().
  const replaceOutgoingVideoTrack = useCallback(async (newVideoTrack) => {
    const pc = peerConnectionRef.current;
    if (!pc) throw new Error('PeerConnection не инициализирован');

    const videoSender = getVideoSender(pc);
    if (!videoSender) throw new Error('Видео sender не найден');

    const oldVideoTrack = localStreamRef.current?.getVideoTracks?.()?.[0] || null;

    await videoSender.replaceTrack(newVideoTrack);
    console.log('[CallModal] Outgoing video track replaced via replaceTrack()');

    // Обновляем локальный stream (чтобы local preview показывал актуальный источник)
    if (localStreamRef.current) {
      if (oldVideoTrack) {
        try { localStreamRef.current.removeTrack(oldVideoTrack); } catch (e) {}
      }
      try { localStreamRef.current.addTrack(newVideoTrack); } catch (e) {}
    }

    // Останавливаем старый видеотрек, чтобы не держать камеру/ресурсы.
    if (oldVideoTrack && oldVideoTrack !== newVideoTrack) {
      try { oldVideoTrack.stop(); } catch (e) {}
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, []);

  // Отправляем текущее состояние видеорежима собеседнику через существующий signaling-канал.
  // Сервер прозрачно форвардит любые типы signal.
  const sendVideoMode = useCallback((mode, explicitTargetUserId = null) => {
    const targetId = explicitTargetUserId || remoteUserIdRef.current || remoteUser?._id;
    if (!socket || !callId || !targetId) return;

    socket.emit('call:signal', {
      callId,
      targetUserId: targetId,
      signal: {
        type: 'video-mode',
        mode
      }
    });
  }, [socket, callId, remoteUser]);

  // Загрузка ICE серверов с backend (с временными TURN credentials)
  const fetchIceServers = useCallback(async () => {
    try {
      console.log('[CallModal] Fetching ICE servers from backend...');
      const response = await fetch(`${API_URL}/webrtc/ice`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const config = await response.json();
      console.log('[CallModal] Got ICE config:', config);
      setIceServers(config);
      return config;
    } catch (err) {
      console.error('[CallModal] Failed to fetch ICE servers:', err);
      // Fallback на STUN only если не удалось получить TURN
      const fallback = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
      };
      setIceServers(fallback);
      return fallback;
    }
  }, [token]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('[CallModal] Cleanup');
    
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Stop ringtone
    if (ringtoneRef.current) {
      ringtoneRef.current.stop();
      ringtoneRef.current = null;
    }
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('[CallModal] Stopped track:', track.kind);
      });
      localStreamRef.current = null;
    }

    // Stop screen stream (если был отдельный stream от getDisplayMedia)
    if (screenStreamRef.current) {
      try {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      } catch (e) {}
      screenStreamRef.current = null;
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    pendingCandidatesRef.current = [];
    setHasLocalStream(false);
    setHasRemoteStream(false);
    setLocalVideoMode('camera');
    setRemoteVideoMode('camera');
  }, []);

  // Initialize media (CRITICAL: This MUST work)
  const initMedia = useCallback(async () => {
    console.log('[CallModal] initMedia called, callType:', callType);
    
    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: callType === 'video' ? {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        } : false
      };
      
      console.log('[CallModal] Requesting getUserMedia with:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[CallModal] Got local stream:', stream.id, 'tracks:', stream.getTracks().map(t => t.kind));
      
      localStreamRef.current = stream;
      setHasLocalStream(true);
      
      // CRITICAL: Bind stream to video element immediately
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log('[CallModal] Local video srcObject set');
      }
      
      return stream;
    } catch (err) {
      console.error('[CallModal] getUserMedia error:', err);
      alert('Не удалось получить доступ к камере/микрофону: ' + err.message);
      return null;
    }
  }, [callType]);

  // Create PeerConnection
  const createPeerConnection = useCallback((stream, iceConfig) => {
    console.log('[CallModal] Creating PeerConnection with ICE config:', iceConfig);
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    const pc = new RTCPeerConnection(iceConfig);
    peerConnectionRef.current = pc;
    
    // Add local tracks
    if (stream) {
      stream.getTracks().forEach(track => {
        console.log('[CallModal] Adding track to PC:', track.kind);
        pc.addTrack(track, stream);
      });
    }
    
    // Handle remote tracks
    pc.ontrack = (event) => {
      console.log('[CallModal] ontrack event:', event.streams);
      const [remoteStream] = event.streams;
      if (remoteStream && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        setHasRemoteStream(true);
        console.log('[CallModal] Remote video srcObject set');
      }
    };
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      const targetId = remoteUserIdRef.current || remoteUser?._id;
      if (event.candidate && socket && targetId) {
        // Логируем тип кандидата для диагностики
        const candidateType = event.candidate.candidate.includes('relay') ? 'relay (TURN)' :
                              event.candidate.candidate.includes('srflx') ? 'srflx (STUN)' :
                              event.candidate.candidate.includes('host') ? 'host (local)' : 'unknown';
        console.log('[CallModal] Sending ICE candidate to:', targetId, 'type:', candidateType);
        socket.emit('call:signal', {
          callId,
          targetUserId: targetId,
          signal: {
            type: 'ice-candidate',
            candidate: event.candidate.toJSON()
          }
        });
      } else if (!event.candidate) {
        console.log('[CallModal] ICE gathering complete');
      }
    };
    
    // ICE gathering state - важно для диагностики
    pc.onicegatheringstatechange = () => {
      console.log('[CallModal] ICE gathering state:', pc.iceGatheringState);
    };
    
    // Connection state
    pc.onconnectionstatechange = () => {
      console.log('[CallModal] Connection state:', pc.connectionState);
      setConnectionState(pc.connectionState);
      
      if (pc.connectionState === 'connected') {
        // Stop ringtone on connect
        if (ringtoneRef.current) {
          ringtoneRef.current.stop();
        }
        startTimer();
      }
      
      if (pc.connectionState === 'failed') {
        console.log('[CallModal] Connection failed, attempting ICE restart...');
        // Попробуем перезапустить ICE
        pc.restartIce();
      }
      
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        console.log('[CallModal] Connection ended:', pc.connectionState);
      }
    };
    
    pc.oniceconnectionstatechange = () => {
      console.log('[CallModal] ICE connection state:', pc.iceConnectionState);
      
      // Если ICE в состоянии failed, попробуем перезапустить
      if (pc.iceConnectionState === 'failed') {
        console.log('[CallModal] ICE connection failed, attempting restart...');
        pc.restartIce();
      }
      
      // Если ICE в состоянии disconnected, подождём немного и проверим ещё раз
      if (pc.iceConnectionState === 'disconnected') {
        console.log('[CallModal] ICE disconnected, waiting for reconnection...');
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            console.log('[CallModal] ICE still disconnected, restarting...');
            pc.restartIce();
          }
        }, 5000);
      }
    };
    
    pc.onsignalingstatechange = () => {
      console.log('[CallModal] Signaling state:', pc.signalingState);
    };
    
    return pc;
  }, [socket, callId, remoteUser]);

  // Start call timer
  const startTimer = () => {
    if (timerRef.current) return;
    console.log('[CallModal] Starting timer');
    timerRef.current = setInterval(() => {
      setCallDuration(d => d + 1);
    }, 1000);
  };

  // Handle incoming offer and send answer
  const handleOffer = useCallback(async (pc, offerSdp, fromUserId) => {
    try {
      console.log('[CallModal] Handling offer from:', fromUserId);
      
      // Сохраняем ID того кто прислал offer
      if (fromUserId) {
        remoteUserIdRef.current = fromUserId;
      }
      
      await pc.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: offerSdp
      }));
      
      console.log('[CallModal] Creating answer');
      const answer = await pc.createAnswer();
      
      console.log('[CallModal] Setting local description (answer)');
      await pc.setLocalDescription(answer);
      
      // Отправляем answer тому кто прислал offer
      const targetId = fromUserId || remoteUserIdRef.current || remoteUser?._id;
      console.log('[CallModal] Sending answer to:', targetId);
      socket.emit('call:signal', {
        callId,
        targetUserId: targetId,
        signal: {
          type: 'answer',
          sdp: answer.sdp
        }
      });
      
      // Process pending candidates
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];
      
    } catch (err) {
      console.error('[CallModal] Error handling offer:', err);
    }
  }, [socket, callId, remoteUser]);

  // Handle incoming answer
  const handleAnswer = useCallback(async (pc, answerSdp) => {
    try {
      console.log('[CallModal] Handling answer');
      await pc.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp
      }));
      
      // Process pending candidates
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];
      
    } catch (err) {
      console.error('[CallModal] Error handling answer:', err);
    }
  }, []);

  // Handle incoming ICE candidate
  const handleIceCandidate = useCallback(async (pc, candidate) => {
    try {
      if (pc.remoteDescription) {
        console.log('[CallModal] Adding ICE candidate');
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        console.log('[CallModal] Queueing ICE candidate');
        pendingCandidatesRef.current.push(candidate);
      }
    } catch (err) {
      console.error('[CallModal] Error adding ICE candidate:', err);
    }
  }, []);

  // Accept incoming call
  const handleAccept = useCallback(async () => {
    console.log('[CallModal] Accepting call');
    
    // Stop ringtone
    if (ringtoneRef.current) {
      ringtoneRef.current.stop();
    }
    
    // Fetch ICE servers first
    const iceConfig = await fetchIceServers();
    
    // Get media first
    const stream = await initMedia();
    if (!stream) {
      console.error('[CallModal] Failed to get media for accepting call');
      return;
    }
    
    // Create peer connection with ICE config
    const pc = createPeerConnection(stream, iceConfig);
    
    // Notify server we accepted - инициатор получит participant_joined и отправит offer
    socket.emit('call:accept', { callId }, (response) => {
      console.log('[CallModal] call:accept response:', response);
      if (response.error) {
        alert('Ошибка принятия звонка: ' + response.error);
        cleanup();
        onClose?.();
      } else {
        // Уведомляем родителя что звонок принят
        onCallAccepted?.();
      }
      // Теперь ждем offer от инициатора через call:signal
    });
  }, [initMedia, createPeerConnection, fetchIceServers, socket, callId, cleanup, onClose, onCallAccepted]);

  // Decline incoming call
  const handleDecline = useCallback(() => {
    console.log('[CallModal] Declining call');
    
    if (ringtoneRef.current) {
      ringtoneRef.current.stop();
    }
    
    socket.emit('call:decline', { callId });
    cleanup();
    onClose?.();
  }, [socket, callId, cleanup, onClose]);

  // End active call
  const handleEndCall = useCallback(() => {
    console.log('[CallModal] Ending call');
    
    socket.emit('call:leave', { callId });
    cleanup();
    onClose?.();
  }, [socket, callId, cleanup, onClose]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        console.log('[CallModal] Audio muted:', !audioTrack.enabled);
      }
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current && callType === 'video') {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
        console.log('[CallModal] Video off:', !videoTrack.enabled);
      }
    }
  }, [callType]);

  // Смена камеры (фронтальная/задняя)
  const switchCamera = useCallback(async () => {
    if (callType !== 'video' || !localStreamRef.current) return;
    if (localVideoModeRef.current === 'screen') {
      alert('Сейчас включена демонстрация экрана. Сначала верните камеру.');
      return;
    }
    
    try {
      const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
      console.log('[CallModal] Switching camera to:', newFacingMode);
      
      // Получаем новый видеопоток
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: newFacingMode
        },
        audio: false // аудио оставляем старое
      });
      
      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
      
      // Заменяем трек в PeerConnection
      if (peerConnectionRef.current) {
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
          console.log('[CallModal] Replaced video track in PeerConnection');
        }
      }
      
      // Останавливаем старый трек
      if (oldVideoTrack) {
        oldVideoTrack.stop();
      }
      
      // Заменяем трек в локальном стриме
      localStreamRef.current.removeTrack(oldVideoTrack);
      localStreamRef.current.addTrack(newVideoTrack);
      
      // Обновляем видео элемент
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      
      setFacingMode(newFacingMode);
      console.log('[CallModal] Camera switched to:', newFacingMode);
      
    } catch (err) {
      console.error('[CallModal] Error switching camera:', err);
      // Возможно устройство не поддерживает вторую камеру
      alert('Не удалось переключить камеру. Возможно, устройство не поддерживает вторую камеру.');
    }
  }, [callType, facingMode]);

  // Выключить демонстрацию экрана и вернуть камеру.
  const stopScreenShare = useCallback(async () => {
    if (callType !== 'video') return;
    if (localVideoModeRef.current !== 'screen') return;

    try {
      console.log('[CallModal] Stopping screen share and returning camera');

      // ВАЖНО: сначала подменяем трек на camera, и только потом останавливаем screen-track.
      // Иначе можно получить короткий "black frame" на удалённой стороне.
      const prevScreenStream = screenStreamRef.current;

      // Забираем новый camera video track (аудио остаётся прежним)
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode
        },
        audio: false
      });
      const camTrack = camStream.getVideoTracks()[0];
      if (!camTrack) {
        throw new Error('Не удалось получить video track камеры');
      }

      await replaceOutgoingVideoTrack(camTrack);

      // Теперь безопасно остановить демонстрацию экрана.
      if (prevScreenStream) {
        try { prevScreenStream.getTracks().forEach(t => t.stop()); } catch (e) {}
      }
      screenStreamRef.current = null;

      // camStream содержит только video; чтобы не держать лишний stream объект, оставим жить только track.
      // (Остановка camStream остановит и camTrack, поэтому НЕ останавливаем camStream здесь.)

      setLocalVideoMode('camera');
      sendVideoMode('camera');
    } catch (err) {
      console.error('[CallModal] stopScreenShare error:', err);
      alert('Не удалось вернуть камеру: ' + (err?.message || err));
    }
  }, [callType, facingMode, replaceOutgoingVideoTrack, sendVideoMode]);

  // Включить демонстрацию экрана (ТОЛЬКО по клику пользователя).
  // Требования:
  // - navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
  // - не создаём новый RTCPeerConnection
  // - используем sender.replaceTrack() без offer/answer
  const startScreenShare = useCallback(async () => {
    if (callType !== 'video') return;
    if (isMobileBrowser()) {
      alert('Демонстрация экрана не поддерживается в мобильных браузерах. Откройте чат в десктопном Chrome/Edge/Firefox.');
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert('Ваш браузер не поддерживает getDisplayMedia().');
      return;
    }
    if (!peerConnectionRef.current || !localStreamRef.current) {
      alert('Звонок ещё не готов для демонстрации экрана.');
      return;
    }
    if (localVideoModeRef.current === 'screen') return;

    try {
      console.log('[CallModal] Starting screen share via getDisplayMedia()');
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) {
        throw new Error('Не удалось получить video track для экрана');
      }

      // На случай повторного запуска — остановим предыдущий screen stream
      if (screenStreamRef.current) {
        try { screenStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
      }
      screenStreamRef.current = screenStream;

      // Автовозврат к камере, если пользователь нажал "Stop sharing" в UI браузера.
      screenTrack.onended = () => {
        console.log('[CallModal] Screen track ended by user');
        stopScreenShare();
      };

      await replaceOutgoingVideoTrack(screenTrack);

      setIsVideoOff(false);
      setLocalVideoMode('screen');
      sendVideoMode('screen');
    } catch (err) {
      console.error('[CallModal] startScreenShare error:', err);
      alert('Не удалось запустить демонстрацию экрана: ' + (err?.message || err));
    }
  }, [callType, replaceOutgoingVideoTrack, sendVideoMode, stopScreenShare]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;
    
    const handleSignal = async ({ callId: signalCallId, fromUserId, signal }) => {
      console.log('[CallModal] Received signal:', signal.type, 'from:', fromUserId, 'for callId:', signalCallId);
      
      // Проверяем что сигнал для нашего звонка
      if (signalCallId && callId && signalCallId !== callId) {
        console.log('[CallModal] Signal for different call, ignoring');
        return;
      }
      
      const pc = peerConnectionRef.current;
      if (!pc) {
        console.warn('[CallModal] No PeerConnection for signal');
        return;
      }
      
      try {
        if (signal.type === 'offer') {
          await handleOffer(pc, signal.sdp, fromUserId);
        } else if (signal.type === 'answer') {
          await handleAnswer(pc, signal.sdp);
        } else if (signal.type === 'ice-candidate' && signal.candidate) {
          await handleIceCandidate(pc, signal.candidate);
        } else if (signal.type === 'video-mode') {
          const mode = signal?.mode;
          if (mode === 'camera' || mode === 'screen') {
            console.log('[CallModal] Remote video mode:', mode);
            setRemoteVideoMode(mode);
          }
        }
      } catch (err) {
        console.error('[CallModal] Signal handling error:', err);
      }
    };
    
    const handleCallEnded = ({ reason }) => {
      console.log('[CallModal] Call ended, reason:', reason);
      cleanup();
      onClose?.();
    };
    
    const handleParticipantJoined = async ({ userId: joinedUserId, userName }) => {
      console.log('[CallModal] Participant joined:', userName, 'joinedUserId:', joinedUserId, 'isInitiator:', isInitiatorRef.current, 'currentUserId:', currentUserId);
      
      // Игнорируем если это мы сами присоединились
      if (joinedUserId === currentUserId) {
        console.log('[CallModal] Ignoring self participant_joined');
        return;
      }
      
      // Сохраняем ID собеседника
      remoteUserIdRef.current = joinedUserId;
      
      // If we are the initiator and someone joined, send offer TO THAT USER
      if (isInitiatorRef.current && peerConnectionRef.current) {
        console.log('[CallModal] We are initiator, sending offer to:', joinedUserId);
        
        try {
          const pc = peerConnectionRef.current;
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: callType === 'video'
          });
          
          await pc.setLocalDescription(offer);
          
          // Отправляем offer именно тому кто присоединился
          socket.emit('call:signal', {
            callId,
            targetUserId: joinedUserId, // Используем ID присоединившегося, не remoteUser
            signal: {
              type: 'offer',
              sdp: offer.sdp
            }
          });
          console.log('[CallModal] Offer sent to:', joinedUserId);

          // Сразу синхронизируем видеорежим (camera/screen) с присоединившимся.
          // Это важно, если инициатор включил screen share ДО того, как собеседник принял звонок.
          sendVideoMode(localVideoModeRef.current, joinedUserId);
        } catch (err) {
          console.error('[CallModal] Error sending offer:', err);
        }
      }
    };
    
    const handleParticipantLeft = ({ callEnded }) => {
      console.log('[CallModal] Participant left, ended:', callEnded);
      if (callEnded) {
        cleanup();
        onClose?.();
      }
    };
    
    socket.on('call:signal', handleSignal);
    socket.on('call:ended', handleCallEnded);
    socket.on('call:participant_joined', handleParticipantJoined);
    socket.on('call:participant_left', handleParticipantLeft);
    
    return () => {
      socket.off('call:signal', handleSignal);
      socket.off('call:ended', handleCallEnded);
      socket.off('call:participant_joined', handleParticipantJoined);
      socket.off('call:participant_left', handleParticipantLeft);
    };
  }, [socket, callId, callType, handleOffer, handleAnswer, handleIceCandidate, cleanup, onClose, remoteUser, currentUserId, sendVideoMode]);

  // Initialize call based on state
  useEffect(() => {
    let isMounted = true;
    
    const initCall = async () => {
      if (callState === 'outgoing') {
        // Outgoing call: we are the initiator
        console.log('[CallModal] Initializing OUTGOING call');
        isInitiatorRef.current = true;
        
        // Сохраняем ID собеседника сразу
        if (remoteUser?._id) {
          remoteUserIdRef.current = remoteUser._id;
          console.log('[CallModal] Set remoteUserIdRef to:', remoteUser._id);
        }
        
        // Fetch ICE servers first
        const iceConfig = await fetchIceServers();
        if (!isMounted) return;
        
        const stream = await initMedia();
        if (!stream || !isMounted) return;
        
        createPeerConnection(stream, iceConfig);
        // Wait for participant_joined to send offer
        
      } else if (callState === 'incoming') {
        // Incoming call: play ringtone
        console.log('[CallModal] Initializing INCOMING call');
        isInitiatorRef.current = false;
        
        // Сохраняем ID инициатора (кто нам звонит)
        if (remoteUser?._id) {
          remoteUserIdRef.current = remoteUser._id;
          console.log('[CallModal] Set remoteUserIdRef to initiator:', remoteUser._id);
        }
        
        ringtoneRef.current = createRingtone();
        ringtoneRef.current.play();
      }
    };
    
    initCall();
    
    return () => {
      isMounted = false;
    };
  }, [callState, initMedia, createPeerConnection, fetchIceServers, remoteUser]);

  // Update local video ref when stream changes
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [hasLocalStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    if (callState === 'incoming') return 'Входящий звонок...';
    if (callState === 'outgoing') return 'Вызов...';
    if (callState === 'active') {
      if (connectionState === 'connected') {
        return formatDuration(callDuration);
      }
      return 'Подключение...';
    }
    return '';
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Video container */}
        <div style={styles.videoContainer}>
          {/* Remote video (full screen) */}
          {callType === 'video' ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{
                ...(localVideoMode === 'screen' ? styles.localVideo : styles.remoteVideo),
                display: hasRemoteStream ? 'block' : 'none',
                // Если собеседник шлёт screen — показываем без кропа
                objectFit: remoteVideoMode === 'screen' ? 'contain' : (localVideoMode === 'screen' ? 'cover' : 'cover')
              }}
            />
          ) : null}
          
          {/* Avatar placeholder when no remote video (не показываем поверх screen share) */}
          {(!hasRemoteStream || callType === 'audio') && localVideoMode !== 'screen' && (
            <div style={styles.avatarContainer}>
              <div style={styles.avatar}>
                {remoteUser?.avatarUrl ? (
                  <img src={remoteUser.avatarUrl} alt="" style={styles.avatarImg} />
                ) : (
                  remoteUser?.name?.charAt(0)?.toUpperCase() || '?'
                )}
              </div>
              {callState === 'incoming' && (
                <div style={styles.incomingPulse} />
              )}
            </div>
          )}
          
          {/* Local video (PiP) */}
          {callType === 'video' && (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                ...(localVideoMode === 'screen' ? styles.remoteVideo : styles.localVideo),
                opacity: hasLocalStream ? 1 : 0,
                // Локальная демонстрация экрана тоже без кропа
                objectFit: localVideoMode === 'screen' ? 'contain' : 'cover'
              }}
            />
          )}
        </div>
        
        {/* Info */}
        <div style={styles.info}>
          <div style={styles.userName}>{remoteUser?.name || 'Пользователь'}</div>
          <div style={styles.status}>{getStatusText()}</div>
          {callState === 'incoming' && (
            <div style={styles.callTypeLabel}>
              {callType === 'video' ? '📹 Видеозвонок' : '📞 Аудиозвонок'}
            </div>
          )}
        </div>
        
        {/* Controls */}
        <div style={styles.controls}>
          {callState === 'incoming' ? (
            // Incoming call controls
            <>
              <button onClick={handleDecline} style={styles.declineBtn} title="Отклонить">
                <span>✕</span>
              </button>
              <button onClick={handleAccept} style={styles.acceptBtn} title="Принять">
                <span>{callType === 'video' ? '🎥' : '📞'}</span>
              </button>
            </>
          ) : (
            // Active/outgoing call controls
            <>
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
                  {isVideoOff ? '📷' : '🎥'}
                </button>
              )}
              
              {/* Кнопка смены камеры - только для видеозвонков */}
              {callType === 'video' && (
                <button
                  onClick={switchCamera}
                  style={styles.controlBtn}
                  title={facingMode === 'user' ? 'Переключить на заднюю камеру' : 'Переключить на фронтальную камеру'}
                >
                  🔄
                </button>
              )}

              {/* Screen share (только web desktop). */}
              {callType === 'video' && localVideoMode !== 'screen' && (
                <button
                  onClick={startScreenShare}
                  style={styles.screenShareBtn}
                  title="Начать демонстрацию экрана"
                >
                  Показ экрана
                </button>
              )}

              {callType === 'video' && localVideoMode === 'screen' && (
                <button
                  onClick={stopScreenShare}
                  style={styles.screenShareBtn}
                  title="Остановить демонстрацию экрана"
                >
                  Вернуть камеру
                </button>
              )}
              
              <button onClick={handleEndCall} style={styles.endBtn} title="Завершить">
                <span>📵</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

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
    maxWidth: '480px',
    height: '100%',
    maxHeight: '720px',
    background: '#1e293b',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
    background: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '300px',
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  localVideo: {
    position: 'absolute',
    bottom: '16px',
    right: '16px',
    width: '120px',
    height: '160px',
    borderRadius: '12px',
    objectFit: 'cover',
    border: '2px solid #3b82f6',
    background: '#000',
    transition: 'opacity 0.3s',
  },
  screenShareBtn: {
    height: '40px',
    padding: '0 12px',
    borderRadius: '12px',
    border: 'none',
    background: '#334155',
    color: '#fff',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
  },
  avatarContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '48px',
    fontWeight: '600',
    color: '#fff',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  incomingPulse: {
    position: 'absolute',
    width: '140px',
    height: '140px',
    borderRadius: '50%',
    border: '3px solid #22c55e',
    animation: 'pulse-ring 1.5s infinite',
  },
  info: {
    padding: '20px',
    textAlign: 'center',
  },
  userName: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '8px',
  },
  status: {
    fontSize: '16px',
    color: '#94a3b8',
  },
  callTypeLabel: {
    marginTop: '8px',
    fontSize: '14px',
    color: '#60a5fa',
  },
  controls: {
    padding: '24px',
    display: 'flex',
    justifyContent: 'center',
    gap: '20px',
  },
  controlBtn: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    border: 'none',
    background: '#334155',
    fontSize: '24px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  controlBtnActive: {
    background: '#ef4444',
  },
  acceptBtn: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    border: 'none',
    background: '#22c55e',
    fontSize: '28px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'pulse-btn 1s infinite',
  },
  declineBtn: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    border: 'none',
    background: '#ef4444',
    fontSize: '28px',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBtn: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    border: 'none',
    background: '#ef4444',
    fontSize: '28px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

// Add keyframes for animations
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes pulse-ring {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      100% {
        transform: scale(1.3);
        opacity: 0;
      }
    }
    
    @keyframes pulse-btn {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.1);
      }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default CallModal;
