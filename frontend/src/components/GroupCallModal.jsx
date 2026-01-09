import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL } from '../config';

/**
 * GroupCallModal - Компонент для групповых видео/аудио звонков
 * Использует mesh-топологию WebRTC (каждый участник соединён с каждым)
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
  // Состояния
  const [callStatus, setCallStatus] = useState(isIncoming ? 'incoming' : 'connecting');
  const [participants, setParticipants] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [iceServers, setIceServers] = useState([]);

  // Refs
  const localVideoRef = useRef(null);
  const peerConnectionsRef = useRef({}); // { oderId: RTCPeerConnection }
  const remoteStreamsRef = useRef({}); // { oderId: MediaStream }
  const pendingCandidatesRef = useRef({}); // { oderId: ICECandidate[] }
  const ringtoneRef = useRef(null);
  const callIdRef = useRef(callId);
  const localStreamRef = useRef(null);

  // Обновляем ref при изменении callId
  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);

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

  // Получение локального медиа-потока
  const getLocalStream = useCallback(async () => {
    try {
      const constraints = {
        audio: true,
        video: callType === 'video' ? { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          facingMode: 'user'
        } : false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      return stream;
    } catch (err) {
      console.error('[GroupCall] Failed to get local stream:', err);
      alert('Не удалось получить доступ к камере/микрофону');
      return null;
    }
  }, [callType]);

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

    // Получение удалённого потока
    pc.ontrack = (event) => {
      console.log('[GroupCall] Received remote track from:', oderId);
      if (event.streams && event.streams[0]) {
        remoteStreamsRef.current[oderId] = event.streams[0];
        setParticipants(prev => {
          const exists = prev.find(p => p.oderId === oderId);
          if (exists) {
            return prev.map(p => 
              p.oderId === oderId 
                ? { ...p, stream: event.streams[0] }
                : p
            );
          }
          return [...prev, { oderId, stream: event.streams[0] }];
        });
      }
    };

    // Состояние соединения
    pc.onconnectionstatechange = () => {
      console.log('[GroupCall] Connection state for', oderId, ':', pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        // Попробуем переподключиться
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
  }, [iceServers, socket]);

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

  // Socket обработчики
  useEffect(() => {
    if (!socket) return;

    // Новый участник присоединился
    const handleParticipantJoined = ({ oderId, userName }) => {
      console.log('[GroupCall] Participant joined:', oderId, userName);
      if (oderId !== currentUserId && callStatus === 'active') {
        // Ждём offer от нового участника
        setParticipants(prev => {
          if (!prev.find(p => p.oderId === oderId)) {
            return [...prev, { oderId, userName, stream: null }];
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
      
      // Удаляем из участников
      setParticipants(prev => prev.filter(p => p.oderId !== oderId));
      delete remoteStreamsRef.current[oderId];
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
  }, [socket, currentUserId, callStatus, handleSignal, onClose]);

  // Очистка ресурсов
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
    remoteStreamsRef.current = {};

    // Останавливаем рингтон
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current = null;
    }
  }, [screenStream]);

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

  // Рендер активного звонка
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
                {participants.length + 1} участник(ов)
              </p>
            </div>
          </div>
          <div style={styles.callStatus}>
            {callStatus === 'connecting' ? '🔄 Подключение...' : '🟢 В звонке'}
          </div>
        </div>

        {/* Сетка видео */}
        <div style={styles.videoGrid}>
          {/* Локальное видео */}
          <div style={styles.videoContainer}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                ...styles.video,
                ...(isVideoOff ? styles.videoOff : {})
              }}
            />
            <div style={styles.videoLabel}>
              Вы {isScreenSharing && '(Демонстрация экрана)'}
            </div>
            {isVideoOff && (
              <div style={styles.avatarPlaceholder}>
                <span>👤</span>
              </div>
            )}
            {isMuted && <div style={styles.mutedIndicator}>🔇</div>}
          </div>

          {/* Видео участников */}
          {participants.map(participant => (
            <div key={participant.oderId} style={styles.videoContainer}>
              {participant.stream ? (
                <VideoPlayer stream={participant.stream} />
              ) : (
                <div style={styles.avatarPlaceholder}>
                  <span>👤</span>
                </div>
              )}
              <div style={styles.videoLabel}>
                {participant.userName || 'Участник'}
              </div>
            </div>
          ))}
        </div>

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

// Компонент для отображения удалённого видео
function VideoPlayer({ stream }) {
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
      style={styles.video}
    />
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
    zIndex: 10000,
  },
  modal: {
    width: '100%',
    height: '100%',
    maxWidth: '1200px',
    maxHeight: '800px',
    background: '#1e293b',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    margin: '16px',
  },
  header: {
    padding: '16px 20px',
    background: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #334155',
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
    color: '#94a3b8',
    fontSize: '13px',
  },
  callStatus: {
    color: '#22c55e',
    fontSize: '14px',
  },
  videoGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '12px',
    padding: '16px',
    overflow: 'auto',
  },
  videoContainer: {
    position: 'relative',
    background: '#0f172a',
    borderRadius: '12px',
    overflow: 'hidden',
    minHeight: '200px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  videoOff: {
    opacity: 0,
  },
  videoLabel: {
    position: 'absolute',
    bottom: '8px',
    left: '8px',
    background: 'rgba(0, 0, 0, 0.6)',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
  },
  avatarPlaceholder: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '64px',
    color: '#64748b',
  },
  mutedIndicator: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    background: 'rgba(239, 68, 68, 0.8)',
    borderRadius: '50%',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
  },
  controls: {
    padding: '16px',
    background: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    borderTop: '1px solid #334155',
  },
  controlBtn: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    border: 'none',
    background: '#334155',
    color: '#fff',
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
    transition: 'all 0.2s',
  },
  // Входящий звонок
  incomingModal: {
    background: '#1e293b',
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
    color: '#94a3b8',
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

export default GroupCallModal;
