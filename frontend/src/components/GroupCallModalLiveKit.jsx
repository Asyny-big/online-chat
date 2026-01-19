import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL, LIVEKIT_URL } from '../config';
import { createLocalTracks, Room, RoomEvent, Track } from 'livekit-client';

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
  ),
  ScreenShare: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M12 7v6" />
      <path d="M9.5 10.5L12 13l2.5-2.5" />
    </svg>
  )
};

/* ─────────────────────────────────────────────────────────────
   MEDIASTREAM VIDEO (SFU-only, 1 video element = 1 MediaStream)
   Важно: не создаём PeerConnection и не трогаем логику SFU.
───────────────────────────────────────────────────────────── */
const MediaStreamVideo = React.memo(function MediaStreamVideo({ mediaStreamTrack, muted, className, onTrackEnded }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const attachedTrackRef = useRef(null);
  const endedHandlerRef = useRef(null);

  // Создаём MediaStream ровно один раз на video-элемент (mount) и назначаем srcObject один раз.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return undefined;

    if (!streamRef.current) {
      streamRef.current = new MediaStream();
    }

    // Назначаем srcObject только если ещё не назначен наш stream.
    try {
      if (el.srcObject !== streamRef.current) {
        el.srcObject = streamRef.current;
      }
    } catch (_) {
      // no-op
    }

    const p = el.play?.();
    if (p && typeof p.catch === 'function') p.catch(() => {});

    return () => {
      // На unmount: полностью отвязываем srcObject, чтобы не держать last frame.
      try {
        el.srcObject = null;
      } catch (_) {}
    };
  }, []);

  // Аккуратно обновляем track внутри существующего MediaStream без пересоздания stream/srcObject.
  useEffect(() => {
    const el = videoRef.current;
    const stream = streamRef.current;
    if (!el || !stream) return undefined;

    const prev = attachedTrackRef.current;
    const next = mediaStreamTrack || null;

    if (prev === next) return undefined;

    // Снимаем обработчик ended с предыдущего track.
    if (prev && endedHandlerRef.current) {
      try {
        prev.removeEventListener?.('ended', endedHandlerRef.current);
      } catch (_) {}
    }

    // Удаляем предыдущий track из stream.
    if (prev) {
      try {
        stream.removeTrack(prev);
      } catch (_) {}
    }

    attachedTrackRef.current = next;

    // Если next отсутствует — оставляем stream пустым; сам <video> обычно размонтируется выше.
    if (!next) {
      // Доп. защита: можно сбросить srcObject, чтобы не держать последний кадр.
      try {
        el.srcObject = null;
      } catch (_) {}
      onTrackEnded?.();
      return undefined;
    }

    // Добавляем новый track.
    try {
      stream.addTrack(next);
    } catch (_) {}

    // Если srcObject был сброшен — восстанавливаем ссылку на тот же stream (не новый!).
    try {
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
    } catch (_) {}

    const handleEnded = () => {
      // Для кейса track stopped: убираем track из stream и сбрасываем srcObject.
      try {
        stream.removeTrack(next);
      } catch (_) {}
      try {
        if (el.srcObject === stream) el.srcObject = null;
      } catch (_) {}
      attachedTrackRef.current = null;
      onTrackEnded?.();
    };

    endedHandlerRef.current = handleEnded;
    try {
      next.addEventListener?.('ended', handleEnded);
    } catch (_) {}

    return () => {
      try {
        next.removeEventListener?.('ended', handleEnded);
      } catch (_) {}
    };
  }, [mediaStreamTrack, onTrackEnded]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={className}
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
  isSpeaking,
  onTrackEnded
}) {
  const initials = displayName ? displayName.slice(0, 2).toUpperCase() : '??';

  return (
    <div className={`gvc-stage ${isSpeaking ? 'speaking' : ''}`}>
      {mediaStreamTrack && !isVideoOff ? (
        <MediaStreamVideo 
          mediaStreamTrack={mediaStreamTrack} 
          muted={isLocal} 
          className="gvc-stage-video"
          onTrackEnded={onTrackEnded}
        />
      ) : (
        <div className="gvc-stage-placeholder">
          <div className="gvc-stage-avatar">{initials}</div>
        </div>
      )}

      <div className="gvc-stage-name">
        <span>{displayName || 'Пользователь'}</span>
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
  onSelect,
  onTrackEnded
}) {
  const initials = displayName ? displayName.slice(0, 2).toUpperCase() : '??';

  const handleClick = useCallback(() => {
    onSelect?.(participantId);
  }, [onSelect, participantId]);

  return (
    <button
      type="button"
      className={`gvc-thumb ${isActive ? 'active' : ''} ${isSpeaking && !isActive ? 'speaking' : ''}`}
      onClick={handleClick}
      title={displayName || 'Пользователь'}
    >
      {mediaStreamTrack && !isVideoOff ? (
        <MediaStreamVideo
          mediaStreamTrack={mediaStreamTrack}
          muted={isLocal}
          className="gvc-thumb-video"
          onTrackEnded={onTrackEnded}
        />
      ) : (
        <div className="gvc-thumb-placeholder">
          <div className="gvc-thumb-avatar">{initials}</div>
        </div>
      )}

      <div className="gvc-thumb-name">
        <span>{displayName || 'Пользователь'}</span>
      </div>
    </button>
  );
});

const ThumbnailsBar = React.memo(function ThumbnailsBar({ items, activeParticipantId, activeSpeakerId, onSelect }) {
  return (
    <div className="gvc-strip">
      <div className="gvc-strip-scroll">
        {items.map((item) => (
          <VideoThumbnail
            key={item.key}
            participantId={item.participantId}
            mediaStreamTrack={item.mediaStreamTrack}
            displayName={item.displayName}
            isLocal={item.isLocal}
            isActive={item.participantId === activeParticipantId}
            isSpeaking={item.participantId === activeSpeakerId}
            isVideoOff={item.isVideoOff}
            onSelect={onSelect}
            onTrackEnded={item.onTrackEnded}
          />
        ))}
      </div>
    </div>
  );
});

function isLiveMediaStreamTrack(track) {
  return !!track && track.readyState === 'live';
}

function isScreenSharePublication(pub) {
  const source = pub?.source;
  const ss = Track?.Source?.ScreenShare;
  if (ss && source === ss) return true;
  const s = String(source || '').toLowerCase();
  return s.includes('screen');
}

function isCameraPublication(pub) {
  const source = pub?.source;
  const cam = Track?.Source?.Camera;
  if (cam && source === cam) return true;
  const s = String(source || '').toLowerCase();
  // fallback: not screen share and is video
  return !s.includes('screen');
}

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
  // UI-only: всегда показываем контролы (без таймеров/auto-hide)
  const showControls = true;

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

  const syncUiFromTracks = useCallback(() => {
    // Один лёгкий setState для перерендера UI при изменениях track lifecycle
    // (muted/unmuted/unsubscribed/unpublished/ended).
    updateRemoteParticipants();
  }, [updateRemoteParticipants]);

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

      // Для кейса "видео выключено" (muted) — обновляем UI без костылей.
      if (RoomEvent.TrackMuted) room.on(RoomEvent.TrackMuted, sync);
      if (RoomEvent.TrackUnmuted) room.on(RoomEvent.TrackUnmuted, sync);

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
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30, max: 30 }
            }
          : false
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

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    const lp = room?.localParticipant;
    if (!lp || typeof lp.setScreenShareEnabled !== 'function') return;

    const pubs = lp.videoTrackPublications && typeof lp.videoTrackPublications.values === 'function'
      ? Array.from(lp.videoTrackPublications.values())
      : [];

    const hasScreen = pubs.some((p) => isScreenSharePublication(p) && p?.track);
    await lp.setScreenShareEnabled(!hasScreen);
    syncUiFromTracks();
  }, [syncUiFromTracks]);

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

        const screenPub = videoPubs.find((p) => isScreenSharePublication(p) && p?.track) || null;
        const cameraPub = videoPubs.find((p) => isCameraPublication(p) && p?.track) || null;
        const audioPub = audioPubs.find((p) => p?.track) || null;

        const cameraTrack = cameraPub?.track || null;
        const screenTrack = screenPub?.track || null;
        const audioTrack = audioPub?.track || null;

        const cameraMs = cameraTrack?.mediaStreamTrack || null;
        const screenMs = screenTrack?.mediaStreamTrack || null;

        const cameraActive = !!cameraPub && !cameraPub.isMuted && isLiveMediaStreamTrack(cameraMs);
        const screenActive = !!screenPub && !screenPub.isMuted && isLiveMediaStreamTrack(screenMs);

        return {
          participant,
          participantId: identity,
          cameraMediaStreamTrack: cameraActive ? cameraMs : null,
          screenMediaStreamTrack: screenActive ? screenMs : null,
          isCameraOff: !cameraActive,
          isScreenOff: !screenActive,
          audioTrack,
          isSpeaking: !!participant?.isSpeaking,
          audioLevel: typeof participant?.audioLevel === 'number' ? participant.audioLevel : 0
        };
      })
      .filter(Boolean);
  }, [remoteParticipants]);

  const localScreenMediaStreamTrack = useMemo(() => {
    const room = roomRef.current;
    const lp = room?.localParticipant;
    const pubs = lp?.videoTrackPublications && typeof lp.videoTrackPublications.values === 'function'
      ? Array.from(lp.videoTrackPublications.values())
      : [];
    const screenPub = pubs.find((p) => isScreenSharePublication(p) && p?.track) || null;
    const screenTrack = screenPub?.track || null;
    const ms = screenTrack?.mediaStreamTrack || null;
    const active = !!screenPub && !screenPub.isMuted && isLiveMediaStreamTrack(ms);
    return active ? ms : null;
  }, [callStatus, remoteParticipants]);

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

    // Screen share всегда приоритетнее camera
    if (localScreenMediaStreamTrack) {
      return {
        participantId: localId,
        isLocal: true,
        videoMediaStreamTrack: localScreenMediaStreamTrack,
        isVideoOff: false,
        displayName: `${getDisplayName(localId)} (Экран)`,
        isSpeaking: false
      };
    }

    const remoteScreen = remoteMedia.find((r) => r?.screenMediaStreamTrack) || null;
    if (remoteScreen) {
      return {
        participantId: remoteScreen.participantId,
        isLocal: false,
        videoMediaStreamTrack: remoteScreen.screenMediaStreamTrack,
        isVideoOff: false,
        displayName: `${getDisplayName(remoteScreen.participantId)} (Экран)`,
        isSpeaking: false
      };
    }

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
      videoMediaStreamTrack: remote?.cameraMediaStreamTrack || null,
      isVideoOff: false,
      displayName: getDisplayName(id),
      isSpeaking: id === activeSpeakerId
    };
  }, [activeParticipantId, activeSpeakerId, callStatus, currentUserId, getDisplayName, isVideoOff, localScreenMediaStreamTrack, localVideoTrack, remoteMedia]);

  const thumbnailItems = useMemo(() => {
    const localId = String(currentUserId || '').trim();
    const items = [];

    // Local screen share tile (separate track)
    if (localScreenMediaStreamTrack) {
      items.push({
        key: `${localId}:screen`,
        participantId: localId,
        isLocal: true,
        mediaStreamTrack: localScreenMediaStreamTrack,
        displayName: `${getDisplayName(localId)} (Экран)`,
        isVideoOff: false,
        onTrackEnded: syncUiFromTracks
      });
    }

    // Local camera tile
    items.push({
      key: `${localId}:cam`,
      participantId: localId,
      isLocal: true,
      mediaStreamTrack: !isVideoOff ? (localVideoTrack?.mediaStreamTrack || null) : null,
      displayName: getDisplayName(localId),
      isVideoOff,
      onTrackEnded: syncUiFromTracks
    });

    // Remote tiles (screen share separate from camera)
    remoteMedia.forEach((r) => {
      if (r?.screenMediaStreamTrack) {
        items.push({
          key: `${r.participantId}:screen`,
          participantId: r.participantId,
          isLocal: false,
          mediaStreamTrack: r.screenMediaStreamTrack,
          displayName: `${getDisplayName(r.participantId)} (Экран)`,
          isVideoOff: false,
          onTrackEnded: syncUiFromTracks
        });
      }

      items.push({
        key: `${r.participantId}:cam`,
        participantId: r.participantId,
        isLocal: false,
        mediaStreamTrack: r.cameraMediaStreamTrack,
        displayName: getDisplayName(r.participantId),
        isVideoOff: r.isCameraOff,
        onTrackEnded: syncUiFromTracks
      });
    });

    return items;
  }, [currentUserId, getDisplayName, isVideoOff, localScreenMediaStreamTrack, localVideoTrack, remoteMedia, syncUiFromTracks]);

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
      <div className="gvc-overlay">
        <div className="gvc-incoming-modal">
          {/* Animated rings */}
          <div className="gvc-incoming-rings">
            <div className="ring1" />
            <div className="ring2" />
            <div className="ring3" />
            <div className="gvc-incoming-avatar">
              <Icons.Users />
            </div>
          </div>

          <h2 className="gvc-incoming-title">{chatName || 'Групповой звонок'}</h2>
          <p className="gvc-incoming-subtitle">Входящий групповой {callType === 'video' ? 'видео' : ''}звонок</p>

          <div className="gvc-incoming-actions">
            <button className="gvc-btn-decline" onClick={handleLeave}>
              <Icons.PhoneOff />
            </button>
            <button className="gvc-btn-accept" onClick={handleJoinClick}>
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
    <div className="gvc-overlay">
      {/* ─── HEADER ─── */}
      <header className={`gvc-header ${showControls ? '' : 'hidden'}`}>
        <div className="gvc-header-left">
          <div className="gvc-header-icon">
            <Icons.Users />
          </div>
          <div className="gvc-header-info">
            <h1>{chatName || 'Групповой звонок'}</h1>
            <p>{getStatusText()}</p>
          </div>
        </div>
      </header>

      {/* ─── ERROR TOAST ─── */}
      {error && (
        <div className="gvc-error-toast">
          <span className="gvc-error-icon">⚠</span>
          {error}
        </div>
      )}

      {/* ─── MAIN CONTENT ─── */}
      <main className="gvc-content">
        {/* Hidden Audio */}
        <div className="gvc-hidden-audio">
          {remoteMedia.map((r) => (
            r.audioTrack ? <TrackAudio key={`aud:${r.participantId}`} track={r.audioTrack} /> : null
          ))}
        </div>

        {/* Stage */}
        <div className="gvc-stage-wrap">
          <MainVideo
            mediaStreamTrack={focusTarget.videoMediaStreamTrack}
            displayName={focusTarget.displayName}
            isLocal={focusTarget.isLocal}
            isVideoOff={focusTarget.isLocal ? focusTarget.isVideoOff : false}
            isSpeaking={focusTarget.isSpeaking}
            onTrackEnded={syncUiFromTracks}
          />
          
          {/* Controls - Floating above Thumbs */}
          <div className={`gvc-controls ${showControls ? '' : 'hidden'}`}>
            <button
              className={`gvc-btn ${isMuted ? 'off' : ''}`}
              onClick={toggleMute}
              disabled={callStatus !== 'active'}
              title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
            >
              <Icons.Mic off={isMuted} />
            </button>

            {callType === 'video' && (
              <button
                className={`gvc-btn ${isVideoOff ? 'off' : ''}`}
                onClick={toggleVideo}
                disabled={callStatus !== 'active'}
                title={isVideoOff ? 'Включить камеру' : 'Выключить камеру'}
              >
                <Icons.Camera off={isVideoOff} />
              </button>
            )}

            {/* Desktop only: Screen Share */}
            <button
              className="gvc-btn gvc-btn-screenshare"
              onClick={toggleScreenShare}
              disabled={callStatus !== 'active' || callType !== 'video'}
              title="Демонстрация экрана"
            >
              <Icons.ScreenShare />
            </button>

            <button className="gvc-btn" title="Настройки">
              <Icons.Settings />
            </button>

            <button className="gvc-btn leave" onClick={handleLeave} title="Покинуть звонок">
              <Icons.Hangup />
            </button>
          </div>
        </div>

        {/* Thumbnails Strip */}
        <ThumbnailsBar
          items={thumbnailItems}
          activeParticipantId={String(activeParticipantId || '').trim()}
          activeSpeakerId={activeSpeakerId}
          onSelect={handleSelectParticipant}
        />

        {/* Connecting Overlay */}
        {callStatus === 'connecting' && (
          <div className="gvc-connecting">
            <div className="gvc-spinner" />
            <p>Подключение к звонку...</p>
          </div>
        )}
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   STYLES (INJECTED)
   We use a <style> tag approach to keep everything in one file without inline styles.
───────────────────────────────────────────────────────────── */
const CSS_STYLES = `
/* BASE LAYOUT */
.gvc-overlay {
  position: fixed; inset: 0; background: #000; z-index: 9999;
  display: flex; flex-direction: column; font-family: sans-serif;
}

/* HEADER */
.gvc-header {
  position: absolute; top: 0; left: 0; right: 0;
  padding: 16px 24px; z-index: 20;
  transition: transform 0.3s ease, opacity 0.3s ease;
  background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
  display: flex; align-items: center; justify-content: space-between;
}
.gvc-header.hidden { transform: translateY(-100%); opacity: 0; pointer-events: none; }

.gvc-header-left { display: flex; align-items: center; gap: 12px; }
.gvc-header-icon { 
  width: 40px; height: 40px; border-radius: 10px; background: #5865f2; 
  display: flex; align-items: center; justify-content: center; color: white; 
}
.gvc-header-info h1 { margin: 0; font-size: 16px; color: white; font-weight: 600; }
.gvc-header-info p { margin: 0; font-size: 12px; color: rgba(255,255,255,0.7); }

/* CONTENT AREA */
.gvc-content {
  flex: 1; display: flex; flex-direction: column; position: relative; overflow: hidden;
}

.gvc-hidden-audio {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
}

/* STAGE (Main Video) */
.gvc-stage-wrap {
  flex: 1; position: relative; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.gvc-stage {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; position: relative;
}
.gvc-stage-video {
  width: 100%; height: 100%; object-fit: contain; background: black;
}
.gvc-stage-placeholder {
  width: 100%; height: 100%; background: #121212; display: flex; align-items: center; justify-content: center;
}
.gvc-stage-avatar {
  width: 120px; height: 120px; border-radius: 50%; background: #5865f2; color: white; 
  font-size: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold;
}
.gvc-stage-name {
  position: absolute; bottom: 120px; /* Above control bar */ left: 16px; background: rgba(0,0,0,0.6); 
  padding: 4px 8px; border-radius: 4px; color: white; font-size: 14px; font-weight: 600;
}

/* THUMBNAILS STRIP */
.gvc-strip {
  height: 112px; flex-shrink: 0; background: #18191c; display: flex; align-items: center; 
  border-top: 1px solid #202225; z-index: 10;
}
.gvc-strip-scroll {
  display: flex; gap: 8px; padding: 0 16px; overflow-x: auto; width: 100%; height: 100%; align-items: center;
}
.gvc-thumb {
  flex: 0 0 auto; width: 128px; height: 96px; border-radius: 8px; overflow: hidden;
  position: relative; background: #2f3136; border: 2px solid transparent; cursor: pointer; padding: 0;
}
.gvc-thumb:hover { background: #36393f; }
.gvc-thumb.active { border-color: #5865f2; box-shadow: 0 0 0 2px rgba(88, 101, 242, 0.3); }
.gvc-thumb.speaking { border-color: #3ba55c; }
.gvc-thumb-video { width: 100%; height: 100%; object-fit: cover; }
.gvc-thumb-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #36393f; }
.gvc-thumb-avatar { width: 40px; height: 40px; border-radius: 50%; background: #5865f2; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; }
.gvc-thumb-name {
  position: absolute; bottom: 4px; left: 4px; background: rgba(0,0,0,0.7); 
  padding: 2px 4px; border-radius: 4px; color: white; font-size: 11px;
}

/* CONTROLS (Floating) */
.gvc-controls {
  position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 16px; align-items: center; padding: 12px 24px;
  background: rgba(0,0,0,0.85); border-radius: 32px; z-index: 50;
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.gvc-controls.hidden { opacity: 0; pointer-events: none; transform: translateX(-50%) translateY(20px); }

.gvc-btn {
   width: 56px; height: 56px; border-radius: 50%; background: #36393f; color: white; 
   border: none; display: flex; align-items: center; justify-content: center; cursor: pointer;
   font-size: 24px; transition: background 0.2s, transform 0.1s;
}
.gvc-btn:hover { background: #40444b; transform: scale(1.05); }
.gvc-btn:active { transform: scale(0.95); }
.gvc-btn.off { background: #ed4245; color: white; }
.gvc-btn.leave { background: #ed4245; margin-left: 12px; }

/* Desktop-only: hide on mobile */
@media (max-width: 768px) {
  .gvc-btn-screenshare { display: none; }
}

/* ERROR */
.gvc-error-toast {
  position: absolute; top: 80px; left: 50%; transform: translateX(-50%);
  background: rgba(220, 38, 38, 0.9); color: white; padding: 12px 24px;
  border-radius: 8px; z-index: 100; font-size: 14px; display: flex; align-items: center;
}

.gvc-error-icon { margin-right: 8px; }

/* CONNECTING/SPINNER */
.gvc-connecting {
  position: absolute; inset: 0; background: rgba(0,0,0,0.7); display: flex; 
  flex-direction: column; align-items: center; justify-content: center; color: white; z-index: 60;
}
.gvc-spinner { 
  width: 48px; height: 48px; border: 4px solid rgba(255,255,255,0.1); 
  border-top-color: #5865f2; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px;
}

/* INCOMING CALL */
.gvc-incoming-modal {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%);
}
.gvc-incoming-rings { position: relative; width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; margin-bottom: 32px; }
.ring1, .ring2, .ring3 { position: absolute; border-radius: 50%; border: 2px solid #5865f2; opacity: 0; animation: pulse 2s infinite; }
.ring1 { width: 100%; height: 100%; animation-delay: 0s; }
.ring2 { width: 130%; height: 130%; animation-delay: 0.5s; }
.ring3 { width: 160%; height: 160%; animation-delay: 1s; }
.gvc-incoming-avatar { position: relative; z-index: 2; width: 80px; height: 80px; border-radius: 50%; background: #5865f2; display: flex; align-items: center; justify-content: center; color: white; font-size: 32px; }
.gvc-incoming-title { color: white; margin-bottom: 8px; font-size: 24px; }
.gvc-incoming-subtitle { color: rgba(255,255,255,0.7); margin-bottom: 40px; }
.gvc-incoming-actions { display: flex; gap: 32px; }
.gvc-btn-accept { width: 64px; height: 64px; border-radius: 50%; background: #3ba55c; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 28px; transition: transform 0.2s; }
.gvc-btn-decline { width: 64px; height: 64px; border-radius: 50%; background: #ed4245; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 28px; transition: transform 0.2s; }
.gvc-btn-accept:hover, .gvc-btn-decline:hover { transform: scale(1.1); }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse { 0% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.2); } }

/* SCROLLBAR */
.gvc-strip-scroll::-webkit-scrollbar { height: 6px; }
.gvc-strip-scroll::-webkit-scrollbar-thumb { background: #202225; border-radius: 3px; }
.gvc-strip-scroll::-webkit-scrollbar-track { background: transparent; }
`;

/* Inject styles */
if (typeof document !== 'undefined') {
  if (!document.getElementById('gvc-discord-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'gvc-discord-styles';
    styleSheet.textContent = CSS_STYLES;
    document.head.appendChild(styleSheet);
  }
}

export default GroupCallModalLiveKit;
