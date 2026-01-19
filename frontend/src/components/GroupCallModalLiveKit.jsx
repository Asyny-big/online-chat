import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL, LIVEKIT_URL } from '../config';
import { createLocalTracks, Room, RoomEvent } from 'livekit-client';
import ConnectionStatusBadge from './ConnectionStatusBadge';

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

/* ─────────────────────────────────────────────────────────────
   MEDIASTREAM VIDEO (SFU-only, 1 video element = 1 MediaStream)
   Важно: не создаём PeerConnection и не трогаем логику SFU.
───────────────────────────────────────────────────────────── */
const MediaStreamVideo = React.memo(function MediaStreamVideo({ mediaStreamTrack, muted, style }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    if (!mediaStreamTrack) {
      el.srcObject = null;
      return undefined;
    }

    const stream = new MediaStream([mediaStreamTrack]);
    el.srcObject = stream;

    const p = el.play?.();
    if (p && typeof p.catch === 'function') p.catch(() => {});

    return () => {
      // Не стопаем track (управляет LiveKit), только отвязываем.
      try {
        if (el.srcObject === stream) el.srcObject = null;
      } catch (_) {}
    };
  }, [mediaStreamTrack]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        background: '#0b1020',
        ...style
      }}
    />
  );
});

/* ─────────────────────────────────────────────────────────────
   AUDIO TRACK COMPONENT (unchanged logic)
───────────────────────────────────────────────────────────── */
function TrackAudio({ track }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!track || !ref.current) return undefined;
    track.attach(ref.current);
    return () => {
      track.detach(ref.current);
    };
  }, [track]);

  return <audio ref={ref} autoPlay />;
}

/* ─────────────────────────────────────────────────────────────
   PARTICIPANT TILE COMPONENT
───────────────────────────────────────────────────────────── */
const MainVideo = React.memo(function MainVideo({
  mediaStreamTrack,
  displayName,
  isLocal,
  isVideoOff,
  isSpeaking
}) {
  const initials = displayName ? displayName.slice(0, 2).toUpperCase() : '??';

  return (
    <div
      className="gvc-stage"
      style={{
        ...focusStyles.stage,
        ...(isSpeaking ? focusStyles.stageSpeaking : {})
      }}
    >
      {mediaStreamTrack && !isVideoOff ? (
        <MediaStreamVideo mediaStreamTrack={mediaStreamTrack} muted={isLocal} style={focusStyles.stageVideo} />
      ) : (
        <div style={focusStyles.stagePlaceholder}>
          <div style={focusStyles.stageAvatar}>{initials}</div>
        </div>
      )}

      <div style={focusStyles.nameOverlay}>
        <span style={focusStyles.nameText}>{displayName || 'Пользователь'}</span>
      </div>
    </div>
  );
});

const VideoThumbnail = React.memo(function VideoThumbnail({
  participantId,
  mediaStreamTrack,
  displayName,
  isLocal,
  isActive,
  isSpeaking,
  isVideoOff,
  onSelect
}) {
  const initials = displayName ? displayName.slice(0, 2).toUpperCase() : '??';

  const handleClick = useCallback(() => {
    onSelect?.(participantId);
  }, [onSelect, participantId]);

  return (
    <button
      type="button"
      className="gvc-thumb"
      onClick={handleClick}
      style={{
        ...thumbStyles.item,
        ...(isActive ? thumbStyles.itemActive : {}),
        ...(isSpeaking && !isActive ? thumbStyles.itemSpeaking : {})
      }}
      title={displayName || 'Пользователь'}
    >
      {mediaStreamTrack && !isVideoOff ? (
        <MediaStreamVideo
          mediaStreamTrack={mediaStreamTrack}
          muted={isLocal}
          style={thumbStyles.video}
        />
      ) : (
        <div style={thumbStyles.placeholder}>
          <div style={thumbStyles.avatar}>{initials}</div>
        </div>
      )}

      <div style={thumbStyles.nameOverlay}>
        <span style={thumbStyles.nameText}>{displayName || 'Пользователь'}</span>
      </div>
    </button>
  );
});

const ThumbnailsBar = React.memo(function ThumbnailsBar({ items, activeParticipantId, activeSpeakerId, onSelect }) {
  return (
    <div style={thumbStyles.bar}>
      <div style={thumbStyles.scroll} className="gvc-thumb-scroll">
        {items.map((item) => (
          <VideoThumbnail
            key={item.participantId}
            participantId={item.participantId}
            mediaStreamTrack={item.mediaStreamTrack}
            displayName={item.displayName}
            isLocal={item.isLocal}
            isActive={item.participantId === activeParticipantId}
            isSpeaking={item.participantId === activeSpeakerId}
            isVideoOff={item.isVideoOff}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
});

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

  // participants[userId].name — единый источник отображаемых имён
  const [participantsById, setParticipantsById] = useState(() => ({}));

  // Focus UX: один активный участник
  const [activeParticipantId, setActiveParticipantId] = useState(() => String(currentUserId || ''));
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);
  const userSelectedFocusRef = useRef(false);

  const roomRef = useRef(null);
  const localTracksRef = useRef([]);
  const isConnectingRef = useRef(false);
  const leaveSentRef = useRef(false);
  const mountedRef = useRef(true);
  const controlsTimeoutRef = useRef(null);

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
      // Запрашиваем список участников с именами (backend отдаёт { oderId, userName })
      if (socket && !leaveSentRef.current) {
        await new Promise((resolve) => {
          socket.emit('group-call:join', { callId, chatId }, (resp) => {
            try {
              if (resp?.participants && Array.isArray(resp.participants)) {
                setParticipantsById((prev) => {
                  const next = { ...prev };
                  resp.participants.forEach((p) => {
                    const pid = String(p?.oderId || '').trim();
                    if (!pid) return;
                    next[pid] = { name: String(p?.userName || '').trim() || prev?.[pid]?.name || '' };
                  });
                  return next;
                });
              }
            } catch (_) {
              // no-op
            }
            resolve();
          });
        });
      }

      // Подмешиваем инициатора и existingParticipants (если пришли)
      setParticipantsById((prev) => {
        const next = { ...prev };

        try {
          const initId = initiator?._id ? String(initiator._id) : '';
          if (initId) next[initId] = { name: String(initiator?.name || '').trim() || prev?.[initId]?.name || '' };
        } catch (_) {}

        try {
          if (Array.isArray(existingParticipants)) {
            existingParticipants.forEach((p) => {
              const pid = String(p?._id || p?.oderId || '').trim();
              const pname = String(p?.name || p?.userName || '').trim();
              if (!pid) return;
              next[pid] = { name: pname || prev?.[pid]?.name || '' };
            });
          }
        } catch (_) {}

        return next;
      });

      const [lkToken, iceData] = await Promise.all([fetchLiveKitToken(), fetchIceServers()]);

      const rtcConfig = iceData?.iceServers ? { iceServers: iceData.iceServers } : undefined;

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      // Важно: подписки на события до/после connect допустимы,
      // но state-апдейты защищаем mountedRef.
      const sync = () => updateRemoteParticipants();
      room.on(RoomEvent.ParticipantConnected, sync);
      room.on(RoomEvent.ParticipantDisconnected, sync);
      room.on(RoomEvent.TrackPublished, sync);
      room.on(RoomEvent.TrackUnpublished, sync);
      room.on(RoomEvent.TrackSubscribed, sync);
      room.on(RoomEvent.TrackUnsubscribed, sync);

      // Active speaker (для подсветки, и для авто-focus если пользователь не выбирал вручную)
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        try {
          const list = Array.isArray(speakers) ? speakers : [];
          const remote = list.filter((p) => p?.identity && p?.identity !== String(currentUserId || ''));
          if (remote.length === 0) {
            setActiveSpeakerId(null);
            return;
          }
          // Берём самого громкого из пришедших
          const loudest = remote
            .slice()
            .sort((a, b) => (b?.audioLevel || 0) - (a?.audioLevel || 0))[0];
          setActiveSpeakerId(String(loudest.identity));
        } catch (_) {
          // no-op
        }
      });

      try {
        await room.connect(LIVEKIT_URL, lkToken, {
          rtcConfig,
          autoSubscribe: true
        });
      } catch (e) {
        console.error('[LiveKit] room.connect() failed:', e);
        throw e;
      }

      const tracks = await createLocalTracks({
        audio: true,
        video: callType === 'video'
      });

      localTracksRef.current = tracks;

      await Promise.all(tracks.map((track) => room.localParticipant.publishTrack(track)));

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

  const getPeerConnection = useCallback(() => {
    // LiveKit скрывает RTCPeerConnection внутри engine, но для getStats() он часто доступен.
    // Это best-effort: если структура изменится, просто не будет stats.
    const room = roomRef.current;
    if (!room) return null;

    const candidates = [
      room?.engine?.pcManager?.publisher?.pc,
      room?.engine?.pcManager?.subscriber?.pc,
      room?.engine?.rtcEngine?.pcManager?.publisher?.pc,
      room?.engine?.rtcEngine?.pcManager?.subscriber?.pc
    ];

    for (const pc of candidates) {
      if (pc && typeof pc.getStats === 'function') return pc;
    }
    return null;
  }, []);

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

  // Поддерживаем participantsById актуальным по socket событиям
  useEffect(() => {
    if (!socket) return undefined;

    const onJoined = (payload) => {
      try {
        const pid = String(payload?.oderId || '').trim();
        const name = String(payload?.userName || '').trim();
        if (!pid) return;
        setParticipantsById((prev) => ({
          ...prev,
          [pid]: { name: name || prev?.[pid]?.name || '' }
        }));
      } catch (_) {}
    };

    const onLeft = (payload) => {
      try {
        const pid = String(payload?.oderId || '').trim();
        if (!pid) return;
        // Не удаляем запись — имена могут понадобиться для UI истории/анимаций.
      } catch (_) {}
    };

    socket.on('group-call:participant-joined', onJoined);
    socket.on('group-call:participant-left', onLeft);

    return () => {
      socket.off('group-call:participant-joined', onJoined);
      socket.off('group-call:participant-left', onLeft);
    };
  }, [socket]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      disconnectLiveKit();
    };
  }, [disconnectLiveKit]);

  const participantCount = remoteParticipants.length + 1;

  const remoteMedia = useMemo(() => {
    return remoteParticipants
      .map((participant) => {
        const identity = String(participant?.identity || '').trim();
        if (!identity) return null;

        const videoPubs = participant?.videoTrackPublications && typeof participant.videoTrackPublications.values === 'function'
          ? Array.from(participant.videoTrackPublications.values())
          : [];
        const audioPubs = participant?.audioTrackPublications && typeof participant.audioTrackPublications.values === 'function'
          ? Array.from(participant.audioTrackPublications.values())
          : [];

        const videoPub = videoPubs.find((p) => p?.track) || null;
        const audioPub = audioPubs.find((p) => p?.track) || null;

        const videoTrack = videoPub?.track || null;
        const audioTrack = audioPub?.track || null;

        return {
          participant,
          participantId: identity,
          videoTrack,
          audioTrack,
          isSpeaking: !!participant?.isSpeaking,
          audioLevel: typeof participant?.audioLevel === 'number' ? participant.audioLevel : 0
        };
      })
      .filter(Boolean);
  }, [remoteParticipants]);

  const getDisplayName = useCallback((userId) => {
    const id = String(userId || '').trim();
    if (!id) return 'Пользователь';
    if (id === String(currentUserId || '')) return 'Вы';
    const name = participantsById?.[id]?.name;
    return (typeof name === 'string' && name.trim()) ? name.trim() : 'Пользователь';
  }, [currentUserId, participantsById]);

  // Автовыбор focus (инициатор/первый участник), и защита если текущий focus ушёл
  useEffect(() => {
    if (callStatus !== 'active') return;

    const current = String(activeParticipantId || '').trim();
    const localId = String(currentUserId || '').trim();

    const remoteIds = new Set(remoteMedia.map((r) => r.participantId));

    const isCurrentValid = current && (current === localId || remoteIds.has(current));
    if (isCurrentValid) return;

    // Если focus недействителен — выбираем следующий доступный
    const initiatorId = initiator?._id ? String(initiator._id) : '';
    const next =
      (activeSpeakerId && remoteIds.has(String(activeSpeakerId)) ? String(activeSpeakerId) : '') ||
      (initiatorId && remoteIds.has(initiatorId) ? initiatorId : '') ||
      (remoteMedia[0]?.participantId || '') ||
      localId;

    setActiveParticipantId(next);
  }, [activeParticipantId, activeSpeakerId, callStatus, currentUserId, initiator, remoteMedia]);

  // Авто-focus на active speaker (только если пользователь не выбирал вручную)
  useEffect(() => {
    if (callStatus !== 'active') return;
    if (userSelectedFocusRef.current) return;
    if (!activeSpeakerId) return;

    const speakerId = String(activeSpeakerId).trim();
    if (!speakerId) return;

    const exists = remoteMedia.some((r) => r.participantId === speakerId);
    if (!exists) return;

    setActiveParticipantId(speakerId);
  }, [activeSpeakerId, callStatus, remoteMedia]);

  const handleSelectParticipant = useCallback((userId) => {
    const id = String(userId || '').trim();
    if (!id) return;
    userSelectedFocusRef.current = true;
    setActiveParticipantId(id);
  }, []);

  const focusTarget = useMemo(() => {
    const id = String(activeParticipantId || '').trim();
    const localId = String(currentUserId || '').trim();
    if (!id || id === localId) {
      return {
        participantId: localId,
        isLocal: true,
        videoMediaStreamTrack: localVideoTrack?.mediaStreamTrack || null,
        isVideoOff,
        displayName: getDisplayName(localId),
        isSpeaking: false
      };
    }

    const remote = remoteMedia.find((r) => r.participantId === id) || null;
    return {
      participantId: id,
      isLocal: false,
      videoMediaStreamTrack: remote?.videoTrack?.mediaStreamTrack || null,
      isVideoOff: false,
      displayName: getDisplayName(id),
      isSpeaking: id === activeSpeakerId
    };
  }, [activeParticipantId, activeSpeakerId, currentUserId, getDisplayName, isVideoOff, localVideoTrack, remoteMedia]);

  const thumbnailItems = useMemo(() => {
    const localId = String(currentUserId || '').trim();
    const localItem = {
      participantId: localId,
      isLocal: true,
      mediaStreamTrack: localVideoTrack?.mediaStreamTrack || null,
      displayName: getDisplayName(localId),
      isVideoOff
    };

    const remoteItems = remoteMedia.map((r) => ({
      participantId: r.participantId,
      isLocal: false,
      mediaStreamTrack: r?.videoTrack?.mediaStreamTrack || null,
      displayName: getDisplayName(r.participantId),
      isVideoOff: false
    }));

    return [localItem, ...remoteItems];
  }, [currentUserId, getDisplayName, isVideoOff, localVideoTrack, remoteMedia]);

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
      {/* Floating connection badge (SFU) */}
      <ConnectionStatusBadge getPeerConnection={getPeerConnection} connectionKind="sfu" placement="top-right" />

      {/* ─── HEADER ─── */}
      <header style={{
        ...styles.header,
        opacity: showControls ? 1 : 0,
        transform: showControls ? 'translateY(0)' : 'translateY(-12px)'
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

      {/* ─── MAIN STAGE + THUMBNAILS ─── */}
      <main style={styles.content}>
        {/* Аудио выводим отдельно, чтобы не было дублирования при переключении focus */}
        <div style={styles.hiddenAudioLayer}>
          {remoteMedia.map((r) => (
            r.audioTrack ? <TrackAudio key={`aud:${r.participantId}`} track={r.audioTrack} /> : null
          ))}
        </div>

        <div style={styles.stageWrap}>
          <MainVideo
            mediaStreamTrack={focusTarget.videoMediaStreamTrack}
            displayName={focusTarget.displayName}
            isLocal={focusTarget.isLocal}
            isVideoOff={focusTarget.isLocal ? focusTarget.isVideoOff : false}
            isSpeaking={focusTarget.isSpeaking}
          />
        </div>

        <ThumbnailsBar
          items={thumbnailItems}
          activeParticipantId={String(activeParticipantId || '').trim()}
          activeSpeakerId={activeSpeakerId}
          onSelect={handleSelectParticipant}
        />

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
        transform: showControls ? 'translateY(0)' : 'translateY(12px)',
        pointerEvents: showControls ? 'auto' : 'none'
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
    overflow: 'hidden',
    paddingTop: 'env(safe-area-inset-top)',
    paddingBottom: 'env(safe-area-inset-bottom)'
  },

  /* Header */
  header: {
    position: 'relative',
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

  /* Main Content */
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    position: 'relative',
    padding: '12px 16px 0'
  },
  hiddenAudioLayer: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)'
  },
  stageWrap: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 10
  },

  /* Control Bar */
  controlBar: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
    background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)',
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

/* ─────────────────────────────────────────────────────────────
   FOCUS VIEW + THUMBNAILS STYLES
───────────────────────────────────────────────────────────── */
const focusStyles = {
  stage: {
    position: 'relative',
    width: '100%',
    height: '100%',
    maxWidth: 1600,
    background: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 16,
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 10px 40px rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  stageSpeaking: {
    border: '1px solid rgba(34, 197, 94, 0.45)',
    boxShadow: '0 10px 50px rgba(34, 197, 94, 0.12)'
  },
  stageVideo: {
    width: '100%',
    height: '100%',
    // ВАЖНО: главное видео НЕ cover
    objectFit: 'contain',
    background: 'black'
  },
  stagePlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(145deg, rgba(30, 32, 44, 0.9) 0%, rgba(10, 12, 20, 0.9) 100%)'
  },
  stageAvatar: {
    width: 120,
    height: 120,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 34,
    fontWeight: 700,
    letterSpacing: '0.02em',
    boxShadow: '0 12px 40px rgba(99, 102, 241, 0.35)'
  },
  nameOverlay: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    padding: '8px 10px',
    borderRadius: 10,
    background: 'rgba(0,0,0,0.55)',
    border: '1px solid rgba(255,255,255,0.10)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    maxWidth: '75%'
  },
  nameText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block'
  }
};

const thumbStyles = {
  bar: {
    flexShrink: 0,
    height: 'clamp(64px, 14vh, 120px)',
    padding: '8px 0 12px'
  },
  scroll: {
    display: 'flex',
    gap: 10,
    overflowX: 'auto',
    overflowY: 'hidden',
    padding: '0 4px',
    WebkitOverflowScrolling: 'touch'
  },
  item: {
    position: 'relative',
    flex: '0 0 auto',
    height: '100%',
    width: 'min(28vw, 200px)',
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.10)',
    background: 'rgba(0,0,0,0.25)',
    padding: 0,
    cursor: 'pointer',
    outline: 'none'
  },
  itemActive: {
    border: '2px solid rgba(99, 102, 241, 0.95)',
    boxShadow: '0 8px 25px rgba(99, 102, 241, 0.22)'
  },
  itemSpeaking: {
    border: '1px solid rgba(34, 197, 94, 0.55)'
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  placeholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(145deg, rgba(30, 32, 44, 0.9) 0%, rgba(10, 12, 20, 0.9) 100%)'
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700
  },
  nameOverlay: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
    padding: '4px 6px',
    borderRadius: 8,
    background: 'rgba(0,0,0,0.55)',
    border: '1px solid rgba(255,255,255,0.10)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)'
  },
  nameText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block'
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

    /* Mobile tweaks */
    @media (max-width: 768px) {
      .gvc-thumb {
        width: min(38vw, 160px);
        height: 100%;
        border-radius: 10px;
      }
      .gvc-thumb-scroll {
        gap: 8px;
      }
      .gvc-stage {
        border-radius: 14px;
      }
    }
  `;
  if (!document.querySelector('#group-call-modal-styles')) {
    styleSheet.id = 'group-call-modal-styles';
    document.head.appendChild(styleSheet);
  }
}

export default GroupCallModalLiveKit;
