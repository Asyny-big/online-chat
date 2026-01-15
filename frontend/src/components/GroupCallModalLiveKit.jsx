import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL, LIVEKIT_URL } from '../config';
import { createLocalTracks, Room, RoomEvent } from 'livekit-client';

function TrackVideo({ track, isMuted }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!track || !ref.current) return undefined;
    track.attach(ref.current);
    return () => {
      track.detach(ref.current);
    };
  }, [track]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={isMuted}
      style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#0b1220' }}
    />
  );
}

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

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      disconnectLiveKit();
    };
  }, [disconnectLiveKit]);

  const remoteTiles = useMemo(() => {
    return remoteParticipants.map((participant) => {
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

      return (
        <div key={participant.sid} style={styles.tile}>
          {videoTrack ? (
            <TrackVideo track={videoTrack} />
          ) : (
            <div style={styles.placeholder}>Видео выключено</div>
          )}
          {audioTrack ? <TrackAudio track={audioTrack} /> : null}
          <div style={styles.tileLabel}>{participant.identity || 'Участник'}</div>
        </div>
      );
    });
  }, [remoteParticipants]);

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>{chatName || 'Групповой звонок'}</div>
            <div style={styles.subtitle}>LiveKit SFU</div>
          </div>
          <button style={styles.closeBtn} onClick={handleLeave}>✕</button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {callStatus === 'incoming' && !autoJoin && (
          <div style={styles.incomingBox}>
            <div style={styles.incomingText}>Входящий групповой звонок</div>
            <div style={styles.actionsRow}>
              <button style={styles.primaryBtn} onClick={handleJoinClick}>Принять</button>
              <button style={styles.secondaryBtn} onClick={handleLeave}>Отклонить</button>
            </div>
          </div>
        )}

        {callStatus !== 'incoming' && (
          <div style={styles.grid}>
            <div style={styles.tile}>
              {localVideoTrack && !isVideoOff ? (
                <TrackVideo track={localVideoTrack} isMuted />
              ) : (
                <div style={styles.placeholder}>Ваше видео выключено</div>
              )}
              <div style={styles.tileLabel}>Вы</div>
            </div>
            {remoteTiles}
          </div>
        )}

        <div style={styles.controls}>
          <button style={styles.controlBtn} onClick={toggleMute} disabled={callStatus !== 'active'}>
            {isMuted ? 'Вкл. микрофон' : 'Выкл. микрофон'}
          </button>
          {callType === 'video' && (
            <button style={styles.controlBtn} onClick={toggleVideo} disabled={callStatus !== 'active'}>
              {isVideoOff ? 'Вкл. камеру' : 'Выкл. камеру'}
            </button>
          )}
          <button style={styles.dangerBtn} onClick={handleLeave}>Покинуть</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(2, 6, 23, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
  },
  modal: {
    width: 'min(1080px, 95vw)',
    maxHeight: '90vh',
    background: '#0f172a',
    borderRadius: 16,
    padding: 20,
    color: '#e2e8f0',
    boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    fontSize: 20,
    fontWeight: 600
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8'
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#e2e8f0',
    fontSize: 20,
    cursor: 'pointer'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 12,
    overflowY: 'auto'
  },
  tile: {
    background: '#0b1220',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    aspectRatio: '16 / 9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  placeholder: {
    color: '#94a3b8',
    fontSize: 14
  },
  tileLabel: {
    position: 'absolute',
    left: 10,
    bottom: 8,
    fontSize: 12,
    background: 'rgba(15, 23, 42, 0.7)',
    padding: '4px 8px',
    borderRadius: 8
  },
  controls: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  controlBtn: {
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#e2e8f0',
    padding: '10px 16px',
    borderRadius: 10,
    cursor: 'pointer'
  },
  dangerBtn: {
    background: '#dc2626',
    border: 'none',
    color: '#fff',
    padding: '10px 16px',
    borderRadius: 10,
    cursor: 'pointer'
  },
  incomingBox: {
    background: '#111827',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  },
  incomingText: {
    fontSize: 16
  },
  actionsRow: {
    display: 'flex',
    gap: 12
  },
  primaryBtn: {
    background: '#16a34a',
    border: 'none',
    color: '#fff',
    padding: '10px 16px',
    borderRadius: 10,
    cursor: 'pointer'
  },
  secondaryBtn: {
    background: '#334155',
    border: 'none',
    color: '#e2e8f0',
    padding: '10px 16px',
    borderRadius: 10,
    cursor: 'pointer'
  },
  error: {
    background: '#7f1d1d',
    color: '#fecaca',
    padding: 10,
    borderRadius: 8
  }
};

export default GroupCallModalLiveKit;
