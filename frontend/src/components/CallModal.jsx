import React, { useEffect, useRef, useState, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

function CallModal({
  socket,
  callState,      // 'idle' | 'outgoing' | 'incoming' | 'active'
  callType,       // 'audio' | 'video'
  callId,
  chatId,
  remoteUser,     // { _id, name, avatarUrl }
  onClose,
}) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionState, setConnectionState] = useState('connecting');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const timerRef = useRef(null);

  // Инициализация медиа
  const initMedia = useCallback(async () => {
    try {
      const constraints = {
        audio: true,
        video: callType === 'video' ? { facingMode: 'user' } : false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error('Media error:', err);
      alert('Нет доступа к камере/микрофону');
      onClose?.();
      return null;
    }
  }, [callType, onClose]);

  // Создание PeerConnection
  const createPeerConnection = useCallback((stream) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    // Добавляем локальные треки
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Получаем удаленные треки
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStream(remoteStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };

    // ICE кандидаты
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('call:signal', {
          callId,
          targetUserId: remoteUser?._id,
          signal: {
            type: 'ice-candidate',
            candidate: event.candidate
          }
        });
      }
    };

    // Состояние соединения
    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (pc.connectionState === 'connected') {
        startTimer();
      }
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        handleEndCall();
      }
    };

    return pc;
  }, [socket, callId, remoteUser]);

  // Таймер звонка
  const startTimer = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setCallDuration(d => d + 1);
    }, 1000);
  };

  // Инициатор: создать offer
  const createOffer = useCallback(async (pc) => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('call:signal', {
      callId,
      targetUserId: remoteUser?._id,
      signal: {
        type: 'offer',
        sdp: offer.sdp
      }
    });
  }, [socket, callId, remoteUser]);

  // Принимающий: создать answer
  const createAnswer = useCallback(async (pc, offerSdp) => {
    await pc.setRemoteDescription(new RTCSessionDescription({
      type: 'offer',
      sdp: offerSdp
    }));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('call:signal', {
      callId,
      targetUserId: remoteUser?._id,
      signal: {
        type: 'answer',
        sdp: answer.sdp
      }
    });
  }, [socket, callId, remoteUser]);

  // Принять входящий звонок
  const handleAccept = useCallback(async () => {
    const stream = await initMedia();
    if (!stream) return;
    
    const pc = createPeerConnection(stream);
    socket.emit('call:accept', { callId }, (response) => {
      if (response.error) {
        console.error('Accept error:', response.error);
        handleEndCall();
      }
    });
  }, [initMedia, createPeerConnection, socket, callId]);

  // Отклонить звонок
  const handleDecline = useCallback(() => {
    socket.emit('call:decline', { callId });
    cleanup();
    onClose?.();
  }, [socket, callId, onClose]);

  // Завершить звонок
  const handleEndCall = useCallback(() => {
    socket.emit('call:leave', { callId });
    cleanup();
    onClose?.();
  }, [socket, callId, onClose]);

  // Очистка ресурсов
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
  }, [localStream]);

  // Переключение микрофона
  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Переключение камеры
  const toggleVideo = () => {
    if (localStream && callType === 'video') {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // Обработка сигналов WebRTC
  useEffect(() => {
    if (!socket) return;

    const handleSignal = async ({ fromUserId, signal }) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        if (signal.type === 'offer') {
          await createAnswer(pc, signal.sdp);
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription({
            type: 'answer',
            sdp: signal.sdp
          }));
        } else if (signal.type === 'ice-candidate' && signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (err) {
        console.error('Signal handling error:', err);
      }
    };

    const handleCallEnded = ({ reason }) => {
      cleanup();
      onClose?.();
    };

    socket.on('call:signal', handleSignal);
    socket.on('call:ended', handleCallEnded);
    socket.on('call:participant_left', handleCallEnded);

    return () => {
      socket.off('call:signal', handleSignal);
      socket.off('call:ended', handleCallEnded);
      socket.off('call:participant_left', handleCallEnded);
    };
  }, [socket, createAnswer, cleanup, onClose]);

  // Инициализация при исходящем звонке
  useEffect(() => {
    if (callState === 'outgoing') {
      (async () => {
        const stream = await initMedia();
        if (stream) {
          const pc = createPeerConnection(stream);
          // Создаём offer когда другой участник примет
        }
      })();
    }
  }, [callState, initMedia, createPeerConnection]);

  // Создание offer когда соединение готово
  useEffect(() => {
    if (callState === 'active' && peerConnectionRef.current && !peerConnectionRef.current.localDescription) {
      createOffer(peerConnectionRef.current);
    }
  }, [callState, createOffer]);

  // Cleanup при размонтировании
  useEffect(() => {
    return () => cleanup();
  }, []);

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Видео/аватар удалённого участника */}
        <div style={styles.videoContainer}>
          {callType === 'video' && remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={styles.remoteVideo}
            />
          ) : (
            <div style={styles.avatarContainer}>
              <div style={styles.avatar}>
                {remoteUser?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            </div>
          )}

          {/* Локальное видео (PiP) */}
          {callType === 'video' && localStream && (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={styles.localVideo}
            />
          )}
        </div>

        {/* Инфо */}
        <div style={styles.info}>
          <div style={styles.userName}>{remoteUser?.name || 'Пользователь'}</div>
          <div style={styles.status}>
            {callState === 'incoming' && 'Входящий звонок...'}
            {callState === 'outgoing' && 'Вызов...'}
            {callState === 'active' && (
              connectionState === 'connected'
                ? formatDuration(callDuration)
                : 'Подключение...'
            )}
          </div>
        </div>

        {/* Кнопки */}
        <div style={styles.controls}>
          {callState === 'incoming' ? (
            // Входящий звонок
            <>
              <button onClick={handleDecline} style={styles.declineBtn}>
                <span>✕</span>
              </button>
              <button onClick={handleAccept} style={styles.acceptBtn}>
                <span>{callType === 'video' ? '🎥' : '📞'}</span>
              </button>
            </>
          ) : (
            // Активный или исходящий звонок
            <>
              <button
                onClick={toggleMute}
                style={{
                  ...styles.controlBtn,
                  ...(isMuted ? styles.controlBtnActive : {})
                }}
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
                >
                  {isVideoOff ? '📷' : '🎥'}
                </button>
              )}

              <button onClick={handleEndCall} style={styles.endBtn}>
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
    background: 'rgba(0, 0, 0, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
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
  },
  avatarContainer: {
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

export default CallModal;
