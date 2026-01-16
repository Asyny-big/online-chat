import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL, LIVEKIT_URL } from '../config';
import { createLocalTracks, Room, RoomEvent, Track, VideoPresets } from 'livekit-client';
import { GroupCallGrid } from './livekit/GroupCallGrid';

/* ─────────────────────────────────────────────────────────────
   ICONS (SVG Components)
───────────────────────────────────────────────────────────── */
const Icons = {
  Mic: ({ off }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {off ? (
        <>
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94 0v5.12" />
          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </>
      ) : (
        <>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </>
      )}
    </svg>
  ),
  Camera: ({ off }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {off ? (
        <>
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M21 21l-3.5-3.5m-2-2l-2-2m-2-2l-2-2m-2-2l-3.5-3.5" />
          <path d="M15 7h2a2 2 0 0 1 2 2v2m0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1" />
          <polygon points="23 7 16 12 23 17 23 7" />
        </>
      ) : (
        <>
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </>
      )}
    </svg>
  ),
  Settings: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Hangup: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
    </svg>
  ),
  Users: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Phone: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  PhoneOff: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
  )
};

// UI state: pin + active speaker (smoothing)
const LOCAL_TILE_ID = 'local';

function GroupCallModalLiveKit({
  socket,
  callId,
  chatId,
  chatName,
  callType,
  isIncoming,
  autoJoin = false,
  initiator,
  existingParticipants = [],
  currentUserId,
  token,
  onClose,
  onJoin
}) {
  const [callStatus, setCallStatus] = useState(isIncoming ? 'incoming' : 'connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const [error, setError] = useState(null);
  const [remoteParticipants, setRemoteParticipants] = useState([]);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [showControls, setShowControls] = useState(true);

  const [pinnedId, setPinnedId] = useState(null); // 'local' | participant.sid | null
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);

  const roomRef = useRef(null);
  const localTracksRef = useRef([]);
  const isConnectingRef = useRef(false);
  const leaveSentRef = useRef(false);
  const mountedRef = useRef(true);
  const controlsTimeoutRef = useRef(null);
  const activeSpeakerHoldRef = useRef(null);
  const activeSpeakerLastSwitchTsRef = useRef(0);

  /* ─────────────────────────────────────────────────────────────
     AUTO-HIDE CONTROLS
  ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    const handleActivity = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        if (callStatus === 'active') {
          setShowControls(false);
        }
      }, 3500);
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('click', handleActivity);

    controlsTimeoutRef.current = setTimeout(() => {
      if (callStatus === 'active') {
        setShowControls(false);
      }
    }, 3500);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('click', handleActivity);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [callStatus]);

  const updateRemoteParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room || !mountedRef.current) return;

    const map = room.remoteParticipants;
    if (!map || typeof map.values !== 'function') {
      setRemoteParticipants([]);
      return;
    }

    setRemoteParticipants(Array.from(map.values()));
  }, []);

  const fetchIceServers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/webrtc/ice`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  }, [token]);

  const fetchLiveKitToken = useCallback(async () => {
    const room = String(callId || '').trim();
    const identity = String(currentUserId || '').trim();

    if (!room) {
      throw new Error('room is required');
    }
    if (!identity) {
      throw new Error('identity is required');
    }

    const url = `${API_URL}/livekit/token?room=${encodeURIComponent(room)}&identity=${encodeURIComponent(identity)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || 'Failed to get LiveKit token');
    }

    const data = await res.json();
    const lkToken = data?.token;
    if (typeof lkToken !== 'string' || !lkToken.trim()) {
      throw new Error('LiveKit token is invalid');
    }

    return lkToken;
  }, [callId, currentUserId, token]);

  const connectLiveKit = useCallback(async () => {
    if (isConnectingRef.current) return;
    if (!callId) return;

    isConnectingRef.current = true;
    setCallStatus('connecting');
    setError(null);

    try {
      if (socket && !leaveSentRef.current) {
        socket.emit('group-call:join', { callId, chatId });
      }

      const [lkToken, iceData] = await Promise.all([fetchLiveKitToken(), fetchIceServers()]);

      const rtcConfig = iceData?.iceServers ? { iceServers: iceData.iceServers } : undefined;

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      // Active speaker: используем серверные данные SFU (лучше, чем клиентский анализ).
      // Сглаживание (hold + minSwitch) — чтобы подсветка была «мягкой».
      const onActiveSpeakersChanged = (speakers) => {
        if (!mountedRef.current) return;
        const nextSid = Array.isArray(speakers) && speakers[0]?.sid ? speakers[0].sid : null;
        const now = Date.now();

        // Hold on silence
        if (!nextSid) {
          if (activeSpeakerHoldRef.current) clearTimeout(activeSpeakerHoldRef.current);
          activeSpeakerHoldRef.current = setTimeout(() => {
            if (mountedRef.current) setActiveSpeakerId(null);
          }, 900);
          return;
        }

        // min switch interval
        if (now - activeSpeakerLastSwitchTsRef.current < 450) return;
        activeSpeakerLastSwitchTsRef.current = now;

        if (activeSpeakerHoldRef.current) clearTimeout(activeSpeakerHoldRef.current);
        setActiveSpeakerId(nextSid);
      };
      room.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged);

      // Важно: подписки на события до/после connect допустимы,
      // но state-апдейты защищаем mountedRef.
      const sync = () => updateRemoteParticipants();
      room.on(RoomEvent.ParticipantConnected, sync);
      room.on(RoomEvent.ParticipantDisconnected, sync);
      room.on(RoomEvent.TrackPublished, sync);
      room.on(RoomEvent.TrackUnpublished, sync);
      room.on(RoomEvent.TrackSubscribed, sync);
      room.on(RoomEvent.TrackUnsubscribed, sync);

      try {
        await room.connect(LIVEKIT_URL, lkToken, {
          rtcConfig,
          autoSubscribe: true
        });
      } catch (e) {
        console.error('[LiveKit] room.connect() failed:', e);
        throw e;
      }

      // LiveKit: local tracks создаём один раз на join (не на re-render).
      // Под simulcast/priority: сюда можно добавить simulcast/publishOptions (см. комментарии ниже).
      const tracks = await createLocalTracks({
        audio: true,
        video:
          callType === 'video'
            ? {
                // Консервативные настройки: стабильнее на мобильных/плохой сети.
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 24, max: 30 }
              }
            : false
      });

      localTracksRef.current = tracks;

      // Публикация треков:
      // - video: simulcast слои (для SFU, до 12 участников)
      // - source: Camera/Microphone (для корректной маршрутизации/приоритизации)
      // - priority: (если поддерживается клиентом)
      const simulcastLayers = [VideoPresets?.h180, VideoPresets?.h360, VideoPresets?.h720].filter(Boolean);

      for (const track of tracks) {
        if (track.kind === 'video') {
          const publishOpts = {
            simulcast: simulcastLayers.length > 0,
            videoSimulcastLayers: simulcastLayers.length > 0 ? simulcastLayers : undefined,
            source: Track?.Source?.Camera,
            // priority доступен не во всех версиях; если нет — просто игнорируется.
            priority: Track?.Priority?.HIGH
          };
          await room.localParticipant.publishTrack(track, publishOpts);
        } else {
          const publishOpts = {
            source: Track?.Source?.Microphone,
            priority: Track?.Priority?.HIGH
          };
          await room.localParticipant.publishTrack(track, publishOpts);
        }
      }

      const localVideo = tracks.find((t) => t.kind === 'video') || null;
      if (mountedRef.current) {
        setLocalVideoTrack(localVideo);
        setCallStatus('active');
      }
      updateRemoteParticipants();
    } catch (err) {
      if (mountedRef.current) {
        setError(err?.message || 'LiveKit connection failed');
        setCallStatus('ended');
      }
    } finally {
      isConnectingRef.current = false;
    }
  }, [callId, chatId, callType, fetchIceServers, fetchLiveKitToken, socket, updateRemoteParticipants]);

  const disconnectLiveKit = useCallback(async () => {
    const room = roomRef.current;
    if (room) {
      try {
        room.removeAllListeners?.();
      } catch (_) {
        // no-op
      }
      room.disconnect();
      roomRef.current = null;
    }

    localTracksRef.current.forEach((track) => {
      try {
        track.stop();
      } catch (_) {
        // no-op
      }
    });
    localTracksRef.current = [];
    if (mountedRef.current) {
      setLocalVideoTrack(null);
      setRemoteParticipants([]);
      setPinnedId(null);
      setActiveSpeakerId(null);
    }
  }, []);

  const handleLeave = useCallback(async () => {
    if (!leaveSentRef.current && socket) {
      leaveSentRef.current = true;
      socket.emit('group-call:leave', { callId });
    }

    await disconnectLiveKit();
    setCallStatus('ended');
    onClose?.();
  }, [callId, disconnectLiveKit, onClose, socket]);

  const handleJoinClick = useCallback(async () => {
    onJoin?.(callId, callType);
    await connectLiveKit();
  }, [callId, callType, connectLiveKit, onJoin]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !isMuted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setIsMuted(next);
  }, [isMuted]);

  const toggleVideo = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !isVideoOff;
    await room.localParticipant.setCameraEnabled(!next);
    setIsVideoOff(next);
  }, [isVideoOff]);

  useEffect(() => {
    if (autoJoin) {
      handleJoinClick();
    } else if (!isIncoming) {
      connectLiveKit();
    }
  }, [autoJoin, connectLiveKit, handleJoinClick, isIncoming]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleEnded = () => {
      handleLeave();
    };

    socket.on('group-call:ended', handleEnded);
    return () => {
      socket.off('group-call:ended', handleEnded);
    };
  }, [handleLeave, socket]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      disconnectLiveKit();
    };
  }, [disconnectLiveKit]);

  const tiles = useMemo(() => {
    const localTile = {
      id: LOCAL_TILE_ID,
      name: 'Вы',
      isLocal: true,
      micMuted: isMuted,
      cameraOff: isVideoOff || callType === 'audio',
      videoTrack: localVideoTrack && !isVideoOff ? localVideoTrack : null,
      audioTrack: null
    };

    const remoteTiles = remoteParticipants.map((participant) => {
      const videoPubs =
        participant?.videoTrackPublications && typeof participant.videoTrackPublications.values === 'function'
          ? Array.from(participant.videoTrackPublications.values())
          : [];
      const audioPubs =
        participant?.audioTrackPublications && typeof participant.audioTrackPublications.values === 'function'
          ? Array.from(participant.audioTrackPublications.values())
          : [];

      // Детерминированный выбор camera/mic, чтобы видео не «перепрыгивало» между публикациями.
      const videoPub =
        videoPubs.find((p) => p?.source === Track?.Source?.Camera) ||
        videoPubs.find((p) => p?.track || p?.isMuted === true) ||
        null;
      const audioPub =
        audioPubs.find((p) => p?.source === Track?.Source?.Microphone) ||
        audioPubs.find((p) => p?.track || p?.isMuted === true) ||
        null;

      const videoTrack = videoPub?.track || null;
      const audioTrack = audioPub?.track || null;

      return {
        id: participant.sid,
        name: participant.identity,
        isLocal: false,
        micMuted: !!audioPub?.isMuted,
        cameraOff: !!videoPub?.isMuted || callType === 'audio',
        videoTrack,
        audioTrack
      };
    });

    return [localTile, ...remoteTiles].slice(0, 12);
  }, [callType, isMuted, isVideoOff, localVideoTrack, remoteParticipants]);

  // Если закрепили участника и он ушел — снимаем pin.
  useEffect(() => {
    if (!pinnedId) return;
    if (pinnedId === LOCAL_TILE_ID) return;
    const exists = remoteParticipants.some((p) => p.sid === pinnedId);
    if (!exists) setPinnedId(null);
  }, [pinnedId, remoteParticipants]);

  const participantCount = remoteParticipants.length + 1;

  const getStatusText = () => {
    switch (callStatus) {
      case 'connecting': return 'Подключение...';
      case 'active': return `${participantCount} участник${participantCount === 1 ? '' : participantCount < 5 ? 'а' : 'ов'}`;
      case 'incoming': return 'Входящий звонок';
      case 'ended': return 'Звонок завершён';
      default: return '';
    }
  };

  /* ─────────────────────────────────────────────────────────────
     RENDER: INCOMING CALL SCREEN
  ───────────────────────────────────────────────────────────── */
  if (callStatus === 'incoming' && !autoJoin) {
    return (
      <div style={styles.overlay}>
        <div style={styles.incomingModal}>
          {/* Animated rings */}
          <div style={styles.incomingRings}>
            <div style={styles.ring1} />
            <div style={styles.ring2} />
            <div style={styles.ring3} />
            <div style={styles.incomingAvatar}>
              <Icons.Users />
            </div>
          </div>

          <h2 style={styles.incomingTitle}>{chatName || 'Групповой звонок'}</h2>
          <p style={styles.incomingSubtitle}>Входящий групповой {callType === 'video' ? 'видео' : ''}звонок</p>

          <div style={styles.incomingActions}>
            <button style={styles.declineBtn} onClick={handleLeave}>
              <Icons.PhoneOff />
            </button>
            <button style={styles.acceptBtn} onClick={handleJoinClick}>
              <Icons.Phone />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────
     RENDER: MAIN CALL SCREEN
  ───────────────────────────────────────────────────────────── */
  return (
    <div style={styles.overlay}>
      {/* ─── HEADER ─── */}
      <header style={{
        ...styles.header,
        opacity: showControls ? 1 : 0,
        transform: showControls ? 'translateY(0)' : 'translateY(-20px)'
      }}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIcon}>
            <Icons.Users />
          </div>
          <div>
            <h1 style={styles.headerTitle}>{chatName || 'Групповой звонок'}</h1>
            <p style={styles.headerStatus}>{getStatusText()}</p>
          </div>
        </div>
      </header>

      {/* ─── ERROR TOAST ─── */}
      {error && (
        <div style={styles.errorToast}>
          <span style={styles.errorIcon}>⚠</span>
          {error}
        </div>
      )}

      {/* ─── VIDEO GRID ─── */}
      <main style={styles.videoContainer}>
        <div style={styles.videoGrid}>
          <GroupCallGrid
            tiles={tiles}
            pinnedId={pinnedId}
            activeSpeakerId={activeSpeakerId}
            onPinChange={setPinnedId}
          />
        </div>

        {/* Connecting overlay */}
        {callStatus === 'connecting' && (
          <div style={styles.connectingOverlay}>
            <div style={styles.spinner} />
            <p style={styles.connectingText}>Подключение к звонку...</p>
          </div>
        )}
      </main>

      {/* ─── CONTROL BAR ─── */}
      <footer style={{
        ...styles.controlBar,
        opacity: showControls ? 1 : 0,
        transform: showControls ? 'translateY(0)' : 'translateY(20px)'
      }}>
        <div style={styles.controlsWrapper}>
          {/* Mic button */}
          <button
            style={{
              ...styles.controlButton,
              ...(isMuted ? styles.controlButtonOff : {})
            }}
            onClick={toggleMute}
            disabled={callStatus !== 'active'}
            title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
          >
            <Icons.Mic off={isMuted} />
          </button>

          {/* Camera button */}
          {callType === 'video' && (
            <button
              style={{
                ...styles.controlButton,
                ...(isVideoOff ? styles.controlButtonOff : {})
              }}
              onClick={toggleVideo}
              disabled={callStatus !== 'active'}
              title={isVideoOff ? 'Включить камеру' : 'Выключить камеру'}
            >
              <Icons.Camera off={isVideoOff} />
            </button>
          )}

          {/* Settings button */}
          <button
            style={styles.controlButton}
            title="Настройки"
          >
            <Icons.Settings />
          </button>

          {/* Leave button */}
          <button
            style={styles.leaveButton}
            onClick={handleLeave}
            title="Покинуть звонок"
          >
            <Icons.Hangup />
          </button>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────────── */
const styles = {
  /* Overlay */
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 9999,
    overflow: 'hidden'
  },

  /* Header */
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
    zIndex: 10,
    transition: 'all 0.3s ease'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 14
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)'
  },
  headerTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: '#fff',
    letterSpacing: '-0.02em'
  },
  headerStatus: {
    margin: 0,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: 400
  },

  /* Video Container */
  videoContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 24px 100px',
    position: 'relative'
  },
  videoGrid: {
    width: '100%',
    maxWidth: 1400,
    maxHeight: '100%',
    alignContent: 'center'
  },

  /* Control Bar */
  controlBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    padding: '20px 24px 28px',
    background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    transition: 'all 0.3s ease',
    zIndex: 10
  },
  controlsWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 20px',
    background: 'rgba(30, 32, 44, 0.85)',
    borderRadius: 16,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
  },
  controlButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    border: 'none',
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none'
  },
  controlButtonOff: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444'
  },
  leaveButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginLeft: 8,
    boxShadow: '0 4px 15px rgba(220, 38, 38, 0.4)',
    outline: 'none'
  },

  /* Incoming Call Modal */
  incomingModal: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: 40
  },
  incomingRings: {
    position: 'relative',
    width: 140,
    height: 140,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32
  },
  ring1: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: '2px solid rgba(99, 102, 241, 0.3)',
    animation: 'pulse 2s ease-out infinite'
  },
  ring2: {
    position: 'absolute',
    width: '120%',
    height: '120%',
    borderRadius: '50%',
    border: '2px solid rgba(99, 102, 241, 0.2)',
    animation: 'pulse 2s ease-out infinite 0.5s'
  },
  ring3: {
    position: 'absolute',
    width: '140%',
    height: '140%',
    borderRadius: '50%',
    border: '2px solid rgba(99, 102, 241, 0.1)',
    animation: 'pulse 2s ease-out infinite 1s'
  },
  incomingAvatar: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    boxShadow: '0 8px 30px rgba(99, 102, 241, 0.5)',
    zIndex: 1
  },
  incomingTitle: {
    margin: 0,
    fontSize: 26,
    fontWeight: 600,
    color: '#fff',
    marginBottom: 8
  },
  incomingSubtitle: {
    margin: 0,
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 40
  },
  incomingActions: {
    display: 'flex',
    gap: 32
  },
  acceptBtn: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 8px 25px rgba(22, 163, 74, 0.5)',
    transition: 'all 0.2s ease'
  },
  declineBtn: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    border: 'none',
    background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 8px 25px rgba(220, 38, 38, 0.5)',
    transition: 'all 0.2s ease'
  },

  /* Error Toast */
  errorToast: {
    position: 'absolute',
    top: 80,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(127, 29, 29, 0.95)',
    color: '#fecaca',
    padding: '12px 20px',
    borderRadius: 12,
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    zIndex: 20,
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(8px)'
  },
  errorIcon: {
    fontSize: 16
  },

  /* Connecting Overlay */
  connectingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(15, 15, 26, 0.85)',
    backdropFilter: 'blur(8px)',
    gap: 20
  },
  spinner: {
    width: 48,
    height: 48,
    border: '3px solid rgba(99, 102, 241, 0.2)',
    borderTopColor: '#6366f1',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  connectingText: {
    margin: 0,
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: 500
  }
};

/* Inject keyframes for animations */
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes pulse {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(1.5); opacity: 0; }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    button:hover:not(:disabled) {
      transform: scale(1.05);
    }
    button:active:not(:disabled) {
      transform: scale(0.95);
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;
  if (!document.querySelector('#group-call-modal-styles')) {
    styleSheet.id = 'group-call-modal-styles';
    document.head.appendChild(styleSheet);
  }
}

export default GroupCallModalLiveKit;
