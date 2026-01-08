import React, { useEffect, useRef, useState, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Публичные TURN сервера для улучшения NAT traversal
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10
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
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionState, setConnectionState] = useState('new');
  const [hasLocalStream, setHasLocalStream] = useState(false);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const timerRef = useRef(null);
  const ringtoneRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const isInitiatorRef = useRef(false);

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
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    pendingCandidatesRef.current = [];
    setHasLocalStream(false);
    setHasRemoteStream(false);
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
  const createPeerConnection = useCallback((stream) => {
    console.log('[CallModal] Creating PeerConnection');
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    const pc = new RTCPeerConnection(ICE_SERVERS);
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
      if (event.candidate && socket && remoteUser?._id) {
        console.log('[CallModal] Sending ICE candidate');
        socket.emit('call:signal', {
          callId,
          targetUserId: remoteUser._id,
          signal: {
            type: 'ice-candidate',
            candidate: event.candidate.toJSON()
          }
        });
      }
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
      
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        console.log('[CallModal] Connection ended:', pc.connectionState);
      }
    };
    
    pc.oniceconnectionstatechange = () => {
      console.log('[CallModal] ICE state:', pc.iceConnectionState);
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

  // Create and send offer (initiator)
  const createAndSendOffer = useCallback(async (pc) => {
    try {
      console.log('[CallModal] Creating offer');
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video'
      });
      
      console.log('[CallModal] Setting local description (offer)');
      await pc.setLocalDescription(offer);
      
      console.log('[CallModal] Sending offer via socket');
      socket.emit('call:signal', {
        callId,
        targetUserId: remoteUser?._id,
        signal: {
          type: 'offer',
          sdp: offer.sdp
        }
      });
    } catch (err) {
      console.error('[CallModal] Error creating offer:', err);
    }
  }, [socket, callId, remoteUser, callType]);

  // Handle incoming offer and send answer
  const handleOffer = useCallback(async (pc, offerSdp) => {
    try {
      console.log('[CallModal] Handling offer');
      
      await pc.setRemoteDescription(new RTCSessionDescription({
        type: 'offer',
        sdp: offerSdp
      }));
      
      console.log('[CallModal] Creating answer');
      const answer = await pc.createAnswer();
      
      console.log('[CallModal] Setting local description (answer)');
      await pc.setLocalDescription(answer);
      
      console.log('[CallModal] Sending answer via socket');
      socket.emit('call:signal', {
        callId,
        targetUserId: remoteUser?._id,
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
    
    // Get media first
    const stream = await initMedia();
    if (!stream) {
      console.error('[CallModal] Failed to get media for accepting call');
      return;
    }
    
    // Create peer connection
    const pc = createPeerConnection(stream);
    
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
  }, [initMedia, createPeerConnection, socket, callId, cleanup, onClose, onCallAccepted]);

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
          await handleOffer(pc, signal.sdp);
        } else if (signal.type === 'answer') {
          await handleAnswer(pc, signal.sdp);
        } else if (signal.type === 'ice-candidate' && signal.candidate) {
          await handleIceCandidate(pc, signal.candidate);
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
      console.log('[CallModal] Participant joined:', userName, 'joinedUserId:', joinedUserId, 'isInitiator:', isInitiatorRef.current);
      
      // If we are the initiator and someone joined, send offer
      if (isInitiatorRef.current && peerConnectionRef.current) {
        console.log('[CallModal] We are initiator, sending offer to joined participant');
        await createAndSendOffer(peerConnectionRef.current);
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
  }, [socket, callId, handleOffer, handleAnswer, handleIceCandidate, createAndSendOffer, cleanup, onClose]);

  // Initialize call based on state
  useEffect(() => {
    let isMounted = true;
    
    const initCall = async () => {
      if (callState === 'outgoing') {
        // Outgoing call: we are the initiator
        console.log('[CallModal] Initializing OUTGOING call');
        isInitiatorRef.current = true;
        
        const stream = await initMedia();
        if (!stream || !isMounted) return;
        
        createPeerConnection(stream);
        // Wait for participant_joined to send offer
        
      } else if (callState === 'incoming') {
        // Incoming call: play ringtone
        console.log('[CallModal] Initializing INCOMING call');
        isInitiatorRef.current = false;
        
        ringtoneRef.current = createRingtone();
        ringtoneRef.current.play();
      }
    };
    
    initCall();
    
    return () => {
      isMounted = false;
    };
  }, [callState, initMedia, createPeerConnection]);

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
                ...styles.remoteVideo,
                display: hasRemoteStream ? 'block' : 'none'
              }}
            />
          ) : null}
          
          {/* Avatar placeholder when no remote video */}
          {(!hasRemoteStream || callType === 'audio') && (
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
                ...styles.localVideo,
                opacity: hasLocalStream ? 1 : 0
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
