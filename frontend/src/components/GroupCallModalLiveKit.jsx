import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL, LIVEKIT_URL } from '../config';
import { createLocalTracks, Room, RoomEvent, Track, VideoQuality } from 'livekit-client';

function isAndroidWebViewRuntime() {
  if (typeof navigator === 'undefined') return false;
  const ua = String(navigator.userAgent || '').toLowerCase();
  const isAndroid = ua.includes('android');
  const hasWvToken = ua.includes('; wv') || ua.includes(' wv');
  const hasVersionToken = ua.includes('version/');
  const hasChromeToken = ua.includes('chrome/');
  return isAndroid && (hasWvToken || (hasVersionToken && hasChromeToken));
}

function safePlayMediaElement(el, reason) {
  if (!el) return;
  try {
    const p = el.play?.();
    if (p && typeof p.catch === 'function') {
      p.catch((err) => {
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[LiveKit] media play blocked:', reason, err?.name || err?.message || err);
        }
      });
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[LiveKit] media play failed:', reason, err?.name || err?.message || err);
    }
  }
}

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
   LIVEKIT VIDEO (track.attach)

   Важно: LiveKit adaptiveStream выбирает simulcast слой, учитывая размер
   HTMLVideoElement, к которому трек прикреплён через track.attach().
   Если рендерить только MediaStreamTrack через srcObject, SDK не знает про
   размеры элемента и может держать LOW слой даже на большом stage.
───────────────────────────────────────────────────────────── */
const LiveKitVideo = React.memo(function LiveKitVideo({ track, muted, className, onTrackEnded }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !track) return undefined;

    try {
      el.autoplay = true;
      el.playsInline = true;
      el.disablePictureInPicture = true;
      el.disableRemotePlayback = true;
      el.setAttribute('playsinline', '');
      el.setAttribute('webkit-playsinline', '');
      el.setAttribute('x5-playsinline', '');
      if (typeof muted === 'boolean') {
        el.muted = muted;
      }
    } catch (_) {}

    try {
      track.attach(el);
    } catch (_) {
      // no-op
    }

    const replay = () => safePlayMediaElement(el, 'video-replay');
    replay();
    try {
      el.addEventListener('loadedmetadata', replay);
      el.addEventListener('canplay', replay);
      el.addEventListener('pause', replay);
      el.addEventListener('stalled', replay);
      el.addEventListener('suspend', replay);
    } catch (_) {}

    const mst = track?.mediaStreamTrack || null;
    const handleEnded = () => onTrackEnded?.();
    try {
      mst?.addEventListener?.('ended', handleEnded);
    } catch (_) {}

    return () => {
      try {
        el.removeEventListener('loadedmetadata', replay);
        el.removeEventListener('canplay', replay);
        el.removeEventListener('pause', replay);
        el.removeEventListener('stalled', replay);
        el.removeEventListener('suspend', replay);
      } catch (_) {}
      try {
        mst?.removeEventListener?.('ended', handleEnded);
      } catch (_) {}
      try {
        track.detach(el);
      } catch (_) {
        // no-op
      }
    };
  }, [track, muted, onTrackEnded]);

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
    safePlayMediaElement(ref.current, 'audio-attach');
    return () => {
      track.detach(ref.current);
    };
  }, [track]);

  return <audio ref={ref} autoPlay playsInline />;
}

/* ─────────────────────────────────────────────────────────────
   PARTICIPANT TILE COMPONENT
───────────────────────────────────────────────────────────── */
const MainVideo = React.memo(function MainVideo({
  videoTrack,
  displayName,
  isLocal,
  isScreenShare,
  isVideoOff,
  isSpeaking,
  onTrackEnded
}) {
  const initials = displayName ? displayName.slice(0, 2).toUpperCase() : '??';
  const mirrorClass = isLocal && !isScreenShare ? ' gvc-video-mirror' : '';

  return (
    <div className={`gvc-stage ${isSpeaking ? 'speaking' : ''}`}>
      {videoTrack && !isVideoOff ? (
        <LiveKitVideo
          track={videoTrack}
          muted={isLocal}
          className={`gvc-stage-video${mirrorClass}`}
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
  videoTrack,
  displayName,
  isLocal,
  isScreenShare,
  isActive,
  isSpeaking,
  isVideoOff,
  onSelect,
  onTrackEnded
}) {
  const initials = displayName ? displayName.slice(0, 2).toUpperCase() : '??';
  const mirrorClass = isLocal && !isScreenShare ? ' gvc-video-mirror' : '';

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
      {videoTrack && !isVideoOff ? (
        <LiveKitVideo
          track={videoTrack}
          muted={isLocal}
          className={`gvc-thumb-video${mirrorClass}`}
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
            videoTrack={item.videoTrack}
            displayName={item.displayName}
            isLocal={item.isLocal}
            isScreenShare={!!item.isScreenShare}
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

function isLiveVideoTrack(track) {
  const mst = track?.mediaStreamTrack;
  return !!mst && mst.readyState === 'live';
}

function publicationId(pub) {
  return String(pub?.trackSid || pub?.sid || '') || null;
}

function qualityLabel(q) {
  try {
    if (q === VideoQuality.HIGH) return 'HIGH';
    if (q === VideoQuality.MEDIUM) return 'MEDIUM';
    if (q === VideoQuality.LOW) return 'LOW';
  } catch (_) {}
  return 'N/A';
}

function setPublicationSubscribedQuality(pub, quality) {
  if (!pub) return;

  // Публичные варианты API в разных версиях livekit-client:
  // - publication.setSubscribedQuality(VideoQuality)
  // - publication.setVideoQuality(VideoQuality)
  // - publication.track.setSubscribedQuality(VideoQuality)
  try {
    if (typeof pub.setSubscribedQuality === 'function') {
      pub.setSubscribedQuality(quality);
      return;
    }
  } catch (_) {}

  try {
    if (typeof pub.setVideoQuality === 'function') {
      pub.setVideoQuality(quality);
      return;
    }
  } catch (_) {}

  try {
    if (pub.track && typeof pub.track.setSubscribedQuality === 'function') {
      pub.track.setSubscribedQuality(quality);
    }
  } catch (_) {}
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

  // Controls auto-hide (Discord-like):
  // - Появляются при активности (mousemove/touchstart/click)
  // - Скрываются через 2.5s без активности
  // - Не скрываются, если открыта панель состояния
  // - Mobile-first: первый тап показывает controls, второй выполняет действие
  const CONTROLS_AUTOHIDE_MS = 2500;
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideControlsTimerRef = useRef(null);
  const isCoarsePointerRef = useRef(false);

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

  // Room connection state (публичное поле + event в разных версиях SDK)
  const [lkConnectionState, setLkConnectionState] = useState('');

  // UI: небольшая панель статуса качества (опционально)
  const [showConnStatus, setShowConnStatus] = useState(false);
  const [stageQualityRequested, setStageQualityRequested] = useState('');
  const [tilesQualityRequested, setTilesQualityRequested] = useState('');
  const [connProtocol, setConnProtocol] = useState('');
  const [videoInKbps, setVideoInKbps] = useState(null);
  const [videoOutKbps, setVideoOutKbps] = useState(null);
  const [actualVideoInRes, setActualVideoInRes] = useState(null);
  const [actualVideoOutRes, setActualVideoOutRes] = useState(null);
  const [statsNote, setStatsNote] = useState('');
  const isAndroidWebView = useMemo(() => isAndroidWebViewRuntime(), []);

  // Для responsive: ширина stage и примерная ширина превью
  const stageWrapRef = useRef(null);
  const thumbsWrapRef = useRef(null);
  const [thumbWidth, setThumbWidth] = useState(0);
  const [stageSize, setStageSize] = useState(() => ({ width: 0, height: 0 }));

  // Guard, чтобы не спамить setSubscribedQuality на каждом рендере
  const lastQualityByPubIdRef = useRef(new Map());

  // Guard от дрожания: не дёргаем setSubscribedQuality чаще, чем раз в 500ms.
  // Храним timestamp по publication, чтобы смена фокуса/resize не вызывали бурст.
  const lastQualitySetAtByPubIdRef = useRef(new Map());

  // Guard для bitrate (bytes deltas)
  const lastStatsSampleRef = useRef({
    ts: 0,
    inBytes: 0,
    outBytes: 0
  });

  const wakeupMediaElements = useCallback(() => {
    try {
      const elements = document.querySelectorAll('.gvc-overlay video, .gvc-overlay audio');
      elements.forEach((el) => safePlayMediaElement(el, 'overlay-wakeup'));
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    console.info('[LiveKit] runtime', {
      isAndroidWebView,
      isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
    });
  }, [isAndroidWebView]);

  const clearHideTimer = useCallback(() => {
    const t = hideControlsTimerRef.current;
    if (t) {
      hideControlsTimerRef.current = null;
      try { clearTimeout(t); } catch (_) {}
    }
  }, []);

  const scheduleHideControls = useCallback(() => {
    clearHideTimer();
    // Скрываем только во время активного звонка и когда не открыта панель статуса.
    if (callStatus !== 'active') return;
    if (showConnStatus) return;
    hideControlsTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      // Если панель статуса открылась позже — не скрываем.
      if (showConnStatus) return;
      setControlsVisible(false);
    }, CONTROLS_AUTOHIDE_MS);
  }, [callStatus, clearHideTimer, showConnStatus]);

  const bumpControls = useCallback(() => {
    // Любая активность показывает controls и перезапускает таймер.
    if (!mountedRef.current) return;
    if (!controlsVisible) setControlsVisible(true);
    scheduleHideControls();
  }, [controlsVisible, scheduleHideControls]);

  // Определяем "mobile-like" поведение (coarse pointer) один раз.
  useEffect(() => {
    try {
      isCoarsePointerRef.current = !!window.matchMedia?.('(pointer: coarse)')?.matches;
    } catch (_) {
      isCoarsePointerRef.current = false;
    }
  }, []);

  useEffect(() => {
    const stageEl = stageWrapRef.current;
    const thumbsEl = thumbsWrapRef.current;
    if (!stageEl && !thumbsEl) return undefined;

    let raf = 0;

    const updateNow = () => {
      try {
        if (stageEl) {
          const r = stageEl.getBoundingClientRect?.();
          const w = Math.round(r?.width || 0);
          const h = Math.round(r?.height || 0);
          setStageSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
        }
        if (thumbsEl) {
          const first = thumbsEl.querySelector?.('.gvc-thumb');
          const w = first?.getBoundingClientRect?.().width;
          const next = Math.round(w || 0);
          setThumbWidth((prev) => (prev === next ? prev : next));
        }
      } catch (_) {}
    };

    // ResizeObserver может стрелять очень часто — используем rAF throttle.
    const update = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        updateNow();
      });
    };

    updateNow();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    try {
      if (ro && stageEl) ro.observe(stageEl);
      if (ro && thumbsEl) ro.observe(thumbsEl);
    } catch (_) {}

    window.addEventListener?.('resize', update);
    return () => {
      window.removeEventListener?.('resize', update);
      try { if (raf) cancelAnimationFrame(raf); } catch (_) {}
      try { ro?.disconnect?.(); } catch (_) {}
    };
  }, []);

  // Если пользователь открыл панель статуса — фиксируем controls открытыми.
  useEffect(() => {
    if (!mountedRef.current) return;
    if (showConnStatus) {
      setControlsVisible(true);
      clearHideTimer();
      return;
    }
    // Если закрыли панель — начинаем авто-hide с текущего момента.
    scheduleHideControls();
  }, [clearHideTimer, scheduleHideControls, showConnStatus]);

  // Best-effort stats для панели "Состояние соединения".
  // Важно:
  // - Включается только когда пользователь открыл панель.
  // - Не делает частый polling (2с) и аккуратно очищается.
  useEffect(() => {
    if (!showConnStatus) return undefined;
    if (callStatus !== 'active') return undefined;

    let cancelled = false;
    let timer = null;

    const flatten = (stats) => {
      const out = [];
      if (!stats) return out;
      if (typeof stats.forEach === 'function') {
        // Map / RTCStatsReport
        stats.forEach((v) => out.push(v));
        return out;
      }
      if (Array.isArray(stats)) return stats;
      // object map
      try {
        Object.keys(stats).forEach((k) => out.push(stats[k]));
      } catch (_) {}
      return out;
    };

    const pickProtocol = (rows) => {
      try {
        const byId = new Map();
        rows.forEach((r) => {
          if (r && r.id) byId.set(r.id, r);
        });
        const pair = rows.find((r) => r?.type === 'candidate-pair' && (r?.selected || r?.nominated)) || null;
        const local = pair?.localCandidateId ? byId.get(pair.localCandidateId) : null;
        const remote = pair?.remoteCandidateId ? byId.get(pair.remoteCandidateId) : null;
        const proto = String(local?.protocol || pair?.transportId || '').toLowerCase();
        const candidateType = String(local?.candidateType || '').toLowerCase();
        const isRelay = candidateType === 'relay';

        if (isRelay) {
          return `TURN${proto ? ' / ' + proto.toUpperCase() : ''}`;
        }
        if (proto.includes('tcp')) return 'TCP';
        if (proto.includes('udp')) return 'UDP';
        // fallback
        if (remote?.protocol) return String(remote.protocol).toUpperCase();
      } catch (_) {}
      return '';
    };

    const sumVideoBytes = (rows) => {
      let inBytes = 0;
      let outBytes = 0;
      let maxInW = 0;
      let maxInH = 0;
      let maxOutW = 0;
      let maxOutH = 0;
      rows.forEach((r) => {
        const type = r?.type;
        const kind = r?.kind || r?.mediaType;
        if (kind !== 'video') return;

        // inbound-rtp/outbound-rtp есть в стандартном getStats()
        if (type === 'inbound-rtp') {
          inBytes += Number(r?.bytesReceived || 0);
          const fw = Number(r?.frameWidth || 0);
          const fh = Number(r?.frameHeight || 0);
          if (fw * fh > maxInW * maxInH) {
            maxInW = fw;
            maxInH = fh;
          }
        }
        if (type === 'outbound-rtp') {
          outBytes += Number(r?.bytesSent || 0);
          const fw = Number(r?.frameWidth || 0);
          const fh = Number(r?.frameHeight || 0);
          if (fw * fh > maxOutW * maxOutH) {
            maxOutW = fw;
            maxOutH = fh;
          }
        }
      });
      return { inBytes, outBytes, maxInW, maxInH, maxOutW, maxOutH };
    };

    const tick = async () => {
      const room = roomRef.current;
      if (!room) return;

      // Публичные варианты API в зависимости от версии:
      // - room.getStats()
      // - room.localParticipant.getStats()
      let stats = null;
      try {
        if (typeof room.getStats === 'function') {
          stats = await room.getStats();
        } else if (room.localParticipant && typeof room.localParticipant.getStats === 'function') {
          stats = await room.localParticipant.getStats();
        }
      } catch (e) {
        // Если SDK не поддерживает метод — просто отключаем подробные stats.
        if (!cancelled) {
          setStatsNote('Stats недоступны в текущей версии SDK');
        }
        return;
      }

      const rows = flatten(stats);
      if (!rows.length) {
        if (!cancelled) setStatsNote('Нет данных stats');
        return;
      }

      const protoLabel = pickProtocol(rows);
      const { inBytes, outBytes, maxInW, maxInH, maxOutW, maxOutH } = sumVideoBytes(rows);
      const now = Date.now();
      const prev = lastStatsSampleRef.current;
      const dt = prev.ts ? (now - prev.ts) / 1000 : 0;

      if (!cancelled) {
        if (protoLabel) setConnProtocol(protoLabel);

        // Actual resolution (best-effort): берём самый большой видео-поток из inbound/outbound.
        // Обычно это соответствует stage, т.к. stage запрашивает более высокий слой.
        const inRes = maxInW && maxInH ? `${maxInW}×${maxInH}` : null;
        const outRes = maxOutW && maxOutH ? `${maxOutW}×${maxOutH}` : null;
        setActualVideoInRes(inRes);
        setActualVideoOutRes(outRes);

        if (dt > 0.5) {
          const inKbps = Math.max(0, Math.round(((inBytes - prev.inBytes) * 8) / dt / 1000));
          const outKbps = Math.max(0, Math.round(((outBytes - prev.outBytes) * 8) / dt / 1000));
          setVideoInKbps(Number.isFinite(inKbps) ? inKbps : null);
          setVideoOutKbps(Number.isFinite(outKbps) ? outKbps : null);
        }
        setStatsNote('');
      }

      lastStatsSampleRef.current = { ts: now, inBytes, outBytes };
    };

    // Быстрый первый замер и затем редкий polling.
    tick();
    timer = setInterval(tick, 2000);

    return () => {
      cancelled = true;
      try { if (timer) clearInterval(timer); } catch (_) {}
    };
  }, [callStatus, showConnStatus]);

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

      const room = new Room({ adaptiveStream: !isAndroidWebView, dynacast: !isAndroidWebView });
      roomRef.current = room;

      // Обновляем connectionState (помогает UI статуса даже без stats).
      try {
        setLkConnectionState(String(room.connectionState || ''));
      } catch (_) {}

      try {
        if (RoomEvent.ConnectionStateChanged) {
          room.on(RoomEvent.ConnectionStateChanged, (state) => {
            if (!mountedRef.current) return;
            setLkConnectionState(String(state || ''));
          });
        }
      } catch (_) {}

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

      if (callType === 'video' && navigator?.mediaDevices?.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          console.info(
            '[LiveKit] enumerateDevices',
            devices.map((d) => ({ kind: d.kind, label: d.label, deviceId: d.deviceId }))
          );
        } catch (e) {
          console.warn('[LiveKit] enumerateDevices failed:', e);
        }
      }

      const tracks = await createLocalTracks({
        audio: true,
        video: callType === 'video'
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              // FPS smoothing:
              // Ограничиваем FPS на capture-уровне (getUserMedia constraints), без SDP/setParameters.
              // Это снижает нагрузку на энкодер/девайс и уменьшает микрофризы, особенно на мобилках.
              frameRate: { ideal: 24, max: 24 }
            }
          : false
      });

      localTracksRef.current = tracks;

      await Promise.all(tracks.map((track) => room.localParticipant.publishTrack(track)));

      const localVideo = tracks.find((t) => t.kind === 'video') || null;
      if (localVideo?.mediaStreamTrack) {
        try {
          console.info('[LiveKit] local video track', {
            id: localVideo.mediaStreamTrack.id,
            readyState: localVideo.mediaStreamTrack.readyState,
            muted: localVideo.mediaStreamTrack.muted,
            settings: localVideo.mediaStreamTrack.getSettings?.()
          });
        } catch (_) {}
      }
      if (mountedRef.current) {
        setLocalVideoTrack(localVideo);
        setCallStatus('active');
      }
      updateRemoteParticipants();
      wakeupMediaElements();

      // При старте активного звонка: показываем controls и запускаем auto-hide.
      bumpControls();
    } catch (err) {
      console.error('[LiveKit] connect flow failed', {
        error: err?.message || err,
        callType,
        isAndroidWebView,
        isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : null
      });
      if (mountedRef.current) {
        setError(err?.message || 'LiveKit connection failed');
        setCallStatus('ended');
      }
    } finally {
      isConnectingRef.current = false;
    }
  }, [callId, chatId, callType, fetchIceServers, fetchLiveKitToken, isAndroidWebView, socket, updateRemoteParticipants, wakeupMediaElements]);

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
    wakeupMediaElements();
    onJoin?.(callId, callType);
    await connectLiveKit();
    wakeupMediaElements();
  }, [callId, callType, connectLiveKit, onJoin, wakeupMediaElements]);

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
      clearHideTimer();
      disconnectLiveKit();
    };
  }, [clearHideTimer, disconnectLiveKit]);

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

        const cameraActive = !!cameraPub && !cameraPub.isMuted && isLiveVideoTrack(cameraTrack);
        const screenActive = !!screenPub && !screenPub.isMuted && isLiveVideoTrack(screenTrack);

        return {
          participant,
          participantId: identity,
          cameraPublication: cameraPub,
          screenPublication: screenPub,
          cameraTrack: cameraActive ? cameraTrack : null,
          screenTrack: screenActive ? screenTrack : null,
          isCameraOff: !cameraActive,
          isScreenOff: !screenActive,
          audioTrack,
          isSpeaking: !!participant?.isSpeaking,
          audioLevel: typeof participant?.audioLevel === 'number' ? participant.audioLevel : 0
        };
      })
      .filter(Boolean);
  }, [remoteParticipants]);

  const localScreen = useMemo(() => {
    const room = roomRef.current;
    const lp = room?.localParticipant;
    const pubs = lp?.videoTrackPublications && typeof lp.videoTrackPublications.values === 'function'
      ? Array.from(lp.videoTrackPublications.values())
      : [];
    const screenPub = pubs.find((p) => isScreenSharePublication(p) && p?.track) || null;
    const screenTrack = screenPub?.track || null;
    const active = !!screenPub && !screenPub.isMuted && isLiveVideoTrack(screenTrack);
    return {
      publication: active ? screenPub : null,
      track: active ? screenTrack : null
    };
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
    if (localScreen?.track) {
      return {
        participantId: localId,
        isLocal: true,
        isScreenShare: true,
        videoTrack: localScreen.track,
        videoPublication: localScreen.publication,
        isVideoOff: false,
        displayName: `${getDisplayName(localId)} (Экран)`,
        isSpeaking: false
      };
    }

    const remoteScreen = remoteMedia.find((r) => r?.screenTrack) || null;
    if (remoteScreen) {
      return {
        participantId: remoteScreen.participantId,
        isLocal: false,
        isScreenShare: true,
        videoTrack: remoteScreen.screenTrack,
        videoPublication: remoteScreen.screenPublication,
        isVideoOff: false,
        displayName: `${getDisplayName(remoteScreen.participantId)} (Экран)`,
        isSpeaking: false
      };
    }

    if (!id || id === localId) {
      return {
        participantId: localId,
        isLocal: true,
        isScreenShare: false,
        videoTrack: localVideoTrack || null,
        videoPublication: null,
        isVideoOff,
        displayName: getDisplayName(localId),
        isSpeaking: false
      };
    }

    const remote = remoteMedia.find((r) => r.participantId === id) || null;
    return {
      participantId: id,
      isLocal: false,
      isScreenShare: false,
      videoTrack: remote?.cameraTrack || null,
      videoPublication: remote?.cameraPublication || null,
      isVideoOff: false,
      displayName: getDisplayName(id),
      isSpeaking: id === activeSpeakerId
    };
  }, [activeParticipantId, activeSpeakerId, callStatus, currentUserId, getDisplayName, isVideoOff, localScreen, localVideoTrack, remoteMedia]);

  const thumbnailItems = useMemo(() => {
    const localId = String(currentUserId || '').trim();
    const items = [];

    // Local screen share tile (separate track)
    if (localScreen?.track) {
      items.push({
        key: `${localId}:screen`,
        participantId: localId,
        isLocal: true,
        isScreenShare: true,
        videoTrack: localScreen.track,
        videoPublication: localScreen.publication,
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
      isScreenShare: false,
      videoTrack: !isVideoOff ? (localVideoTrack || null) : null,
      videoPublication: null,
      displayName: getDisplayName(localId),
      isVideoOff,
      onTrackEnded: syncUiFromTracks
    });

    // Remote tiles (screen share separate from camera)
    remoteMedia.forEach((r) => {
      if (r?.screenTrack) {
        items.push({
          key: `${r.participantId}:screen`,
          participantId: r.participantId,
          isLocal: false,
          isScreenShare: true,
          videoTrack: r.screenTrack,
          videoPublication: r.screenPublication,
          displayName: `${getDisplayName(r.participantId)} (Экран)`,
          isVideoOff: false,
          onTrackEnded: syncUiFromTracks
        });
      }

      items.push({
        key: `${r.participantId}:cam`,
        participantId: r.participantId,
        isLocal: false,
        isScreenShare: false,
        videoTrack: r.cameraTrack,
        videoPublication: r.cameraPublication,
        displayName: getDisplayName(r.participantId),
        isVideoOff: r.isCameraOff,
        onTrackEnded: syncUiFromTracks
      });
    });

    return items;
  }, [currentUserId, getDisplayName, isVideoOff, localScreen, localVideoTrack, remoteMedia, syncUiFromTracks]);

  // Управление simulcast layer через публичный API.
  // Требования:
  // - Главное видео (stage) должно получать HIGH quality (если доступно)
  // - Превью должны быть LOW или MEDIUM
  // - Не перегружать мобилки: MEDIUM запрашиваем только если превью реально большое
  useEffect(() => {
    if (callStatus !== 'active') return;

    const stagePub = focusTarget?.isLocal ? null : focusTarget?.videoPublication;
    const stagePubKey = stagePub ? publicationId(stagePub) : null;

    // Stage качество (смягчённая policy против дрожания):
    // - HIGH только если ширина stage >= 800px
    // - 600–799px: MEDIUM
    // - <600px: MEDIUM
    // Цель: реже переключаться между слоями и снизить jitter/микрофризы.
    const STAGE_HIGH_MIN_WIDTH_PX = 800;
    const desiredStageQuality = Number(stageSize?.width || 0) >= STAGE_HIGH_MIN_WIDTH_PX
      ? VideoQuality?.HIGH
      : VideoQuality?.MEDIUM;

    // Превью тайлы обычно 128x96. LOW достаточно и экономит трафик.
    // Если тайл большой (например, tablet/desktop с увеличенными плитками), просим MEDIUM.
    // Tiles качество:
    // - LOW по умолчанию
    // - MEDIUM только если тайл реально большой
    // - НИКОГДА не запрашиваем HIGH для tiles
    const TILE_MEDIUM_MIN_WIDTH_PX = 220;
    const desiredTilesQuality = thumbWidth >= TILE_MEDIUM_MIN_WIDTH_PX ? VideoQuality?.MEDIUM : VideoQuality?.LOW;

    setStageQualityRequested(qualityLabel(desiredStageQuality));
    setTilesQualityRequested(qualityLabel(desiredTilesQuality));

    const apply = (pub, q) => {
      if (!pub || q == null) return;
      const id = publicationId(pub);
      if (!id) return;

      // 1) Не вызываем, если requested не изменился.
      const prev = lastQualityByPubIdRef.current.get(id);
      if (prev === q) return;

      // 2) Не чаще, чем раз в 500ms на publication.
      const now = Date.now();
      const lastAt = lastQualitySetAtByPubIdRef.current.get(id) || 0;
      if (now - lastAt < 500) return;

      lastQualityByPubIdRef.current.set(id, q);
      lastQualitySetAtByPubIdRef.current.set(id, now);
      setPublicationSubscribedQuality(pub, q);
    };

    // 1) Stage -> HIGH
    if (stagePub) apply(stagePub, desiredStageQuality);

    // 2) Все остальные удалённые видео -> LOW/MEDIUM
    thumbnailItems.forEach((it) => {
      if (it.isLocal) return;
      const pub = it.videoPublication;
      const id = publicationId(pub);
      if (!pub || !id) return;
      if (stagePubKey && id === stagePubKey) return;
      apply(pub, desiredTilesQuality);
    });
  }, [callStatus, focusTarget, stageSize, thumbWidth, thumbnailItems]);

  // Auto-hide UX: слушаем активность на overlay.
  const handleOverlayMouseMove = useCallback(() => {
    bumpControls();
    wakeupMediaElements();
  }, [bumpControls, wakeupMediaElements]);

  const handleOverlayTouchStart = useCallback(() => {
    bumpControls();
    wakeupMediaElements();
  }, [bumpControls, wakeupMediaElements]);

  const handleOverlayClickCapture = useCallback((e) => {
    // Mobile-first: если controls скрыты — первый тап только показывает их.
    // (чтобы не случалось "случайных" hangup/mute/selection с первого тапа)
    if (!isCoarsePointerRef.current) {
      bumpControls();
      return;
    }

    if (callStatus !== 'active') {
      bumpControls();
      return;
    }

    if (!controlsVisible && !showConnStatus) {
      bumpControls();
      try {
        e.preventDefault?.();
        e.stopPropagation?.();
      } catch (_) {}
    }
  }, [bumpControls, callStatus, controlsVisible, showConnStatus]);

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
  const showControls = controlsVisible || showConnStatus || callStatus !== 'active';

  return (
    <div
      className="gvc-overlay"
      onMouseMove={handleOverlayMouseMove}
      onTouchStart={handleOverlayTouchStart}
      onClickCapture={handleOverlayClickCapture}
    >
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
        <div className="gvc-stage-wrap" ref={stageWrapRef}>
          <MainVideo
            videoTrack={focusTarget.videoTrack}
            displayName={focusTarget.displayName}
            isLocal={focusTarget.isLocal}
            isScreenShare={!!focusTarget.isScreenShare}
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

            <button
              className={`gvc-btn ${showConnStatus ? 'off' : ''}`}
              title={showConnStatus ? 'Скрыть состояние соединения' : 'Состояние соединения'}
              onClick={() => {
                // Открытие панели фиксирует controls видимыми.
                setShowConnStatus((v) => !v);
                bumpControls();
              }}
              disabled={callStatus !== 'active'}
            >
              <Icons.Settings />
            </button>

            <button className="gvc-btn leave" onClick={handleLeave} title="Покинуть звонок">
              <Icons.Hangup />
            </button>
          </div>
        </div>

        {/* Thumbnails Strip */}
        <div ref={thumbsWrapRef}>
          <ThumbnailsBar
            items={thumbnailItems}
            activeParticipantId={String(activeParticipantId || '').trim()}
            activeSpeakerId={activeSpeakerId}
            onSelect={handleSelectParticipant}
          />
        </div>

        {/* Connecting Overlay */}
        {callStatus === 'connecting' && (
          <div className="gvc-connecting">
            <div className="gvc-spinner" />
            <p>Подключение к звонку...</p>
          </div>
        )}
      </main>

      {showConnStatus && callStatus === 'active' && (
        <div className="gvc-conn-status">
          <div className="gvc-conn-title">Состояние соединения</div>
          <div className="gvc-conn-row">
            <span>Protocol</span>
            <b>{connProtocol || (lkConnectionState ? `auto (${lkConnectionState})` : 'auto')}</b>
          </div>
          <div className="gvc-conn-row"><span>Requested (stage)</span><b>{stageQualityRequested || 'auto'}</b></div>
          <div className="gvc-conn-row"><span>Requested (tiles)</span><b>{tilesQualityRequested || 'auto'}</b></div>
          <div className="gvc-conn-row">
            <span>Actual (video)</span>
            <b>
              {actualVideoInRes || actualVideoOutRes || 'auto (stats unavailable)'}
            </b>
          </div>
          <div className="gvc-conn-row"><span>Bitrate (in)</span><b>{typeof videoInKbps === 'number' ? `${videoInKbps} kbps` : 'N/A'}</b></div>
          <div className="gvc-conn-row"><span>Bitrate (out)</span><b>{typeof videoOutKbps === 'number' ? `${videoOutKbps} kbps` : 'N/A'}</b></div>
          <div className="gvc-conn-hint">
            Layer выставляется через LiveKit SDK и подстраивается под размер элемента.
            {statsNote ? ` (${statsNote})` : ''}
          </div>
        </div>
      )}
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
.gvc-video-mirror { transform: scaleX(-1); transform-origin: center; }
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
