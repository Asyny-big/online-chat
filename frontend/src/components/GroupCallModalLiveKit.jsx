import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL, LIVEKIT_URL } from '../config';
import { createLocalTracks, Room, RoomEvent } from 'livekit-client';

import './GroupCallModalLiveKit.css';

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
      className="gcl-video"
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

function Icon({ name }) {
  switch (name) {
    case 'mic':
      return (
        <svg className="gcl-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 14.5c1.66 0 3-1.34 3-3V6.5c0-1.66-1.34-3-3-3s-3 1.34-3 3v5c0 1.66 1.34 3 3 3Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M19 11.5c0 3.87-3.13 7-7 7s-7-3.13-7-7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M12 18.5v2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'camera':
      return (
        <svg className="gcl-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M4.5 7.5h9A2.5 2.5 0 0 1 16 10v6a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 2 16v-6A2.5 2.5 0 0 1 4.5 7.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M16 11l4-2.5v7L16 13"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'settings':
      return (
        <svg className="gcl-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M19.4 12a7.6 7.6 0 0 0-.1-1.3l2-1.5-2-3.4-2.4 1a8.2 8.2 0 0 0-2.2-1.3l-.4-2.5H9.7l-.4 2.5a8.2 8.2 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 2.6l-2 1.5 2 3.4 2.4-1a8.2 8.2 0 0 0 2.2 1.3l.4 2.5h4.6l.4-2.5a8.2 8.2 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.5c.06-.43.1-.86.1-1.3Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'leave':
      return (
        <svg className="gcl-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M10 7h-1a3 3 0 0 0-3 3v4a3 3 0 0 0 3 3h1"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M13 16l3-4-3-4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M16 12H10"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M14 3h5v18h-5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

function getStatusMeta(callStatus) {
  switch (callStatus) {
    case 'incoming':
      return { label: 'Входящий звонок', variant: 'incoming' };
    case 'connecting':
      return { label: 'Подключение…', variant: 'incoming' };
    case 'active':
      return { label: 'В звонке', variant: 'active' };
    case 'ended':
      return { label: 'Завершён', variant: 'ended' };
    default:
      return { label: String(callStatus || ''), variant: 'incoming' };
  }
}

function CallHeader({ title, callStatus, participantsCount, onClose }) {
  const meta = getStatusMeta(callStatus);

  return (
    <div className="gcl-header">
      <div className="gcl-headerLeft">
        <div className="gcl-titleRow">
          <div className="gcl-title" title={title}>{title}</div>
          <div className="gcl-statusPill" data-variant={meta.variant}>{meta.label}</div>
        </div>
        <div className="gcl-subtitle">{participantsCount} участник(ов)</div>
      </div>

      <div className="gcl-headerRight">
        <button type="button" className="gcl-closeBtn" onClick={onClose} aria-label="Закрыть">
          ✕
        </button>
      </div>
    </div>
  );
}

function VideoTile({ name, videoTrack, audioTrack, isLocalMuted }) {
  return (
    <div className="gcl-tile">
      {videoTrack ? (
        <TrackVideo track={videoTrack} isMuted={isLocalMuted} />
      ) : (
        <div className="gcl-placeholder">Видео выключено</div>
      )}
      {audioTrack ? <TrackAudio track={audioTrack} /> : null}
      <div className="gcl-namePill">{name}</div>
    </div>
  );
}

function VideoGrid({ localVideoTrack, isVideoOff, remoteParticipants }) {
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
        <VideoTile
          key={participant.sid}
          name={participant.identity || 'Участник'}
          videoTrack={videoTrack}
          audioTrack={audioTrack}
        />
      );
    });
  }, [remoteParticipants]);

  const total = 1 + remoteParticipants.length;
  const countClass = total >= 10 ? 'count-10'
    : total === 9 ? 'count-9'
      : total === 8 ? 'count-8'
        : total === 7 ? 'count-7'
          : '';

  return (
    <div className={`gcl-grid ${countClass}`.trim()}>
      <VideoTile
        name="Вы"
        videoTrack={localVideoTrack && !isVideoOff ? localVideoTrack : null}
        audioTrack={null}
        isLocalMuted
      />
      {remoteTiles}
    </div>
  );
}

function ControlBar({
  visible,
  callStatus,
  callType,
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onSettings,
  onLeave
}) {
  const disabled = callStatus !== 'active';

  return (
    <div className="gcl-controlBarWrap" aria-hidden={callStatus === 'incoming'}>
      <div className={`gcl-controlBar ${visible ? '' : 'hidden'}`.trim()}>
        <button
          type="button"
          className={`gcl-iconBtn ${isMuted ? 'toggled' : ''}`.trim()}
          onClick={onToggleMute}
          disabled={disabled}
          aria-label={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
          title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
        >
          <Icon name="mic" />
        </button>

        {callType === 'video' ? (
          <button
            type="button"
            className={`gcl-iconBtn ${isVideoOff ? 'toggled' : ''}`.trim()}
            onClick={onToggleVideo}
            disabled={disabled}
            aria-label={isVideoOff ? 'Включить камеру' : 'Выключить камеру'}
            title={isVideoOff ? 'Включить камеру' : 'Выключить камеру'}
          >
            <Icon name="camera" />
          </button>
        ) : null}

        <button
          type="button"
          className="gcl-iconBtn"
          onClick={onSettings}
          disabled={false}
          aria-label="Настройки"
          title="Настройки"
        >
          <Icon name="settings" />
        </button>

        <button
          type="button"
          className="gcl-iconBtn danger"
          onClick={onLeave}
          aria-label="Покинуть звонок"
          title="Покинуть"
        >
          <Icon name="leave" />
        </button>
      </div>
    </div>
  );
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

  const [controlsVisible, setControlsVisible] = useState(true);
  const lastInteractionAtRef = useRef(Date.now());

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

  const markInteracted = useCallback(() => {
    lastInteractionAtRef.current = Date.now();
    setControlsVisible(true);
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

  useEffect(() => {
    const onWindowActivity = () => markInteracted();
    window.addEventListener('mousemove', onWindowActivity, { passive: true });
    window.addEventListener('touchstart', onWindowActivity, { passive: true });
    window.addEventListener('keydown', onWindowActivity);

    return () => {
      window.removeEventListener('mousemove', onWindowActivity);
      window.removeEventListener('touchstart', onWindowActivity);
      window.removeEventListener('keydown', onWindowActivity);
    };
  }, [markInteracted]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (callStatus !== 'active') {
        setControlsVisible(true);
        return;
      }

      const idleMs = Date.now() - lastInteractionAtRef.current;
      if (idleMs > 2500) {
        setControlsVisible(false);
      }
    }, 250);

    return () => window.clearInterval(id);
  }, [callStatus]);

  const participantsCount = 1 + remoteParticipants.length;
  const headerTitle = chatName || 'Групповой звонок';
  const handleSettings = useCallback(() => {
    // UI-only: кнопка присутствует по требованиям, но без новых панелей/логики.
  }, []);

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
    <div className="gcl-overlay">
      <div className="gcl-surface" onMouseMove={markInteracted} onTouchStart={markInteracted}>
        <CallHeader
          title={headerTitle}
          callStatus={callStatus}
          participantsCount={participantsCount}
          onClose={handleLeave}
        />

        {error ? <div className="gcl-error">{error}</div> : null}

        <div className="gcl-content">
          {callStatus === 'incoming' && !autoJoin ? (
            <div className="gcl-incoming">
              <div className="gcl-incomingCard">
                <div className="gcl-incomingTitle">Входящий групповой звонок</div>
                <div className="gcl-subtitle">Нажмите «Принять», чтобы подключиться</div>
                <div className="gcl-actions">
                  <button type="button" className="gcl-actionBtn primary" onClick={handleJoinClick}>Принять</button>
                  <button type="button" className="gcl-actionBtn danger" onClick={handleLeave}>Отклонить</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="gcl-scroll">
              <VideoGrid
                localVideoTrack={localVideoTrack}
                isVideoOff={isVideoOff}
                remoteParticipants={remoteParticipants}
              />
            </div>
          )}

          <ControlBar
            visible={controlsVisible}
            callStatus={callStatus}
            callType={callType}
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            onToggleMute={toggleMute}
            onToggleVideo={toggleVideo}
            onSettings={handleSettings}
            onLeave={handleLeave}
          />
        </div>
      </div>
    </div>
  );
}

export default GroupCallModalLiveKit;
