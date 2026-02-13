import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { API_URL } from '../config';

const Icons = {
  Mic: ({ off }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {off ? (
        <>
          <line x1="1" y1="1" x2="23" y2="23"></line>
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94 0v5.12"></path>
          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
          <line x1="12" y1="19" x2="12" y2="23"></line>
          <line x1="8" y1="23" x2="16" y2="23"></line>
        </>
      ) : (
        <>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="23"></line>
          <line x1="8" y1="23" x2="16" y2="23"></line>
        </>
      )}
    </svg>
  ),
  Camera: ({ off }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {off ? (
        <>
          <line x1="1" y1="1" x2="23" y2="23"></line>
          <path d="M21 21l-3.5-3.5m-2-2l-2-2m-2-2l-2-2m-2-2l-3.5-3.5"></path>
          <path d="M15 7h2a2 2 0 0 1 2 2v2m0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1"></path>
          <polygon points="23 7 16 12 23 17 23 7"></polygon>
        </>
      ) : (
        <>
          <polygon points="23 7 16 12 23 17 23 7"></polygon>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
        </>
      )}
    </svg>
  ),
  Screen: ({ active }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#3b82f6" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
      <line x1="8" y1="21" x2="16" y2="21"></line>
      <line x1="12" y1="17" x2="12" y2="21"></line>
    </svg>
  ),
  Switch: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 10c0-4.418-3.582-8-8-8s-8 3.582-8 8H1l5 6 5-6H7c0-2.761 2.239-5 5-5s5 2.239 5 5c0 1.25-.457 2.39-1.21 3.266" />
        <path d="M4 14c0 4.418 3.582 8 8 8s8-3.582 8-8h3l-5-6-5 6h4c0 2.761-2.239 5-5 5s-5-2.239-5-5c0-1.25.457-2.39 1.21-3.266" />
    </svg>
  ),
  Hangup: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
    </svg>
  )
};

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

  // P2P swap UX (как Telegram/FaceTime): клик по PiP меняет местами local/remote.
  // Важно: только layout/рендер-стили, без изменения MediaStream/WebRTC.
  const [isLocalFullscreen, setIsLocalFullscreen] = useState(false);

  const videoContainerRef = useRef(null);
  const pipDragRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
    startTs: 0,
    bounds: null, // { w, h, margin, pipW, pipH }
  });
  const pipPosRef = useRef(null); // { x, y } относительная позиция PiP (в px)
  const pipElRef = useRef(null); // текущий video-element PiP (local или remote)
  const pipRafRef = useRef({ raf: 0, next: null });

  // UI state for floating controls
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef(null);

  useEffect(() => {
    const handleActivity = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('click', handleActivity);

    // Initial timer
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('click', handleActivity);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream());
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

  // Swap доступен только когда оба потока — камера (screen share не участвует).
  const swapEnabled = callType === 'video' && localVideoMode !== 'screen' && remoteVideoMode !== 'screen';

  // Если включили screen share (локально/удалённо) — сбрасываем swap на дефолт.
  useEffect(() => {
    if (!swapEnabled) {
      setIsLocalFullscreen(false);
    }
  }, [swapEnabled]);

  const toggleSwap = useCallback(() => {
    if (!swapEnabled) return;
    setIsLocalFullscreen((v) => !v);
  }, [swapEnabled]);

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

    if (remoteStreamRef.current) {
      try {
        remoteStreamRef.current.getTracks().forEach((track) => {
          remoteStreamRef.current.removeTrack(track);
        });
      } catch (e) {}
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    pendingCandidatesRef.current = [];
    setHasLocalStream(false);
    setHasRemoteStream(false);
    setLocalVideoMode('camera');
    setRemoteVideoMode('camera');
    setIsLocalFullscreen(false);
    pipPosRef.current = null;
    pipElRef.current = null;
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
        return;
      }

      // Native clients can send streamless tracks (event.streams = []).
      // Build a synthetic MediaStream so browser UI still renders remote media.
      if (event.track && remoteVideoRef.current) {
        const fallbackStream = remoteStreamRef.current || new MediaStream();
        remoteStreamRef.current = fallbackStream;

        const alreadyAdded = fallbackStream.getTracks().some((track) => track.id === event.track.id);
        if (!alreadyAdded) {
          fallbackStream.addTrack(event.track);
        }

        if (remoteVideoRef.current.srcObject !== fallbackStream) {
          remoteVideoRef.current.srcObject = fallbackStream;
        }
        setHasRemoteStream(true);
        console.log('[CallModal] Remote track attached via fallback stream:', event.track.kind, event.track.id);
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

  const isMobile = isMobileBrowser() || window.innerWidth < 768;
  const isMobileVideoLayout = isMobile && callType === 'video';

  const MOBILE_PIP_W = 112;
  const MOBILE_PIP_H = 152;
  const MOBILE_PIP_MARGIN = 12;
  // controls.bottom=40px + контролы~(52px + padding) => держим PiP выше.
  const MOBILE_PIP_BOTTOM_CLEARANCE = 140;

  const DESKTOP_PIP_W = 180;
  const DESKTOP_PIP_H = 240; // aspectRatio 3/4
  const DESKTOP_PIP_MARGIN = 24;

  const clampWithin = useCallback((x, y, bounds) => {
    const { w, h, margin, pipW, pipH } = bounds;
    const minX = margin;
    const minY = margin;
    const maxX = Math.max(minX, w - pipW - margin);
    const maxY = Math.max(minY, h - pipH - margin);
    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    };
  }, []);

  const computeBounds = useCallback(() => {
    if (isMobileVideoLayout) {
      const w = window.innerWidth || 0;
      const h = window.innerHeight || 0;
      return {
        w,
        h: Math.max(0, h - MOBILE_PIP_BOTTOM_CLEARANCE),
        margin: MOBILE_PIP_MARGIN,
        pipW: MOBILE_PIP_W,
        pipH: MOBILE_PIP_H,
      };
    }

    const rect = videoContainerRef.current?.getBoundingClientRect?.();
    const w = rect?.width || 0;
    const h = rect?.height || 0;
    return {
      w,
      h,
      margin: DESKTOP_PIP_MARGIN,
      pipW: DESKTOP_PIP_W,
      pipH: DESKTOP_PIP_H,
    };
  }, [isMobileVideoLayout]);

  const getDefaultPipPosition = useCallback(() => {
    const b = computeBounds();
    // по умолчанию: справа сверху (как было), но на mobile ограничение по нижней панели.
    const x = Math.max(b.margin, b.w - b.pipW - b.margin);
    const y = b.margin;
    return clampWithin(x, y, b);
  }, [clampWithin, computeBounds]);

  const applyPipVars = useCallback((el, x, y) => {
    if (!el) return;
    try {
      el.style.setProperty('--pip-x', `${Math.round(x)}px`);
      el.style.setProperty('--pip-y', `${Math.round(y)}px`);
    } catch (_) {}
  }, []);

  const schedulePipVars = useCallback((x, y) => {
    pipRafRef.current.next = { x, y };
    if (pipRafRef.current.raf) return;
    pipRafRef.current.raf = requestAnimationFrame(() => {
      pipRafRef.current.raf = 0;
      const next = pipRafRef.current.next;
      pipRafRef.current.next = null;
      if (!next) return;
      const el = pipElRef.current;
      applyPipVars(el, next.x, next.y);
    });
  }, [applyPipVars]);

  // Screen share никогда не участвует в swap:
  // - если удалённый шарит экран -> удалённый всегда main
  // - если локальный шарит экран -> локальный всегда main
  const localShouldBeMain =
    callType === 'video' &&
    remoteVideoMode !== 'screen' &&
    (localVideoMode === 'screen' || (swapEnabled && isLocalFullscreen));
  const remoteIsPip = callType === 'video' && localShouldBeMain;
  const localIsPip = callType === 'video' && !localShouldBeMain;

  const pipClickable =
    callType === 'video' &&
    callState === 'active' &&
    swapEnabled &&
    hasLocalStream &&
    hasRemoteStream;

  const getPipHandlers = useCallback((isThisPip) => {
    if (!isThisPip) return {};

    const onPointerDown = (e) => {
      const target = e.currentTarget;
      try {
        target?.setPointerCapture?.(e.pointerId);
      } catch (_) {}

      const b = computeBounds();
      const existing = pipPosRef.current || getDefaultPipPosition();
      const origin = clampWithin(existing.x, existing.y, b);
      pipPosRef.current = origin;
      applyPipVars(target, origin.x, origin.y);

      pipDragRef.current = {
        active: true,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: origin.x,
        originY: origin.y,
        moved: false,
        startTs: performance.now(),
        bounds: b,
      };

      try {
        e.preventDefault();
      } catch (_) {}
    };

    const onPointerMove = (e) => {
      const st = pipDragRef.current;
      if (!st.active || st.pointerId !== e.pointerId) return;

      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      if (!st.moved && (Math.abs(dx) > 7 || Math.abs(dy) > 7)) st.moved = true;

      const b = st.bounds || computeBounds();
      const next = clampWithin(st.originX + dx, st.originY + dy, b);
      pipPosRef.current = next;
      schedulePipVars(next.x, next.y);

      try {
        e.preventDefault();
      } catch (_) {}
    };

    const onPointerUp = (e) => {
      const st = pipDragRef.current;
      if (!st.active || st.pointerId !== e.pointerId) return;

      pipDragRef.current.active = false;
      pipDragRef.current.pointerId = null;

      try {
        e.currentTarget?.releasePointerCapture?.(e.pointerId);
      } catch (_) {}

      const dt = performance.now() - (st.startTs || 0);
      const isTap = !st.moved && dt < 280;
      if (isTap && pipClickable) toggleSwap();

      try {
        e.preventDefault();
      } catch (_) {}
    };

    const onPointerCancel = (e) => {
      const st = pipDragRef.current;
      if (!st.active || st.pointerId !== e.pointerId) return;
      pipDragRef.current.active = false;
      pipDragRef.current.pointerId = null;
      try {
        e.currentTarget?.releasePointerCapture?.(e.pointerId);
      } catch (_) {}
    };

    return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
  }, [applyPipVars, clampWithin, computeBounds, getDefaultPipPosition, pipClickable, schedulePipVars, toggleSwap]);

  const mobileFullscreenVideoStyle = useMemo(() => {
    if (!isMobileVideoLayout) return null;
    return {
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100vh',
      borderRadius: 0,
      zIndex: 1,
      background: '#000',
      transition: 'all 200ms ease',
    };
  }, [isMobileVideoLayout]);

  const pipVideoStyle = useMemo(() => {
    const isMobile = isMobileVideoLayout;
    const size = isMobile
      ? { w: MOBILE_PIP_W, h: MOBILE_PIP_H, margin: MOBILE_PIP_MARGIN }
      : { w: DESKTOP_PIP_W, h: DESKTOP_PIP_H, margin: DESKTOP_PIP_MARGIN };

    return {
      position: isMobile ? 'fixed' : 'absolute',
      top: 0,
      left: 0,
      width: `${size.w}px`,
      height: `${size.h}px`,
      borderRadius: isMobile ? '14px' : '16px',
      zIndex: 40,
      border: '2px solid rgba(255, 255, 255, 0.10)',
      boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
      background: '#111',
      // Обновляем позицию только через transform (CSS vars) — без лишних re-render.
      transform: 'translate3d(var(--pip-x, 0px), var(--pip-y, 0px), 0)',
      willChange: 'transform',
      transition: 'transform 220ms ease',
      touchAction: 'none',
      userSelect: 'none',
    };
  }, [isMobileVideoLayout]);

  // Держим PiP в пределах viewport/контейнера и переносим координаты при swap (PiP перескакивает на другой video).
  useEffect(() => {
    const el = localIsPip ? localVideoRef.current : remoteIsPip ? remoteVideoRef.current : null;
    pipElRef.current = el;
    if (!el) return;

    const b = computeBounds();
    const cur = pipPosRef.current || getDefaultPipPosition();
    const next = clampWithin(cur.x, cur.y, b);
    pipPosRef.current = next;
    applyPipVars(el, next.x, next.y);
  }, [applyPipVars, clampWithin, computeBounds, getDefaultPipPosition, localIsPip, remoteIsPip]);

  useEffect(() => {
    const handleResize = () => {
      const el = pipElRef.current;
      const cur = pipPosRef.current;
      if (!el || !cur) return;
      const b = computeBounds();
      const next = clampWithin(cur.x, cur.y, b);
      pipPosRef.current = next;
      applyPipVars(el, next.x, next.y);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [applyPipVars, clampWithin, computeBounds]);

  // Если это web-desktop, мы хотим "модальное" окно, а не full-screen
  // Если мобилка - full screen
  
  const modalStyle = isMobile ? {
    width: '100%',
    height: '100%',
    borderRadius: 0,
    background: '#0f172a',
  } : {
    width: '90%',
    maxWidth: '1200px',
    height: '85%',
    maxHeight: '800px',
    borderRadius: '24px',
    background: '#1e293b',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  };

  return (
    <div className="govchat-call-modal" style={styles.overlay}>
      <div style={{
          ...styles.modal,
          ...modalStyle
      }}>
        {/* Video container */}
        <div style={{
            ...styles.videoContainer,
            background: isMobile ? '#000' : '#0f172a', // Чуть светлее фон на десктопе для контейнера
            borderRadius: isMobile ? 0 : '24px', 
        }} ref={videoContainerRef}>
          {/* Remote video (full screen) */}
          {callType === 'video' ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              {...getPipHandlers(remoteIsPip)}
              style={{
                ...(isMobileVideoLayout ? (remoteIsPip ? pipVideoStyle : mobileFullscreenVideoStyle) : (remoteIsPip ? pipVideoStyle : styles.remoteVideo)),
                display: hasRemoteStream ? 'block' : 'none',
                // Если собеседник шлёт screen — показываем без кропа
                objectFit: remoteVideoMode === 'screen'
                  ? 'contain'
                  : (isMobileVideoLayout ? (remoteIsPip ? 'cover' : 'cover') : (remoteIsPip ? 'cover' : 'contain')),
                borderRadius: isMobileVideoLayout ? (remoteIsPip ? '14px' : 0) : '20px',
                transition: 'all 200ms ease',
                cursor: pipClickable && remoteIsPip ? 'pointer' : 'default',
                ...(remoteIsPip ? { pointerEvents: 'auto' } : {})
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
              {...getPipHandlers(localIsPip)}
              style={{
                ...(isMobileVideoLayout ? (localIsPip ? pipVideoStyle : mobileFullscreenVideoStyle) : (localIsPip ? pipVideoStyle : styles.remoteVideo)),
                opacity: hasLocalStream ? 1 : 0,
                // Локальная демонстрация экрана тоже без кропа
                objectFit: localVideoMode === 'screen'
                  ? 'contain'
                  : (isMobileVideoLayout ? (localIsPip ? 'cover' : 'cover') : (localIsPip ? 'cover' : 'contain')),
                // Self-view (камера) — зеркалим ТОЛЬКО в UI. Screen share никогда не зеркалим.
                // Важно: для PiP комбинируем translate(var(--pip-x/y)) и scaleX(-1).
                ...(localVideoMode !== 'screen'
                  ? (localIsPip
                      ? { transform: 'translate3d(var(--pip-x, 0px), var(--pip-y, 0px), 0) scaleX(-1)', transformOrigin: 'center' }
                      : { transform: 'scaleX(-1)', transformOrigin: 'center' })
                  : {}),
                transition: 'all 200ms ease',
                cursor: pipClickable && localIsPip ? 'pointer' : 'default',
                ...(localIsPip ? { pointerEvents: 'auto' } : {})
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
        <div style={{
          ...styles.controls,
          ...(callState === 'active' ? {
             opacity: showControls ? 1 : 0,
             transform: showControls ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(24px)',
             pointerEvents: showControls ? 'auto' : 'none',
          } : {})
        }}>
          {callState === 'incoming' ? (
            // Incoming call controls
            <>
              <button onClick={handleDecline} style={styles.declineBtn} title="Отклонить">
                <Icons.Hangup />
              </button>
              <button onClick={handleAccept} style={styles.acceptBtn} title="Принять">
                 <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.44-5.15-3.75-6.59-6.59l1.97-1.57c.26-.26.35-.63.24-1.01a11.36 11.36 0 0 1-.56-3.53c0-.54-.45-.99-.99-.99H4.19C3.65 3.3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
                 </svg>
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
                <Icons.Mic off={isMuted} />
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
                  <Icons.Camera off={isVideoOff} />
                </button>
              )}
              
              {callType === 'video' && (
                <button
                  onClick={switchCamera}
                  style={styles.controlBtn}
                  title="Сменить камеру"
                >
                  <Icons.Switch />
                </button>
              )}

              {callType === 'video' && !isMobileBrowser() && (
                <button
                  onClick={localVideoMode === 'screen' ? stopScreenShare : startScreenShare}
                  style={{
                    ...styles.controlBtn,
                    ...(localVideoMode === 'screen' ? styles.controlBtnActive : {})
                  }}
                  title={localVideoMode === 'screen' ? "Остановить демонстрацию" : "Демонстрация экрана"}
                >
                  <Icons.Screen active={localVideoMode === 'screen'} />
                </button>
              )}
              
              <button onClick={handleEndCall} style={styles.endBtn} title="Завершить">
                <Icons.Hangup />
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
    background: 'rgba(0, 0, 0, 0.75)', 
    backdropFilter: 'blur(12px)',      
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    perspective: '1000px',
  },
  modal: {
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    animation: 'modal-appear 0.4s ease-out forwards',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    overflow: 'hidden', 
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain', 
  },
  localVideo: {
    position: 'absolute',
    top: '24px',
    right: '24px',
    width: '180px', 
    aspectRatio: '3/4',
    borderRadius: '16px',
    objectFit: 'cover',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    background: '#1a1a1a',
    transition: 'opacity 0.3s, width 0.3s',
    zIndex: 10,
  },
  avatarContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  avatar: {
    width: '140px',
    height: '140px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '56px',
    fontWeight: '600',
    color: '#fff',
    overflow: 'hidden',
    boxShadow: '0 0 60px rgba(59, 130, 246, 0.2)',
    zIndex: 5,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  incomingPulse: {
    position: 'absolute',
    width: '200px',
    height: '200px',
    borderRadius: '50%',
    border: '2px solid rgba(34, 197, 94, 0.5)',
    animation: 'pulse-ring 2s infinite',
  },
  info: {
    position: 'absolute',
    top: '48px',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: 20,
    pointerEvents: 'none',
  },
  userName: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '8px',
    textShadow: '0 2px 8px rgba(0,0,0,0.6)',
  },
  status: {
    fontSize: '16px',
    color: 'rgba(255,255,255,0.8)',
    textShadow: '0 1px 4px rgba(0,0,0,0.6)',
  },
  callTypeLabel: {
    marginTop: '6px',
    fontSize: '14px',
    color: '#60a5fa',
    textShadow: '0 1px 2px rgba(0,0,0,0.8)',
  },
  controls: {
    position: 'absolute',
    bottom: '40px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px', 
    padding: '12px 24px',
    borderRadius: '24px',
    background: 'rgba(30, 41, 59, 0.75)', 
    backdropFilter: 'blur(16px) saturate(180%)', 
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255,255,255,0.1)',
    zIndex: 50,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  controlBtn: {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(255, 255, 255, 0.05)', 
    color: '#e2e8f0', 
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  controlBtnActive: {
    background: '#3b82f6', 
    color: '#fff',
    boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)', 
    transform: 'scale(1.05)',
  },
  acceptBtn: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #22c55e, #16a34a)', 
    color: '#fff',
    fontSize: '32px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'pulse-btn 1.5s infinite',
    boxShadow: '0 8px 24px rgba(34, 197, 94, 0.4), inset 0 2px 4px rgba(255,255,255,0.2)',
  },
  declineBtn: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #ef4444, #dc2626)', 
    fontSize: '32px',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4), inset 0 2px 4px rgba(255,255,255,0.2)',
  },
  endBtn: {
    width: '52px', 
    height: '52px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(239, 68, 68, 0.9)', 
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: '12px',
    boxShadow: '0 4px 16px rgba(239, 68, 68, 0.3)',
    transition: 'all 0.2s ease',
  },
};

// Add keyframes for animations & scoped hover styles
if (typeof document !== 'undefined' && !document.getElementById('govchat-call-modal-style')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'govchat-call-modal-style';
  styleSheet.textContent = `
    @keyframes pulse-ring {
      0% { transform: scale(1); opacity: 0.6; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    
    @keyframes pulse-btn {
      0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
      50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
    }

    @keyframes modal-appear {
        from { transform: scale(0.95); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
    }

    .govchat-call-modal button:hover {
        transform: translateY(-2px); 
        filter: brightness(1.1);
    }
    
    .govchat-call-modal button:active {
        transform: translateY(0) scale(0.95);
    }
  `;
  document.head.appendChild(styleSheet);
}

export default CallModal;
