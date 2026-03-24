import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { API_URL } from '@/config';
import { buildVideoConstraintsForTier, createAutoQualityManager, QUALITY_PROFILES } from '@/utils/autoQualityManager';

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

function isScreenLikeTrack(track) {
  if (!track) return false;
  const hint = String(track.contentHint || '').toLowerCase();
  const label = String(track.label || '').toLowerCase();
  return hint === 'detail' || label.includes('screen');
}

function buildCameraVideoConstraints(facingMode = 'user', tierConfig = QUALITY_PROFILES.p2pCamera.tiers.ultra) {
  return buildVideoConstraintsForTier(tierConfig, { facingMode });
}

function buildScreenShareConstraints(tierConfig = QUALITY_PROFILES.p2pScreen.tiers.ultra) {
  return {
    video: {
      displaySurface: 'monitor',
      ...buildVideoConstraintsForTier(tierConfig),
      selfBrowserSurface: 'exclude',
      surfaceSwitching: 'include'
    },
    audio: false
  };
}

const CONTROL_PROTOCOL_VERSION = 1;
const CONTROL_FRAME_TYPES = {
  SCREEN_INFO: 1,
  POINTER_DOWN: 2,
  POINTER_MOVE: 3,
  POINTER_UP: 4,
  TAP: 5,
  SWIPE: 6,
  TEXT: 7,
  GLOBAL_ACTION: 8,
  HEARTBEAT: 9,
  STOP: 10
};

const CONTROL_GLOBAL_ACTIONS = {
  BACK: 1,
  HOME: 2,
  RECENTS: 3
};
const CONTROL_FRAME_HEADER_SIZE = 19;

function encodeUtf8(value) {
  try {
    return new TextEncoder().encode(String(value || ''));
  } catch (_) {
    return new Uint8Array([]);
  }
}

function buildControlFrame({
  type,
  seq,
  x = 0,
  y = 0,
  x2 = 0,
  y2 = 0,
  arg = 0,
  payload = null
}) {
  const payloadBytes = payload instanceof Uint8Array ? payload : encodeUtf8(payload || '');
  const buffer = new ArrayBuffer(CONTROL_FRAME_HEADER_SIZE + payloadBytes.length);
  const view = new DataView(buffer);
  view.setUint8(0, CONTROL_PROTOCOL_VERSION);
  view.setUint8(1, type);
  view.setUint8(2, 0);
  view.setUint32(3, seq >>> 0);
  view.setUint16(7, x);
  view.setUint16(9, y);
  view.setUint16(11, x2);
  view.setUint16(13, y2);
  view.setUint16(15, arg);
  view.setUint16(17, payloadBytes.length);
  payloadBytes.forEach((value, index) => {
    view.setUint8(CONTROL_FRAME_HEADER_SIZE + index, value);
  });
  return buffer;
}

function getOrderedVideoCodecs(codecs) {
  if (!Array.isArray(codecs) || codecs.length === 0) return [];

  const preferredMimeTypes = ['video/VP9', 'video/VP8', 'video/H264'];
  const filtered = codecs.filter((codec) => {
    const mimeType = String(codec?.mimeType || '');
    return mimeType && !/rtx|red|ulpfec/i.test(mimeType);
  });

  const ordered = [];
  preferredMimeTypes.forEach((mimeType) => {
    filtered.forEach((codec) => {
      if (codec.mimeType === mimeType && !ordered.includes(codec)) {
        ordered.push(codec);
      }
    });
  });
  filtered.forEach((codec) => {
    if (!ordered.includes(codec)) {
      ordered.push(codec);
    }
  });

  return ordered;
}

async function preferPeerConnectionVideoCodec(pc) {
  if (!pc?.getTransceivers || typeof RTCRtpSender === 'undefined') return;

  const capabilities = RTCRtpSender.getCapabilities?.('video');
  const orderedCodecs = getOrderedVideoCodecs(capabilities?.codecs);
  if (orderedCodecs.length === 0) return;

  pc.getTransceivers().forEach((transceiver) => {
    if (transceiver?.sender?.track?.kind !== 'video') return;
    if (typeof transceiver.setCodecPreferences !== 'function') return;

    try {
      transceiver.setCodecPreferences(orderedCodecs);
    } catch (err) {
      console.warn('[CallModal] Failed to set codec preferences:', err);
    }
  });
}

async function tunePeerConnectionVideoSender(pc, options = {}) {
  const sender = pc?.getSenders?.().find((s) => s.track?.kind === 'video') || null;
  if (!sender?.getParameters || !sender?.setParameters) return;

  const {
    maxBitrate = QUALITY_PROFILES.p2pCamera.tiers.ultra.maxBitrate,
    maxFramerate = QUALITY_PROFILES.p2pCamera.tiers.ultra.frameRate,
    scaleResolutionDownBy = 1,
    degradationPreference = 'maintain-resolution'
  } = options;

  const parameters = sender.getParameters() || {};
  const baseEncoding = parameters.encodings?.[0] || {};
  parameters.encodings = [{
    ...baseEncoding,
    maxBitrate,
    maxFramerate,
    scaleResolutionDownBy
  }];

  try {
    parameters.degradationPreference = degradationPreference;
  } catch (e) {}

  try {
    await sender.setParameters(parameters);
  } catch (err) {
    console.warn('[CallModal] Failed to tune video sender:', err);
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
  const controlSessionSummaryValue = arguments?.[0]?.controlSessionSummary || null;
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  // videoMode описывает, ЧТО именно мы отправляем в видеотреке: камера или демонстрация экрана.
  // Это локальное состояние (UI/логика) + мы синхронизируем его с собеседником через socket.
  const [localVideoMode, setLocalVideoMode] = useState('camera'); // 'camera' | 'screen'
  const [remoteVideoMode, setRemoteVideoMode] = useState('camera'); // 'camera' | 'screen'
  const [localTrackLooksScreen, setLocalTrackLooksScreen] = useState(false);
  const [remoteTrackLooksScreen, setRemoteTrackLooksScreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionState, setConnectionState] = useState('new');
  const [hasLocalStream, setHasLocalStream] = useState(false);
  const [facingMode, setFacingMode] = useState('user'); // 'user' = фронтальная, 'environment' = задняя
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [iceServers, setIceServers] = useState(null);
  const [controlTextInput, setControlTextInput] = useState('');
  const [remoteControlState, setRemoteControlState] = useState({
    enabled: false,
    accessibilityEnabled: false,
    canRequest: false,
    sessionId: null,
    active: false,
    viewOnly: false,
    pending: false,
    expiresAt: null,
    channelState: 'closed',
    screenWidth: 0,
    screenHeight: 0,
    rotation: 0
  });

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
  const controlDcRef = useRef(null);
  const controlSeqRef = useRef(1);
  const captureOverlayRef = useRef(null);
  const controlMetricsRef = useRef({ width: 0, height: 0, rotation: 0 });
  const controlGestureRef = useRef({
    active: false,
    moved: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startedAt: 0,
    lastMoveTs: 0
  });
  const controlHeartbeatRef = useRef(null);
  const autoQualityManagersRef = useRef({
    camera: createAutoQualityManager({ profile: QUALITY_PROFILES.p2pCamera, initialTier: 'ultra' }),
    screen: createAutoQualityManager({ profile: QUALITY_PROFILES.p2pScreen, initialTier: 'ultra' })
  });
  const lastP2PStatsRef = useRef({ packetsSent: 0, packetsLost: 0 });
  const appliedP2PQualityRef = useRef({ mode: '', tier: '' });

  useEffect(() => {
    localVideoModeRef.current = localVideoMode;
  }, [localVideoMode]);

  useEffect(() => {
    controlMetricsRef.current = {
      width: Number(remoteControlState.screenWidth || 0),
      height: Number(remoteControlState.screenHeight || 0),
      rotation: Number(remoteControlState.rotation || 0)
    };
  }, [remoteControlState.screenWidth, remoteControlState.screenHeight, remoteControlState.rotation]);

  useEffect(() => {
    const summary = controlSessionSummaryValue;
    if (!summary || String(summary.controllerUserId || '').trim() !== String(currentUserId || '').trim()) {
      return;
    }
    setRemoteControlState((prev) => ({
      ...prev,
      sessionId: summary.sessionId || null,
      pending: summary.state === 'requested',
      active: summary.state === 'granted' && !summary.viewOnly,
      viewOnly: summary.state === 'granted' && Boolean(summary.viewOnly),
      expiresAt: summary.expiresAt || null
    }));
  }, [controlSessionSummaryValue, currentUserId]);

  const sendControlSignal = useCallback((signal, explicitTargetUserId = null) => {
    const targetId = explicitTargetUserId || remoteUserIdRef.current || remoteUser?._id;
    if (!socket || !callId || !targetId) return false;
    socket.emit('call:signal', {
      callId,
      targetUserId: targetId,
      signal
    });
    return true;
  }, [socket, callId, remoteUser]);

  const syncLocalScreenHint = useCallback((track) => {
    setLocalTrackLooksScreen(isScreenLikeTrack(track));
  }, []);

  const syncRemoteScreenHint = useCallback((track) => {
    setRemoteTrackLooksScreen(isScreenLikeTrack(track));
  }, []);

  const getActiveP2PQualityTarget = useCallback((track = null) => {
    const mode = isScreenLikeTrack(track) || localVideoModeRef.current === 'screen' ? 'screen' : 'camera';
    return {
      mode,
      manager: mode === 'screen' ? autoQualityManagersRef.current.screen : autoQualityManagersRef.current.camera,
      profile: mode === 'screen' ? QUALITY_PROFILES.p2pScreen : QUALITY_PROFILES.p2pCamera,
    };
  }, []);

  const applyP2PQualityDecision = useCallback(async (track, decision, force = false) => {
    if (!track || !decision?.config) return;

    const pc = peerConnectionRef.current;
    if (!pc) return;

    const { mode } = getActiveP2PQualityTarget(track);
    const alreadyApplied = appliedP2PQualityRef.current.mode === mode && appliedP2PQualityRef.current.tier === decision.tier;
    if (!force && alreadyApplied) return;

    try {
      if (typeof track.applyConstraints === 'function') {
        if (mode === 'screen') {
          await track.applyConstraints(buildVideoConstraintsForTier(decision.config));
        } else {
          await track.applyConstraints(buildCameraVideoConstraints(facingMode, decision.config));
        }
      }
    } catch (err) {
      console.warn('[CallModal] Failed to apply local track constraints:', err);
    }

    await tunePeerConnectionVideoSender(pc, {
      maxBitrate: decision.config.maxBitrate,
      maxFramerate: decision.config.frameRate,
      degradationPreference: 'maintain-resolution'
    });

    appliedP2PQualityRef.current = { mode, tier: decision.tier };
    console.info('[CallModal] Applied outgoing quality tier', {
      mode,
      tier: decision.tier,
      reason: decision.reason,
      width: decision.config.width,
      height: decision.config.height,
      frameRate: decision.config.frameRate,
      maxBitrate: decision.config.maxBitrate
    });
  }, [facingMode, getActiveP2PQualityTarget]);

  const evaluateP2PQuality = useCallback(async (force = false) => {
    const pc = peerConnectionRef.current;
    if (!pc?.getStats) return;

    const sender = getVideoSender(pc);
    const track = sender?.track || localStreamRef.current?.getVideoTracks?.()[0] || null;
    if (!track) return;

    try {
      const stats = await pc.getStats();
      const rows = [];
      stats?.forEach?.((entry) => rows.push(entry));
      if (!rows.length) return;

      const byId = new Map();
      rows.forEach((row) => {
        if (row?.id) byId.set(row.id, row);
      });

      const outbound = rows
        .filter((row) => row?.type === 'outbound-rtp' && (row?.kind === 'video' || row?.mediaType === 'video'))
        .sort((left, right) => Number(right?.bytesSent || 0) - Number(left?.bytesSent || 0))[0] || null;
      if (!outbound) return;

      const remoteInbound = outbound?.remoteId ? byId.get(outbound.remoteId) : null;
      const selectedPair = rows.find((row) => row?.type === 'candidate-pair' && (row?.selected || row?.nominated || row?.state === 'succeeded')) || null;

      const packetsSent = Number(outbound?.packetsSent || 0);
      const packetsLost = Number(remoteInbound?.packetsLost || 0);
      const prev = lastP2PStatsRef.current;
      const deltaSent = Math.max(0, packetsSent - Number(prev.packetsSent || 0));
      const deltaLost = Math.max(0, packetsLost - Number(prev.packetsLost || 0));
      const packetLoss = deltaSent > 0 ? deltaLost / Math.max(1, deltaSent + deltaLost) : 0;

      lastP2PStatsRef.current = { packetsSent, packetsLost };

      const { manager } = getActiveP2PQualityTarget(track);
      const decision = manager.update({
        timestamp: Date.now(),
        availableOutgoingBitrate: Number(selectedPair?.availableOutgoingBitrate || 0),
        qualityLimitationReason: String(outbound?.qualityLimitationReason || 'none'),
        packetLoss,
        frameRate: Number(outbound?.framesPerSecond || 0),
        frameWidth: Number(outbound?.frameWidth || 0),
        frameHeight: Number(outbound?.frameHeight || 0),
        roundTripTime: Number(remoteInbound?.roundTripTime || selectedPair?.currentRoundTripTime || 0),
      });

      if (force || decision.changed || appliedP2PQualityRef.current.tier !== decision.tier) {
        await applyP2PQualityDecision(track, decision, force);
      }
    } catch (err) {
      console.warn('[CallModal] Failed to evaluate P2P quality:', err);
    }
  }, [applyP2PQualityDecision, getActiveP2PQualityTarget]);

  const isLocalScreen = localVideoMode === 'screen' || localTrackLooksScreen;
  const isRemoteScreen = remoteVideoMode === 'screen' || remoteTrackLooksScreen;

  // Swap доступен только когда оба потока — камера (screen share не участвует).
  const swapEnabled = callType === 'video' && !isLocalScreen && !isRemoteScreen;

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
    const { mode, manager } = getActiveP2PQualityTarget(newVideoTrack);
    const baseDecision = manager.reset('ultra');
    lastP2PStatsRef.current = { packetsSent: 0, packetsLost: 0 };
    appliedP2PQualityRef.current = { mode: '', tier: '' };
    await tunePeerConnectionVideoSender(pc, {
      maxBitrate: baseDecision.config?.maxBitrate,
      maxFramerate: baseDecision.config?.frameRate,
      degradationPreference: 'maintain-resolution'
    });
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
    syncLocalScreenHint(newVideoTrack);
    await applyP2PQualityDecision(newVideoTrack, baseDecision, true);
  }, [applyP2PQualityDecision, getActiveP2PQualityTarget, syncLocalScreenHint]);

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

  const nextControlSeq = useCallback(() => {
    const current = Number(controlSeqRef.current || 1);
    controlSeqRef.current = current + 1;
    return current;
  }, []);

  const bindControlChannel = useCallback((channel) => {
    if (!channel || channel.label !== 'govchat-control-v1') return;
    controlDcRef.current = channel;
    channel.binaryType = 'arraybuffer';
    channel.onopen = () => {
      console.log('[CallModal] Control channel open');
      setRemoteControlState((prev) => ({ ...prev, channelState: 'open' }));
    };
    channel.onclose = () => {
      console.log('[CallModal] Control channel closed');
      setRemoteControlState((prev) => ({ ...prev, channelState: 'closed', active: false }));
    };
    channel.onerror = (error) => {
      console.warn('[CallModal] Control channel error:', error);
      setRemoteControlState((prev) => ({ ...prev, channelState: 'error' }));
    };
    channel.onmessage = () => {};
  }, []);

  const sendControlFrame = useCallback((frame) => {
    const channel = controlDcRef.current;
    if (!channel || channel.readyState !== 'open') return false;
    if (!remoteControlState.active || remoteControlState.viewOnly) return false;
    try {
      channel.send(frame);
      return true;
    } catch (error) {
      console.warn('[CallModal] Failed to send control frame:', error);
      return false;
    }
  }, [remoteControlState.active, remoteControlState.viewOnly]);

  const resolveRemoteContentRect = useCallback(() => {
    const videoEl = remoteVideoRef.current;
    if (!videoEl) return null;
    const rect = videoEl.getBoundingClientRect();
    if (!rect?.width || !rect?.height) return null;

    const sourceWidth = Number(controlMetricsRef.current.width || videoEl.videoWidth || 0);
    const sourceHeight = Number(controlMetricsRef.current.height || videoEl.videoHeight || 0);
    if (!sourceWidth || !sourceHeight) {
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }

    const containerAspect = rect.width / rect.height;
    const sourceAspect = sourceWidth / sourceHeight;
    let width = rect.width;
    let height = rect.height;
    let left = rect.left;
    let top = rect.top;

    if (containerAspect > sourceAspect) {
      height = rect.height;
      width = height * sourceAspect;
      left = rect.left + ((rect.width - width) / 2);
    } else {
      width = rect.width;
      height = width / sourceAspect;
      top = rect.top + ((rect.height - height) / 2);
    }

    return { left, top, width, height };
  }, []);

  const normalizeControlPoint = useCallback((clientX, clientY) => {
    const rect = resolveRemoteContentRect();
    if (!rect) return null;
    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;
    if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return null;
    return {
      x: Math.max(0, Math.min(65535, Math.round(relX * 65535))),
      y: Math.max(0, Math.min(65535, Math.round(relY * 65535)))
    };
  }, [resolveRemoteContentRect]);

  const requestRemoteControl = useCallback(() => {
    const sessionId = (globalThis.crypto?.randomUUID?.() || `rc-${Date.now()}`);
    const sent = sendControlSignal({
      type: 'control-request',
      sessionId,
      requestedBy: currentUserId || ''
    });
    if (sent) {
      setRemoteControlState((prev) => ({
        ...prev,
        sessionId,
        pending: true,
        active: false,
        viewOnly: false
      }));
    }
  }, [sendControlSignal, currentUserId]);

  const stopRemoteControlSession = useCallback((reason = 'controller_stopped') => {
    const sessionId = remoteControlState.sessionId;
    if (!sessionId) return;
    sendControlSignal({
      type: 'control-stop',
      sessionId,
      reason
    });
    setRemoteControlState((prev) => ({
      ...prev,
      sessionId: null,
      pending: false,
      active: false,
      viewOnly: false,
      expiresAt: null
    }));
  }, [remoteControlState.sessionId, sendControlSignal]);

  const sendControlText = useCallback(() => {
    const value = String(controlTextInput || '').trim();
    if (!value) return;
    const payload = encodeUtf8(value);
    const sent = sendControlFrame(buildControlFrame({
      type: CONTROL_FRAME_TYPES.TEXT,
      seq: nextControlSeq(),
      payload
    }));
    if (sent) {
      setControlTextInput('');
    }
  }, [controlTextInput, nextControlSeq, sendControlFrame]);

  const sendGlobalAction = useCallback((action) => {
    sendControlFrame(buildControlFrame({
      type: CONTROL_FRAME_TYPES.GLOBAL_ACTION,
      seq: nextControlSeq(),
      arg: action
    }));
  }, [nextControlSeq, sendControlFrame]);

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

    if (controlHeartbeatRef.current) {
      clearInterval(controlHeartbeatRef.current);
      controlHeartbeatRef.current = null;
    }

    if (controlDcRef.current) {
      try { controlDcRef.current.close(); } catch (e) {}
      controlDcRef.current = null;
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
    autoQualityManagersRef.current.camera.reset('ultra');
    autoQualityManagersRef.current.screen.reset('ultra');
    lastP2PStatsRef.current = { packetsSent: 0, packetsLost: 0 };
    appliedP2PQualityRef.current = { mode: '', tier: '' };
    setHasLocalStream(false);
    setHasRemoteStream(false);
    setLocalVideoMode('camera');
    setRemoteVideoMode('camera');
    setLocalTrackLooksScreen(false);
    setRemoteTrackLooksScreen(false);
    setRemoteControlState({
      enabled: false,
      accessibilityEnabled: false,
      canRequest: false,
      sessionId: null,
      active: false,
      viewOnly: false,
      pending: false,
      expiresAt: null,
      channelState: 'closed',
      screenWidth: 0,
      screenHeight: 0,
      rotation: 0
    });
    setControlTextInput('');
    setIsLocalFullscreen(false);
    controlGestureRef.current = {
      active: false,
      moved: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      startedAt: 0,
      lastMoveTs: 0
    };
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
        video: callType === 'video' ? buildCameraVideoConstraints('user') : false
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
      const localVideoTrack = stream.getVideoTracks?.()[0] || null;
      if (localVideoTrack && 'contentHint' in localVideoTrack) {
        try {
          localVideoTrack.contentHint = 'motion';
        } catch (e) {}
      }
      autoQualityManagersRef.current.camera.reset('ultra');
      appliedP2PQualityRef.current = { mode: '', tier: '' };
      lastP2PStatsRef.current = { packetsSent: 0, packetsLost: 0 };
      syncLocalScreenHint(localVideoTrack);
      
      return stream;
    } catch (err) {
      console.error('[CallModal] getUserMedia error:', err);
      alert('Не удалось получить доступ к камере/микрофону: ' + err.message);
      return null;
    }
  }, [callType, syncLocalScreenHint]);

  // Create PeerConnection
  const createPeerConnection = useCallback((stream, iceConfig) => {
    console.log('[CallModal] Creating PeerConnection with ICE config:', iceConfig);
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    const pc = new RTCPeerConnection(iceConfig);
    peerConnectionRef.current = pc;
    if (isInitiatorRef.current && !controlDcRef.current) {
      bindControlChannel(pc.createDataChannel('govchat-control-v1', { ordered: true }));
    }
    
    // Add local tracks
    if (stream) {
      stream.getTracks().forEach(track => {
        console.log('[CallModal] Adding track to PC:', track.kind);
        pc.addTrack(track, stream);
      });
      void preferPeerConnectionVideoCodec(pc);
      void tunePeerConnectionVideoSender(pc);
      const localVideoTrack = stream.getVideoTracks?.()[0] || null;
      if (localVideoTrack) {
        const { manager } = getActiveP2PQualityTarget(localVideoTrack);
        void applyP2PQualityDecision(localVideoTrack, manager.getSnapshot(), true);
      }
    }
    
    // Handle remote tracks
    pc.ontrack = (event) => {
      console.log('[CallModal] ontrack event:', event.streams);
      const [remoteStream] = event.streams;
      if (remoteStream && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        setHasRemoteStream(true);
        syncRemoteScreenHint(event.track || remoteStream.getVideoTracks?.()[0] || null);
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
        syncRemoteScreenHint(event.track || fallbackStream.getVideoTracks?.()[0] || null);
        console.log('[CallModal] Remote track attached via fallback stream:', event.track.kind, event.track.id);
      }
    };

    pc.ondatachannel = (event) => {
      if (event?.channel?.label === 'govchat-control-v1') {
        bindControlChannel(event.channel);
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
  }, [applyP2PQualityDecision, bindControlChannel, getActiveP2PQualityTarget, socket, callId, remoteUser, syncRemoteScreenHint]);

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
    if (remoteControlState.sessionId) {
      sendControlSignal({
        type: 'control-stop',
        sessionId: remoteControlState.sessionId,
        reason: 'call_ended'
      });
    }
    socket.emit('call:leave', { callId });
    cleanup();
    onClose?.();
  }, [socket, callId, cleanup, onClose, remoteControlState.sessionId, sendControlSignal]);

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
        video: buildCameraVideoConstraints(newFacingMode),
        audio: false // аудио оставляем старое
      });
      
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack && 'contentHint' in newVideoTrack) {
        try {
          newVideoTrack.contentHint = 'motion';
        } catch (e) {}
      }

      await replaceOutgoingVideoTrack(newVideoTrack);
      
      setFacingMode(newFacingMode);
      console.log('[CallModal] Camera switched to:', newFacingMode);
      
    } catch (err) {
      console.error('[CallModal] Error switching camera:', err);
      // Возможно устройство не поддерживает вторую камеру
      alert('Не удалось переключить камеру. Возможно, устройство не поддерживает вторую камеру.');
    }
  }, [callType, facingMode, replaceOutgoingVideoTrack]);

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
        video: buildCameraVideoConstraints(facingMode),
        audio: false
      });
      const camTrack = camStream.getVideoTracks()[0];
      if (!camTrack) {
        throw new Error('Не удалось получить video track камеры');
      }
      if ('contentHint' in camTrack) {
        try {
          camTrack.contentHint = 'motion';
        } catch (e) {}
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
      const screenStream = await navigator.mediaDevices.getDisplayMedia(buildScreenShareConstraints());

      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) {
        throw new Error('Не удалось получить video track для экрана');
      }
      if ('contentHint' in screenTrack) {
        try {
          screenTrack.contentHint = 'detail';
        } catch (e) {}
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
        } else if (signal.type === 'control-state') {
          setRemoteControlState((prev) => ({
            ...prev,
            enabled: Boolean(signal?.enabled),
            accessibilityEnabled: Boolean(signal?.accessibilityEnabled),
            canRequest: Boolean(signal?.canRequest),
            sessionId: signal?.enabled ? (signal?.sessionId || prev.sessionId) : null,
            screenWidth: Number(signal?.screenWidth || 0),
            screenHeight: Number(signal?.screenHeight || 0),
            rotation: Number(signal?.rotation || 0),
            pending: signal?.enabled ? prev.pending : false,
            active: signal?.enabled ? prev.active : false,
            viewOnly: signal?.enabled ? prev.viewOnly : false,
            expiresAt: signal?.enabled ? prev.expiresAt : null
          }));
        } else if (signal.type === 'control-request') {
          setRemoteControlState((prev) => ({
            ...prev,
            sessionId: signal?.sessionId || prev.sessionId,
            pending: true
          }));
        } else if (signal.type === 'control-grant') {
          setRemoteControlState((prev) => ({
            ...prev,
            sessionId: signal?.sessionId || prev.sessionId,
            pending: false,
            active: !signal?.viewOnly,
            viewOnly: Boolean(signal?.viewOnly),
            expiresAt: signal?.expiresAt || null
          }));
        } else if (signal.type === 'control-deny' || signal.type === 'control-stop') {
          setRemoteControlState((prev) => ({
            ...prev,
            sessionId: null,
            pending: false,
            active: false,
            viewOnly: false,
            expiresAt: null
          }));
        }
      } catch (err) {
        console.error('[CallModal] Signal handling error:', err);
      }
    };
    
    const handleCallEnded = ({ callId: endedCallId, reason }) => {
      if (String(endedCallId || '').trim() !== String(callId || '').trim()) {
        return;
      }
      console.log('[CallModal] Call ended, reason:', reason);
      cleanup();
      onClose?.();
    };
    
    const handleParticipantJoined = async ({ callId: joinedCallId, userId: joinedUserId, userName }) => {
      if (String(joinedCallId || '').trim() !== String(callId || '').trim()) {
        return;
      }
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
    
    const handleParticipantLeft = ({ callId: leftCallId, callEnded }) => {
      if (String(leftCallId || '').trim() !== String(callId || '').trim()) {
        return;
      }
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

  useEffect(() => {
    if (controlHeartbeatRef.current) {
      clearInterval(controlHeartbeatRef.current);
      controlHeartbeatRef.current = null;
    }
    if (!remoteControlState.sessionId) return undefined;
    if (!remoteControlState.active && !remoteControlState.viewOnly) return undefined;

    controlHeartbeatRef.current = setInterval(() => {
      sendControlSignal({
        type: 'control-heartbeat',
        sessionId: remoteControlState.sessionId
      });
    }, 2000);

    return () => {
      if (controlHeartbeatRef.current) {
        clearInterval(controlHeartbeatRef.current);
        controlHeartbeatRef.current = null;
      }
    };
  }, [remoteControlState.sessionId, remoteControlState.active, remoteControlState.viewOnly, sendControlSignal]);

  useEffect(() => {
    if (!remoteControlState.active) return undefined;
    if (!remoteControlState.screenWidth || !remoteControlState.screenHeight) return undefined;

    sendControlFrame(buildControlFrame({
      type: CONTROL_FRAME_TYPES.SCREEN_INFO,
      seq: nextControlSeq(),
      x: Math.max(0, Math.min(65535, Number(remoteControlState.screenWidth || 0))),
      y: Math.max(0, Math.min(65535, Number(remoteControlState.screenHeight || 0))),
      arg: Math.max(0, Math.min(65535, Number(remoteControlState.rotation || 0)))
    }));
    return undefined;
  }, [
    nextControlSeq,
    remoteControlState.active,
    remoteControlState.rotation,
    remoteControlState.screenHeight,
    remoteControlState.screenWidth,
    sendControlFrame
  ]);

  const remoteControlAllowed = callType === 'video' &&
    callState === 'active' &&
    !isMobileBrowser() &&
    isRemoteScreen &&
    hasRemoteStream;

  const remoteControlOverlayEnabled = remoteControlAllowed &&
    remoteControlState.active &&
    !remoteControlState.viewOnly &&
    remoteControlState.channelState === 'open';

  const canRequestRemoteControl = remoteControlAllowed &&
    remoteControlState.enabled &&
    remoteControlState.canRequest &&
    !remoteControlState.pending &&
    !remoteControlState.active &&
    !remoteControlState.viewOnly;

  const remoteControlStatusText = useMemo(() => {
    if (!remoteControlAllowed) return '';
    if (remoteControlState.pending) return 'Ожидание подтверждения управления';
    if (remoteControlState.viewOnly && remoteControlState.sessionId) return 'Режим только просмотра';
    if (remoteControlState.active) return 'Удалённое управление активно';
    if (remoteControlState.enabled && !remoteControlState.accessibilityEnabled) return 'На Android доступен только просмотр';
    if (remoteControlState.enabled && remoteControlState.channelState !== 'open') return 'Ожидание control channel';
    if (remoteControlState.enabled && remoteControlState.canRequest) return 'Можно запросить управление';
    if (remoteControlState.enabled) return 'Управление пока недоступно';
    return 'Управление недоступно';
  }, [
    remoteControlAllowed,
    remoteControlState.pending,
    remoteControlState.viewOnly,
    remoteControlState.sessionId,
    remoteControlState.active,
    remoteControlState.enabled,
    remoteControlState.accessibilityEnabled,
    remoteControlState.channelState
  ]);

  const handleControlPointerDown = useCallback((event) => {
    if (!remoteControlOverlayEnabled) return;
    const point = normalizeControlPoint(event.clientX, event.clientY);
    if (!point) return;

    controlGestureRef.current = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      lastX: point.x,
      lastY: point.y,
      startedAt: performance.now(),
      lastMoveTs: 0
    };

    try {
      captureOverlayRef.current?.focus?.();
      event.currentTarget?.setPointerCapture?.(event.pointerId);
    } catch (_) {}

    sendControlFrame(buildControlFrame({
      type: CONTROL_FRAME_TYPES.POINTER_DOWN,
      seq: nextControlSeq(),
      x: point.x,
      y: point.y
    }));

    try {
      event.preventDefault();
    } catch (_) {}
  }, [nextControlSeq, normalizeControlPoint, remoteControlOverlayEnabled, sendControlFrame]);

  const handleControlPointerMove = useCallback((event) => {
    const gesture = controlGestureRef.current;
    if (!remoteControlOverlayEnabled || !gesture.active || gesture.pointerId !== event.pointerId) return;

    const point = normalizeControlPoint(event.clientX, event.clientY);
    if (!point) return;

    const now = performance.now();
    if (!gesture.moved && (Math.abs(point.x - gesture.startX) > 120 || Math.abs(point.y - gesture.startY) > 120)) {
      gesture.moved = true;
    }
    gesture.lastX = point.x;
    gesture.lastY = point.y;
    if ((now - Number(gesture.lastMoveTs || 0)) < 50) {
      try {
        event.preventDefault();
      } catch (_) {}
      return;
    }
    gesture.lastMoveTs = now;

    sendControlFrame(buildControlFrame({
      type: CONTROL_FRAME_TYPES.POINTER_MOVE,
      seq: nextControlSeq(),
      x: point.x,
      y: point.y
    }));

    try {
      event.preventDefault();
    } catch (_) {}
  }, [nextControlSeq, normalizeControlPoint, remoteControlOverlayEnabled, sendControlFrame]);

  const finishControlGesture = useCallback((event, cancelled = false) => {
    const gesture = controlGestureRef.current;
    if (!gesture.active || gesture.pointerId !== event.pointerId) return;

    const point = normalizeControlPoint(event.clientX, event.clientY) || {
      x: gesture.lastX || gesture.startX,
      y: gesture.lastY || gesture.startY
    };

    controlGestureRef.current = {
      active: false,
      moved: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      startedAt: 0,
      lastMoveTs: 0
    };

    try {
      event.currentTarget?.releasePointerCapture?.(event.pointerId);
    } catch (_) {}

    if (!cancelled) {
      sendControlFrame(buildControlFrame({
        type: CONTROL_FRAME_TYPES.POINTER_UP,
        seq: nextControlSeq(),
        x: point.x,
        y: point.y
      }));
    }

    try {
      event.preventDefault();
    } catch (_) {}
  }, [nextControlSeq, normalizeControlPoint, sendControlFrame]);

  const handleControlPointerUp = useCallback((event) => {
    finishControlGesture(event, false);
  }, [finishControlGesture]);

  const handleControlPointerCancel = useCallback((event) => {
    finishControlGesture(event, true);
  }, [finishControlGesture]);

  const handleControlTextKeyDown = useCallback((event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    sendControlText();
  }, [sendControlText]);

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
      syncLocalScreenHint(localStreamRef.current.getVideoTracks?.()[0] || null);
    }
  }, [hasLocalStream, syncLocalScreenHint]);

  useEffect(() => {
    if (callType !== 'video') return undefined;
    if (connectionState !== 'connected') return undefined;
    if (!peerConnectionRef.current?.getStats) return undefined;

    let cancelled = false;
    let timer = null;

    const tick = async () => {
      if (cancelled) return;
      await evaluateP2PQuality();
    };

    tick();
    timer = setInterval(tick, 2000);

    return () => {
      cancelled = true;
      try {
        if (timer) clearInterval(timer);
      } catch (e) {}
    };
  }, [callType, connectionState, evaluateP2PQuality]);

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
    !isRemoteScreen &&
    (isLocalScreen || (swapEnabled && isLocalFullscreen));
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
                objectFit: isRemoteScreen ? 'contain' : 'cover',
                backgroundColor: isRemoteScreen ? '#000' : 'transparent',
                borderRadius: isMobileVideoLayout ? (remoteIsPip ? '14px' : 0) : '20px',
                transition: 'all 200ms ease',
                cursor: pipClickable && remoteIsPip ? 'pointer' : 'default',
                ...(remoteIsPip ? { pointerEvents: 'auto' } : {})
              }}
            />
          ) : null}
          
          {/* Avatar placeholder when no remote video (не показываем поверх screen share) */}
          {(!hasRemoteStream || callType === 'audio') && !isLocalScreen && (
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
                objectFit: isLocalScreen ? 'contain' : 'cover',
                backgroundColor: isLocalScreen ? '#000' : 'transparent',
                // Self-view (камера) — зеркалим ТОЛЬКО в UI. Screen share никогда не зеркалим.
                // Важно: для PiP комбинируем translate(var(--pip-x/y)) и scaleX(-1).
                ...(isLocalScreen
                  ? {}
                  : (localIsPip
                      ? { transform: 'translate3d(var(--pip-x, 0px), var(--pip-y, 0px), 0) scaleX(-1)', transformOrigin: 'center' }
                      : { transform: 'scaleX(-1)', transformOrigin: 'center' })),
                transition: 'all 200ms ease',
                cursor: pipClickable && localIsPip ? 'pointer' : 'default',
                ...(localIsPip ? { pointerEvents: 'auto' } : {})
              }}
            />
          )}

          {remoteControlAllowed && (
            <>
              <div style={styles.remoteControlBadge}>
                <span>{remoteControlStatusText}</span>
                {remoteControlState.expiresAt ? (
                  <span style={styles.remoteControlMeta}>
                    до {new Date(remoteControlState.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                ) : null}
              </div>

              <div
                ref={captureOverlayRef}
                tabIndex={remoteControlOverlayEnabled ? 0 : -1}
                onPointerDown={handleControlPointerDown}
                onPointerMove={handleControlPointerMove}
                onPointerUp={handleControlPointerUp}
                onPointerCancel={handleControlPointerCancel}
                style={{
                  ...styles.remoteControlOverlay,
                  opacity: remoteControlOverlayEnabled ? 1 : 0,
                  pointerEvents: remoteControlOverlayEnabled ? 'auto' : 'none',
                  cursor: remoteControlOverlayEnabled ? 'crosshair' : 'default'
                }}
              />
            </>
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

        {remoteControlAllowed && (
          <div style={styles.remoteControlPanel}>
            <div style={styles.remoteControlPanelRow}>
              {canRequestRemoteControl && (
                <button
                  onClick={requestRemoteControl}
                  style={{
                    ...styles.remoteControlActionBtn,
                    ...styles.remoteControlPrimaryBtn
                  }}
                >
                  Запросить управление
                </button>
              )}

              {(remoteControlState.active || remoteControlState.viewOnly || remoteControlState.pending) && (
                <button
                  onClick={() => stopRemoteControlSession('controller_stopped')}
                  style={styles.remoteControlActionBtn}
                >
                  Отключить
                </button>
              )}

              <div style={styles.remoteControlChannelState}>
                DataChannel: {remoteControlState.channelState}
              </div>
            </div>

            <div style={styles.remoteControlPanelRow}>
              <button
                onClick={() => sendGlobalAction(CONTROL_GLOBAL_ACTIONS.BACK)}
                style={styles.remoteControlMiniBtn}
                disabled={!remoteControlOverlayEnabled}
              >
                Назад
              </button>
              <button
                onClick={() => sendGlobalAction(CONTROL_GLOBAL_ACTIONS.HOME)}
                style={styles.remoteControlMiniBtn}
                disabled={!remoteControlOverlayEnabled}
              >
                Домой
              </button>
              <button
                onClick={() => sendGlobalAction(CONTROL_GLOBAL_ACTIONS.RECENTS)}
                style={styles.remoteControlMiniBtn}
                disabled={!remoteControlOverlayEnabled}
              >
                Recent
              </button>
            </div>

            <div style={styles.remoteControlPanelRow}>
              <input
                value={controlTextInput}
                onChange={(event) => setControlTextInput(event.target.value)}
                onKeyDown={handleControlTextKeyDown}
                placeholder="Текст для Android"
                style={styles.remoteControlInput}
                disabled={!remoteControlOverlayEnabled}
              />
              <button
                onClick={sendControlText}
                style={styles.remoteControlActionBtn}
                disabled={!remoteControlOverlayEnabled || !String(controlTextInput || '').trim()}
              >
                Отправить текст
              </button>
            </div>
          </div>
        )}
        
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
  remoteControlBadge: {
    position: 'absolute',
    top: '24px',
    left: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    borderRadius: '14px',
    background: 'rgba(15, 23, 42, 0.82)',
    border: '1px solid rgba(96, 165, 250, 0.25)',
    color: '#e2e8f0',
    fontSize: '13px',
    zIndex: 45,
    backdropFilter: 'blur(12px)',
  },
  remoteControlMeta: {
    color: 'rgba(191, 219, 254, 0.9)'
  },
  remoteControlOverlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 42,
    touchAction: 'none',
    outline: 'none'
  },
  remoteControlPanel: {
    position: 'absolute',
    left: '24px',
    right: '24px',
    bottom: '122px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '14px',
    borderRadius: '18px',
    background: 'rgba(15, 23, 42, 0.82)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    backdropFilter: 'blur(16px)',
    zIndex: 48,
  },
  remoteControlPanelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  remoteControlActionBtn: {
    height: '40px',
    padding: '0 14px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    background: 'rgba(30, 41, 59, 0.9)',
    color: '#f8fafc',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
  },
  remoteControlPrimaryBtn: {
    background: '#2563eb',
    borderColor: '#2563eb',
  },
  remoteControlMiniBtn: {
    height: '36px',
    padding: '0 12px',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    background: 'rgba(30, 41, 59, 0.9)',
    color: '#f8fafc',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
  },
  remoteControlChannelState: {
    color: 'rgba(191, 219, 254, 0.9)',
    fontSize: '12px',
    marginLeft: 'auto',
  },
  remoteControlInput: {
    flex: 1,
    minWidth: '220px',
    height: '40px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    background: 'rgba(15, 23, 42, 0.92)',
    color: '#f8fafc',
    padding: '0 12px',
    fontSize: '14px',
    outline: 'none',
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
