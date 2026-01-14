import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { API_URL } from '../config';
import { Client, LocalStream } from 'ion-sdk-js';
import { IonSFUJSONRPCSignal } from 'ion-sdk-js/lib/signal/json-rpc-impl';

// Спец-id для «закрепить своё видео» без переписывания всей логики pinnedUserId.
// Почему так: pinnedUserId раньше принимал только remote userId, из-за чего
// пользователь не мог стабильно удерживать локальное видео главным (оно "прыгало"
// из-за active speaker). Mongo ObjectId никогда не совпадёт с таким значением.
const LOCAL_PIN_ID = '__local__';

/**
 * GroupCallModal - Компонент для групповых видео/аудио звонков (Discord-like UX)
 * P2P: 1-на-1 (<=2 участников) — прямой WebRTC (как раньше, но без mesh-map)
 * SFU: 3+ участников — ion-sfu (json-rpc), 1 RTCPeerConnection → SFU
 * 
 * Основные особенности:
 * - Main video (pinned/active speaker) + preview strip
 * - Active speaker detection через AudioContext (клиентская сторона)
 * - Bitrate control для оптимизации mesh до 10 участников
 * - Android WebView compatible
 * 
 * АРХИТЕКТУРА СТРИМОВ (streams-first):
 * - localStreamRef: ТОЛЬКО локальный поток (никогда не в общей map)
 * - remoteStreamsRef: Map<userId, MediaStream> — ТОЛЬКО remote потоки
 * - UI рендерится по наличию MediaStream, НЕ по participants
 * - ontrack использует addTrack паттерн, а не замену стрима
 */
function GroupCallModal({
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
  // ===== СОСТОЯНИЯ =====
  const [callStatus, setCallStatus] = useState(isIncoming ? 'incoming' : 'connecting');
  // participants хранит ТОЛЬКО метаданные (userId, userName), БЕЗ stream
  const [participants, setParticipants] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Логика выбора транспорта
  const [callMode, setCallMode] = useState('p2p'); // 'p2p' | 'sfu'
  const callModeRef = useRef('p2p');
  // ВАЖНО: backend отдаёт не только iceServers, но и iceCandidatePoolSize.
  // Для ускорения первого подключения нам нужно иметь этот конфиг ДО создания RTCPeerConnection.
  const [iceServers, setIceServers] = useState([]);
  const iceConfigRef = useRef({ iceServers: [], iceCandidatePoolSize: 10 });
  const iceReadyRef = useRef(false);
  const iceLoadPromiseRef = useRef(null);
  // Счётчик обновлений стримов для trigger ререндера
  const [streamUpdateCounter, setStreamUpdateCounter] = useState(0);
  
  // Discord-like UX состояния
  // По умолчанию закрепляем локальное видео, чтобы убрать "прыжки" главного видео.
  // Пользователь может переключиться в Auto-режим (следовать active speaker).
  const [pinnedUserId, setPinnedUserId] = useState(LOCAL_PIN_ID); // Закреплённый пользователь (manual)
  const [activeSpeakerId, setActiveSpeakerId] = useState(null); // Активный говорящий
  const [audioLevels, setAudioLevels] = useState({}); // { userId: volume }

  const [captureTierUi, setCaptureTierUi] = useState('SD'); // UI-индикатор (SD/HD)

  // ===== REFS =====
  const localVideoRef = useRef(null); // Для main video (локальное)
  const localPreviewVideoRef = useRef(null); // Для preview strip (локальное) - ОТДЕЛЬНЫЙ ref!
  const mainVideoRef = useRef(null); // Главное видео (remote)
  const remoteStreamsRef = useRef(new Map()); // Map<oderId, MediaStream> - remote ТОЛЬКО

  // === P2P (<=2) ===
  const p2pPcRef = useRef(null); // RTCPeerConnection
  const p2pPeerIdRef = useRef(null); // userId удалённого участника (если есть)
  const p2pPendingCandidatesRef = useRef([]); // ICECandidateInit[]
  const p2pMetaRef = useRef({ isMakingOffer: false, ignoreOffer: false, isPolite: true, shouldInitiate: false });

  // === SFU (>=3) ===
  const sfuSignalRef = useRef(null);
  const sfuClientRef = useRef(null);
  const sfuPublishedLocalStreamIdRef = useRef(null); // stream.id, который видит SFU
  const sfuRemoteStreamIdToUserIdRef = useRef(new Map()); // streamId -> userId
  const sfuPendingRemoteStreamsByIdRef = useRef(new Map()); // streamId -> MediaStream

  // SFU stability/transition guards
  const sfuSwitchingRef = useRef(false); // true пока мягко переходим P2P -> SFU
  const sfuRetryCountRef = useRef(0);
  const sfuDisabledUntilRef = useRef(0); // timestamp ms
  const sfuJsonRpcUrlRef = useRef(null); // из /api/webrtc/config (http(s) URL)

  const captureTierRef = useRef('sd'); // 'sd' | 'hd'
  const ringtoneRef = useRef(null);
  const leaveSentRef = useRef(false);
  const callIdRef = useRef(callId);
  const localStreamRef = useRef(null); // Локальный поток - ОТДЕЛЬНО от remoteStreamsRef
  
  // Active speaker detection refs
  const audioContextRef = useRef(null);
  const analysersRef = useRef({}); // { userId: AnalyserNode }
  const activeSpeakerTimerRef = useRef(null);
  const lastActiveSpeakerRef = useRef(null);
  const lastMainUserIdRef = useRef(null);
  const mediaUnlockedRef = useRef(false);
  const pendingPlayElementsRef = useRef(new Set());
  const [capacityWarning, setCapacityWarning] = useState(null);

  // P2P: добавление ICE кандидатов откладываем до remoteDescription.
  const flushPendingP2pIceCandidates = useCallback(async (pc) => {
    if (!pc || pc.signalingState === 'closed') return;
    if (!pc.remoteDescription) return;
    const pending = p2pPendingCandidatesRef.current;
    if (!pending || pending.length === 0) return;

    const remaining = [];
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        if (err?.name === 'InvalidStateError') {
          remaining.push(candidate);
        } else {
          console.warn('[GroupCall] Failed to add ICE candidate, dropping:', err);
        }
      }
    }
    p2pPendingCandidatesRef.current = remaining;
  }, []);

  const tryPlayElement = useCallback((el) => {
    if (!el) return;
    try {
      const p = el.play?.();
      if (p && typeof p.catch === 'function') {
        p.catch((err) => {
          if (err?.name === 'NotAllowedError') {
            pendingPlayElementsRef.current.add(el);
          }
        });
      }
    } catch (e) {
      // no-op
    }
  }, []);

  const retryPendingPlays = useCallback(() => {
    const els = Array.from(pendingPlayElementsRef.current);
    pendingPlayElementsRef.current.clear();
    els.forEach((el) => tryPlayElement(el));
  }, [tryPlayElement]);

  // ВАЖНО: вызывать только из user gesture (Join/Accept/Start/клик по модалке),
  // иначе браузер может заблокировать resume/play.
  const unlockMediaPlayback = useCallback(async () => {
    mediaUnlockedRef.current = true;

    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        // no-op
      }
    }

    try {
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    } catch (e) {
      // Может быть заблокировано, если не из клика
    }

    // Пробуем «разбудить» все video/audio элементы на странице.
    try {
      document.querySelectorAll('video, audio').forEach((el) => tryPlayElement(el));
    } catch (e) {}

    retryPendingPlays();
  }, [retryPendingPlays, tryPlayElement]);

  const restartIceIfNeeded = useCallback(async (oderId) => {
    // iceRestart запрещён для этой реализации.
    // Оставлено как no-op для совместимости вызовов.
    void oderId;
  }, [socket]);

  // ===== UTILITY FUNCTIONS =====
  
  // Обновляем ref при изменении callId
  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);

  // Определение главного видео (pinned или active speaker)
  // ВАЖНО: возвращает userId ТОЛЬКО если у него есть реальный stream
  const getMainUserId = useCallback(() => {
    // LOCAL_PIN_ID означает "покажи локальное как главное".
    if (pinnedUserId === LOCAL_PIN_ID) {
      return null;
    }
    // Если закреплён пользователь И у него есть stream — показываем его
    if (pinnedUserId && remoteStreamsRef.current.has(pinnedUserId)) {
      return pinnedUserId;
    }
    // Раньше тут был auto-режим (active speaker). Теперь manual-only.
    // По умолчанию показываем локальное видео (null = local).
    return null;
  }, [pinnedUserId, activeSpeakerId, currentUserId]);

  // Установка bitrate для sender'а
  const setBitrate = useCallback(async (sender, maxBitrate, maxFramerate) => {
    const parameters = sender.getParameters();
    
    if (!parameters.encodings || parameters.encodings.length === 0) {
      parameters.encodings = [{}];
    }
    
    // Почему так: в mesh (группа) каждый аплинк умножается на N-1,
    // поэтому дефолтные битрейты должны быть консервативными, иначе
    // получаем "раскачку" (адаптация качества/пакетные потери/рост задержки).
    parameters.encodings[0].maxBitrate = maxBitrate * 1000; // kbps -> bps
    if (maxFramerate) {
      parameters.encodings[0].maxFramerate = maxFramerate;
    }

    // Не у всех браузеров поле поддерживается, поэтому в try/catch.
    try {
      parameters.degradationPreference = parameters.degradationPreference || 'balanced';
    } catch (e) {}
    
    try {
      await sender.setParameters(parameters);
    } catch (err) {
      console.warn('[GroupCall] Failed to set bitrate:', err);
    }
  }, []);

  const getVideoSender = useCallback((pc) => {
    try {
      return pc?.getSenders?.().find(s => s.track?.kind === 'video') || null;
    } catch (e) {
      return null;
    }
  }, []);

  const setSenderCapsIfChanged = useCallback(async (sender, nextKbps, nextFps) => {
    if (!sender) return;
    const params = sender.getParameters?.() || {};
    const current = params.encodings?.[0] || {};
    const currentKbps = typeof current.maxBitrate === 'number' ? Math.round(current.maxBitrate / 1000) : null;
    const currentFps = typeof current.maxFramerate === 'number' ? current.maxFramerate : null;

    // Не трогаем параметры слишком часто (Android/WebView может "дергаться").
    // Также избегаем микродрожания: меняем только при заметной разнице.
    const kbpsDelta = currentKbps === null ? 9999 : Math.abs(currentKbps - nextKbps);
    const fpsDelta = currentFps === null ? 9999 : Math.abs(currentFps - nextFps);
    if (kbpsDelta < 60 && fpsDelta < 1) return;

    await setBitrate(sender, nextKbps, nextFps);
  }, [setBitrate]);

  const applyCaptureTier = useCallback(async (tier) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const vt = stream.getVideoTracks?.()?.[0];
    if (!vt) return;

    // applyConstraints влияет на ВСЕ peer'ы сразу, потому что это один источник камеры.
    // Поэтому делаем это редко, с гистерезисом и только когда участников мало.
    try {
      if (tier === 'hd') {
        await vt.applyConstraints({
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 24, max: 30 }
        });
      } else {
        await vt.applyConstraints({
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 18, max: 24 }
        });
      }
      captureTierRef.current = tier;
      setCaptureTierUi(tier === 'hd' ? 'HD' : 'SD');
      console.log('[GroupCall] Capture tier applied:', tier);
    } catch (e) {
      // Некоторые девайсы/браузеры не дают менять constraints на лету.
      console.warn('[GroupCall] Failed to apply capture constraints:', e);
    }
  }, []);

  // Применение bitrate к PeerConnection
  const applyBitrateSettings = useCallback(async (pc, isMainVideo = false) => {
    const senders = pc.getSenders();
    
    for (const sender of senders) {
      if (sender.track?.kind === 'video') {
        if (isMainVideo) {
          // Главное видео: высокое качество
          await setBitrate(sender, 650, 18); // 0.65 Mbps, 18 fps
        } else {
          // Preview: низкое качество
          await setBitrate(sender, 250, 15); // 250 kbps, 15 fps
        }
      }
    }
  }, [setBitrate]);

  // ===== CAPTURE POLICY =====
  // Требование: для групп (SFU) целимся в HD 720p. Для P2P (<=2) держим SD по умолчанию.
  useEffect(() => {
    if (callType !== 'video') return;
    if (!localStreamRef.current) return;

    if (callModeRef.current === 'sfu') {
      applyCaptureTier('hd');
    } else {
      applyCaptureTier('sd');
    }
  }, [callType, callMode, applyCaptureTier]);

  // ===== ACTIVE SPEAKER DETECTION =====
  
  // Инициализация анализатора аудио для потока
  const setupAudioAnalyser = useCallback((stream, userId) => {
    // ВАЖНО: AudioContext создаём/резюмируем только после user gesture (Join/Accept).
    // Если не разблокировано — пропускаем (это влияет только на active speaker, НЕ на сам звук).
    if (!mediaUnlockedRef.current) return;
    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analysersRef.current[userId] = analyser;
    }
  }, []);

  // Подсчёт громкости (RMS)
  const getAudioVolume = useCallback((analyser) => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    return sum / dataArray.length;
  }, []);

  // Обновление активного говорящего (throttled)
  useEffect(() => {
    if (callStatus !== 'active') return;
    
    const interval = setInterval(() => {
      const volumes = {};
      
      // Проверяем локальное аудио
      if (analysersRef.current[currentUserId] && !isMuted) {
        volumes[currentUserId] = getAudioVolume(analysersRef.current[currentUserId]);
      }
      
      // Проверяем удалённые потоки
      Object.keys(analysersRef.current).forEach(userId => {
        if (userId !== currentUserId) {
          volumes[userId] = getAudioVolume(analysersRef.current[userId]);
        }
      });
      
      setAudioLevels(volumes);
      
      // Определяем самого громкого (порог > 20)
      let maxVolume = 20;
      let loudestUser = null;
      
      Object.entries(volumes).forEach(([userId, volume]) => {
        if (volume > maxVolume) {
          maxVolume = volume;
          loudestUser = userId;
        }
      });
      
      // Обновляем активного говорящего только если изменился
      if (loudestUser && loudestUser !== lastActiveSpeakerRef.current) {
        lastActiveSpeakerRef.current = loudestUser;
        setActiveSpeakerId(loudestUser);
      } else if (!loudestUser && lastActiveSpeakerRef.current) {
        // Сбрасываем через 2 секунды молчания
        clearTimeout(activeSpeakerTimerRef.current);
        activeSpeakerTimerRef.current = setTimeout(() => {
          lastActiveSpeakerRef.current = null;
          setActiveSpeakerId(null);
        }, 2000);
      }
    }, 400); // Обновление каждые 400ms
    
    return () => clearInterval(interval);
  }, [callStatus, currentUserId, isMuted, getAudioVolume]);

  // ===== ICE SERVERS =====
  
  const loadIceConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/webrtc/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      // best-effort: SFU конфиг приходит вместе с ICE
      try {
        sfuJsonRpcUrlRef.current = data?.sfu?.jsonRpcUrl || null;
      } catch (e) {
        sfuJsonRpcUrlRef.current = null;
      }

      const nextConfig = {
        iceServers: data.iceServers || [],
        iceCandidatePoolSize: typeof data.iceCandidatePoolSize === 'number' ? data.iceCandidatePoolSize : 10
      };

      iceConfigRef.current = nextConfig;
      iceReadyRef.current = true;
      setIceServers(nextConfig.iceServers);
      return nextConfig;
    } catch (err) {
      console.error('[GroupCall] Failed to fetch ICE servers:', err);

      // Fallback к публичным STUN серверам
      const fallback = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
      };
      iceConfigRef.current = fallback;
      iceReadyRef.current = true;
      setIceServers(fallback.iceServers);
      return fallback;
    }
  }, [token]);

  // Prefetch: не ждём join/start, подготавливаем TURN заранее.
  useEffect(() => {
    iceLoadPromiseRef.current = loadIceConfig();
  }, [loadIceConfig]);

  // Гарантируем, что ICE конфиг загружен до любых RTCPeerConnection.
  // Почему так: если создать PC с пустым iceServers, потом обновить state уже поздно —
  // connection стартует без TURN и часто даёт долгую установку/обрывы.
  const ensureIceConfig = useCallback(async () => {
    if (iceReadyRef.current) return iceConfigRef.current;
    if (!iceLoadPromiseRef.current) {
      iceLoadPromiseRef.current = loadIceConfig();
    }
    try {
      await iceLoadPromiseRef.current;
    } catch (e) {}
    return iceConfigRef.current;
  }, [loadIceConfig]);

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

  // ===== LOCAL STREAM =====

  // Надёжная привязка MediaStream к <video>.
  // Почему так: при переключении main/preview React размонтирует/монтирует video-элементы.
  // На некоторых браузерах (особенно Android WebView) одного autoPlay недостаточно —
  // видео остаётся "чёрным" пока явно не вызвать play() после назначения srcObject.
  const attachStreamToVideo = useCallback((videoEl, stream, { muted } = {}) => {
    if (!videoEl) return;

    if (typeof muted === 'boolean') {
      videoEl.muted = muted;
    }

    if (videoEl.srcObject !== stream) {
      videoEl.srcObject = stream || null;
    }

    // Принудительно запускаем воспроизведение. Ошибки игнорируем (autoplay policy).
    const safePlay = () => {
      tryPlayElement(videoEl);
    };

    if (!stream) return;

    // Если метаданные уже готовы — можно сразу.
    if (videoEl.readyState >= 1) {
      safePlay();
      return;
    }

    // Иначе ждём метаданные (это часто и есть причина "чёрного" кадра после swap).
    const prevHandler = videoEl.onloadedmetadata;
    videoEl.onloadedmetadata = (ev) => {
      try {
        if (typeof prevHandler === 'function') prevHandler(ev);
      } catch (e) {}
      safePlay();
    };
  }, [tryPlayElement]);
  
  // Получение локального медиа-потока
  const getLocalStream = useCallback(async () => {
    // Требование: localStream получать ОДИН РАЗ.
    if (localStreamRef.current) {
      const stream = localStreamRef.current;
      setLocalStream(stream);
      attachStreamToVideo(localVideoRef.current, stream, { muted: true });
      attachStreamToVideo(localPreviewVideoRef.current, stream, { muted: true });
      return stream;
    }

    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: callType === 'video' ? { 
          // Требование: дефолт 640x480 + сниженная частота кадров для меньшей задержки.
          // Почему так: в mesh каждый участник отправляет видео всем — лишние пиксели/FPS
          // дают рост jitter/latency и деградацию у всех.
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 20, max: 24 },
          facingMode: 'user'
        } : false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Мы стартуем в SD по умолчанию (видео захват уже SD, но пусть UI тоже это отражает).
      setCaptureTierUi('SD');

      // Подсказка кодеку/браузеру: для чата обычно важнее плавность движения,
      // чем идеальная детализация. Не везде поддерживается.
      try {
        const vt = stream.getVideoTracks?.()?.[0];
        if (vt && 'contentHint' in vt) {
          vt.contentHint = 'motion';
        }
      } catch (e) {}

      setLocalStream(stream);
      localStreamRef.current = stream;
      
      // Настраиваем анализатор для локального аудио
      setupAudioAnalyser(stream, currentUserId);
      
      // Привязываем к ОБОИМ video refs (main и preview) + гарантируем play().
      attachStreamToVideo(localVideoRef.current, stream, { muted: true });
      attachStreamToVideo(localPreviewVideoRef.current, stream, { muted: true });
      
      return stream;
    } catch (err) {
      console.error('[GroupCall] Failed to get local stream:', err);
      alert('Не удалось получить доступ к камере/микрофону');
      return null;
    }
  }, [callType, currentUserId, setupAudioAnalyser, attachStreamToVideo]);

  // Синхронизация localStream с video refs при изменении layout
  useEffect(() => {
    const streamToShow = localStream;
    if (streamToShow) {
      // ВАЖНО: не проверяем "!srcObject".
      // После swap может остаться старый srcObject или paused state —
      // поэтому каждый раз переустанавливаем и вызываем play().
      attachStreamToVideo(localVideoRef.current, streamToShow, { muted: true });
      attachStreamToVideo(localPreviewVideoRef.current, streamToShow, { muted: true });
    }
  }, [localStream, streamUpdateCounter, pinnedUserId, attachStreamToVideo]);

  // ===== PEER CONNECTION =====

  // Perfect Negotiation roles:
  // - polite: уступает при offer collision (glare)
  // - initiator: только одна сторона пары шлёт initial offer
  const isPolitePeer = useCallback((remoteUserId) => {
    if (!currentUserId || !remoteUserId) return true;
    return String(currentUserId).localeCompare(String(remoteUserId)) < 0;
  }, [currentUserId]);

  const shouldInitiateOffer = useCallback((remoteUserId) => {
    if (!currentUserId || !remoteUserId) return false;
    // Только одна сторона пары должна инициировать initial offer.
    // При polite = current < remote, инициатором будет сторона current > remote.
    return String(currentUserId).localeCompare(String(remoteUserId)) > 0;
  }, [currentUserId]);

  const setMode = useCallback((nextMode) => {
    callModeRef.current = nextMode;
    setCallMode(nextMode);
  }, []);

  const clearRemoteMedia = useCallback(() => {
    remoteStreamsRef.current = new Map();
    analysersRef.current = {};
    setStreamUpdateCounter((v) => v + 1);
  }, []);

  const closeP2p = useCallback(() => {
    try {
      p2pPcRef.current?.close?.();
    } catch (e) {}
    p2pPcRef.current = null;
    p2pPeerIdRef.current = null;
    p2pPendingCandidatesRef.current = [];
    p2pMetaRef.current = { isMakingOffer: false, ignoreOffer: false, isPolite: true, shouldInitiate: false };
  }, []);

  const closeSfu = useCallback(() => {
    try {
      sfuClientRef.current?.close?.();
    } catch (e) {}
    try {
      sfuSignalRef.current?.close?.();
    } catch (e) {}
    sfuClientRef.current = null;
    sfuSignalRef.current = null;
    sfuPublishedLocalStreamIdRef.current = null;
    sfuRemoteStreamIdToUserIdRef.current = new Map();
    sfuPendingRemoteStreamsByIdRef.current = new Map();
  }, []);

  const getSfuWsUrl = useCallback(() => {
    // ВАЖНО: никаких ws:// на HTTPS и никакого :7000 из браузера.
    // SFU доступен только через nginx WSS proxy: /sfu/ws
    const sfuWsUrl =
      `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://` +
      `${window.location.host}/sfu/ws`;
    return sfuWsUrl;
  }, []);

  const attachIncomingTrackToUser = useCallback((userId, track) => {
    if (!userId || userId === currentUserId) return;
    if (!track) return;

    let remoteStream = remoteStreamsRef.current.get(userId);
    if (!remoteStream) {
      remoteStream = new MediaStream();
      remoteStreamsRef.current.set(userId, remoteStream);
    }

    const existingTrack = remoteStream.getTracks().find((t) => t.id === track.id);
    if (!existingTrack) {
      remoteStream.addTrack(track);
    }

    if (track.kind === 'audio' && !analysersRef.current[userId]) {
      setupAudioAnalyser(remoteStream, userId);
    }

    setStreamUpdateCounter((v) => v + 1);
  }, [currentUserId, setupAudioAnalyser]);

  const connectP2pIfReady = useCallback(async (peerId) => {
    if (!peerId || peerId === currentUserId) return;
    if (!localStreamRef.current) return;

    await ensureIceConfig();

    // Уже подключены
    if (p2pPcRef.current && p2pPeerIdRef.current === peerId) return;

    // Если был другой peer — закрываем и пересоздаём
    if (p2pPcRef.current && p2pPeerIdRef.current && p2pPeerIdRef.current !== peerId) {
      closeP2p();
      clearRemoteMedia();
    }

    p2pPeerIdRef.current = peerId;
    p2pMetaRef.current.isPolite = isPolitePeer(peerId);
    p2pMetaRef.current.shouldInitiate = shouldInitiateOffer(peerId);

    const cfg = iceConfigRef.current || { iceServers: iceServers || [], iceCandidatePoolSize: 10 };
    const pc = new RTCPeerConnection({
      iceServers: cfg.iceServers || [],
      iceCandidatePoolSize: typeof cfg.iceCandidatePoolSize === 'number' ? cfg.iceCandidatePoolSize : 10
    });
    p2pPcRef.current = pc;

    const local = localStreamRef.current;
    (local?.getAudioTracks?.() || []).forEach((t) => {
      try { pc.addTrack(t, local); } catch (e) {}
    });
    if (callType === 'video') {
      const vt = local?.getVideoTracks?.()?.[0];
      if (vt) {
        try { pc.addTrack(vt, local); } catch (e) {}
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('group-call:signal', {
          callId: callIdRef.current,
          oderId: peerId,
          signal: { type: 'ice-candidate', candidate: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      attachIncomingTrackToUser(peerId, event.track);
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      console.log('[GroupCall][P2P] connectionState:', st);
    };

    pc.onnegotiationneeded = async () => {
      const meta = p2pMetaRef.current;
      if (!meta.shouldInitiate) return;
      if (pc.signalingState !== 'stable') return;
      try {
        meta.isMakingOffer = true;
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        socket.emit('group-call:signal', {
          callId: callIdRef.current,
          oderId: peerId,
          signal: { type: 'offer', sdp: pc.localDescription }
        });
      } catch (err) {
        console.warn('[GroupCall][P2P] negotiationneeded failed:', err);
      } finally {
        meta.isMakingOffer = false;
      }
    };

    // Немного поджимаем битрейт в P2P (не обязателен, но помогает на LTE)
    setTimeout(() => applyBitrateSettings(pc, true), 150);
  }, [applyBitrateSettings, attachIncomingTrackToUser, callType, clearRemoteMedia, closeP2p, currentUserId, ensureIceConfig, iceServers, isPolitePeer, shouldInitiateOffer, socket]);

  const handleP2pSignal = useCallback(async ({ fromUserId, signal }) => {
    if (callModeRef.current !== 'p2p') return;
    if (!fromUserId || !signal) return;

    // Принимаем сигналы только от текущего peer
    const peerId = p2pPeerIdRef.current || fromUserId;
    if (peerId !== fromUserId) return;

    await connectP2pIfReady(peerId);
    const pc = p2pPcRef.current;
    if (!pc) return;

    if (signal.type === 'offer' || signal.type === 'answer') {
      try {
        const description = signal.sdp;
        const isOffer = description?.type === 'offer';
        const meta = p2pMetaRef.current;
        const offerCollision = isOffer && (meta.isMakingOffer || pc.signalingState !== 'stable');
        meta.ignoreOffer = !meta.isPolite && offerCollision;
        if (meta.ignoreOffer) {
          console.log('[GroupCall][P2P] Ignoring offer (glare) from:', fromUserId);
          return;
        }

        if (offerCollision) {
          try { await pc.setLocalDescription({ type: 'rollback' }); } catch (e) {}
        }

        await pc.setRemoteDescription(new RTCSessionDescription(description));
        await flushPendingP2pIceCandidates(pc);

        if (isOffer) {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('group-call:signal', {
            callId: callIdRef.current,
            oderId: fromUserId,
            signal: { type: 'answer', sdp: pc.localDescription }
          });
        }
      } catch (err) {
        console.error('[GroupCall][P2P] Error handling description:', err);
      }
      return;
    }

    if (signal.type === 'ice-candidate') {
      p2pPendingCandidatesRef.current.push(signal.candidate);
      if (pc.remoteDescription) {
        await flushPendingP2pIceCandidates(pc);
      }
    }
  }, [connectP2pIfReady, flushPendingP2pIceCandidates, socket]);

  const connectSfuIfReady = useCallback(async () => {
    if (!localStreamRef.current) return;
    await ensureIceConfig();

    if (sfuClientRef.current) return;

    const sfuWsUrl = getSfuWsUrl();
    console.info('[SFU] Connecting via', sfuWsUrl);

    const cfg = iceConfigRef.current || { iceServers: iceServers || [] };
    const signal = new IonSFUJSONRPCSignal(sfuWsUrl);
    const client = new Client(signal, {
      codec: 'vp8',
      iceServers: cfg.iceServers || [],
      // явная привязка для отладки (signal использует это значение)
      sfuWsUrl
    });

    sfuSignalRef.current = signal;
    sfuClientRef.current = client;

    client.ontrack = (track, stream) => {
      const streamId = stream?.id;
      if (!streamId) return;

      const mappedUserId = sfuRemoteStreamIdToUserIdRef.current.get(streamId);
      if (mappedUserId) {
        attachIncomingTrackToUser(mappedUserId, track);
      } else {
        // Сохраняем до прихода mapping по socket.io
        sfuPendingRemoteStreamsByIdRef.current.set(streamId, stream);
      }
    };

    signal.onopen = async () => {
      try {
        await client.join(String(callIdRef.current), String(currentUserId));

        if (callType === 'video') {
          // Для SFU требуем HD 720p
          await applyCaptureTier('hd');
        }

        const localIon = new LocalStream(localStreamRef.current, {
          codec: 'vp8',
          resolution: 'hd',
          simulcast: true,
          audio: true,
          video: callType === 'video'
        });

        client.publish(localIon);

        sfuPublishedLocalStreamIdRef.current = localIon.id;

        // Сообщаем всем streamId → userId mapping
        socket.emit('group-call:sfu-stream', {
          callId: callIdRef.current,
          streamId: localIon.id
        });
      } catch (e) {
        console.error('[GroupCall][SFU] join/publish failed:', e);
        setCapacityWarning('Ошибка подключения к SFU');
      }
    };

    signal.onerror = (e) => {
      console.error('[GroupCall][SFU] WebSocket error:', e);
      setCapacityWarning('Ошибка WebSocket (SFU)');
    };

    signal.onclose = () => {
      if (callModeRef.current !== 'sfu') return;
      console.warn('[GroupCall][SFU] WebSocket closed');
      setCapacityWarning('SFU отключён, пробуем переподключиться...');
      // best-effort reconnect: чистим и пробуем снова
      closeSfu();
      setTimeout(() => {
        if (callModeRef.current === 'sfu' && callStatus === 'active') {
          connectSfuIfReady();
        }
      }, 1500);
    };
  }, [applyCaptureTier, attachIncomingTrackToUser, callStatus, callType, closeSfu, currentUserId, ensureIceConfig, getSfuWsUrl, iceServers, socket]);

  const switchModeIfNeeded = useCallback(async (desiredMode) => {
    const next = desiredMode === 'sfu' ? 'sfu' : 'p2p';
    if (callModeRef.current === next) return;

    // Закрываем старый транспорт
    if (callModeRef.current === 'sfu') {
      closeSfu();
    } else {
      closeP2p();
    }

    clearRemoteMedia();
    setCapacityWarning(null);
    setMode(next);

    // Подключаем новый
    if (next === 'sfu') {
      await connectSfuIfReady();
    } else {
      // P2P: peer будет назначен из participants (см. socket handlers)
    }
  }, [clearRemoteMedia, closeP2p, closeSfu, connectSfuIfReady, setMode]);

  // Присоединение к звонку
  const joinCall = useCallback(async ({ unlock = false } = {}) => {
    setCallStatus('connecting');

    // ВАЖНО: unlock делаем только из user gesture (кнопка Join/Accept).
    if (unlock) {
      await unlockMediaPlayback();
    }

    // ВАЖНО: ICE конфиг грузим ДО любого signaling/PeerConnection.
    await ensureIceConfig();
    
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

      const existingCount = Array.isArray(response.participants) ? response.participants.length : 0;
      setCapacityWarning(null);

      // ВАЖНО: заполняем participants существующими участниками, иначе поздно вошедший
      // будет видеть только себя (streams приходят, но не рендерятся без метаданных).
      if (response.participants && response.participants.length > 0) {
        setParticipants(prev => {
          const merged = [...prev];
          response.participants.forEach(p => {
            if (!p?.oderId || p.oderId === currentUserId) return;
            if (!merged.find(x => x.oderId === p.oderId)) {
              merged.push({ oderId: p.oderId, userName: p.userName || 'Участник' });
            }
          });
          return merged;
        });
      }

      // Выбор режима: <=2 => P2P, 3+ => SFU
      const total = existingCount + 1;
      const desiredMode = total > 2 ? 'sfu' : 'p2p';
      switchModeIfNeeded(desiredMode)
        .then(async () => {
          if (desiredMode === 'p2p') {
            // Если в комнате ровно 2 участника — подключаемся к единственному peer
            const peerId = response.participants?.[0]?.oderId;
            if (peerId) await connectP2pIfReady(peerId);
          }
        })
        .catch((e) => console.error('[GroupCall] switchMode failed:', e));
    });
  }, [getLocalStream, socket, chatId, currentUserId, onClose, ensureIceConfig, unlockMediaPlayback, switchModeIfNeeded, connectP2pIfReady]);

  // Начало звонка (для инициатора)
  const startCall = useCallback(async () => {
    setCallStatus('connecting');

    // Инициатор тоже должен иметь ICE конфиг заранее.
    await ensureIceConfig();

    const stream = await getLocalStream();
    if (!stream) {
      onClose();
      return;
    }

    // Инициатор стартует в P2P-режиме по умолчанию.
    // Если позже присоединится 3-й участник — переключим на SFU в socket handlers.
    setMode('p2p');

    setCallStatus('active');
    onJoin?.();
  }, [getLocalStream, onClose, onJoin, ensureIceConfig, setMode]);

  // Автоматический запуск для не-входящих звонков
  useEffect(() => {
    if (isIncoming) return;
    if (callStatus !== 'connecting') return;

    // ВАЖНО: join и start — это разные сценарии.
    // - startCall(): только локальный поток (инициатор уже "в звонке" логически)
    // - joinCall(): ОБЯЗАТЕЛЬНО делает socket.emit('group-call:join') и получает participants
    // Если пропустить joinCall (как было раньше в кейсе already_active), пользователь окажется один.
    if (autoJoin) {
      joinCall();
    } else {
      startCall();
    }
  }, [isIncoming, callStatus, startCall, joinCall, autoJoin]);

  // ===== CLEANUP =====
  // ВАЖНО: cleanup должен быть объявлен ДО useEffect/socket handlers.
  // Иначе ссылка на cleanup в dependency array попадает в TDZ и в production build падает
  // с ошибкой вида: "Cannot access '<minified>' before initialization".
  const cleanup = useCallback(() => {
    // ВАЖНО: по требованиям НЕ трогаем tracks (stop/remove/replace) —
    // просто закрываем PC и очищаем ссылки.
    localStreamRef.current = null;

    // Закрываем P2P/SFU транспорты
    closeP2p();
    closeSfu();

    // Демонстрация экрана: остановим отдельный track (локальную камеру не трогаем)
    try {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    } catch (e) {}
    screenStreamRef.current = null;
    screenTrackRef.current = null;
    setIsScreenSharing(false);
    
    // Очищаем все remote streams (без stop())
    remoteStreamsRef.current = new Map();

    // Очищаем audio analysers
    analysersRef.current = {};
    
    // Закрываем AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Останавливаем рингтон
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current = null;
    }
    
    // Очищаем таймеры
    if (activeSpeakerTimerRef.current) {
      clearTimeout(activeSpeakerTimerRef.current);
    }
  }, [closeP2p, closeSfu]);

  // держим ref с последним participants для расчёта количества в socket handlers
  const participantsRef = useRef([]);
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  // screen share refs (только для getDisplayMedia)
  const screenStreamRef = useRef(null);
  const screenTrackRef = useRef(null);

  // Socket обработчики
  useEffect(() => {
    if (!socket) return;

    // Новый участник присоединился
    const handleParticipantJoined = ({ oderId, userName }) => {
      console.log('[GroupCall] Participant joined:', oderId, userName);
      if (oderId !== currentUserId) {
        // Добавляем в participants ТОЛЬКО метаданные (БЕЗ stream)
        // Stream будет получен через ontrack
        setParticipants(prev => {
          if (!prev.find(p => p.oderId === oderId)) {
            return [...prev, { oderId, userName }];
          }
          return prev;
        });

        const already = participantsRef.current.some((p) => p?.oderId === oderId);
        const nextTotal = (already ? participantsRef.current.length : participantsRef.current.length + 1) + 1;
        const desiredMode = nextTotal > 2 ? 'sfu' : 'p2p';
        switchModeIfNeeded(desiredMode)
          .then(async () => {
            if (desiredMode === 'p2p' && nextTotal === 2) {
              await connectP2pIfReady(oderId);
            }
          })
          .catch((e) => console.error('[GroupCall] switchMode failed:', e));
      }
    };

    // Участник покинул звонок
    const handleParticipantLeft = ({ oderId }) => {
      console.log('[GroupCall] Participant left:', oderId);

      // Если P2P и ушёл текущий peer — закрываем PC
      if (callModeRef.current === 'p2p' && p2pPeerIdRef.current === oderId) {
        closeP2p();
      }
      
      // Удаляем stream
      const stream = remoteStreamsRef.current.get(oderId);
      if (stream) {
        remoteStreamsRef.current.delete(oderId);
      }
      
      // Удаляем audio analyser
      delete analysersRef.current[oderId];
      
      // Удаляем из участников
      setParticipants(prev => prev.filter(p => p.oderId !== oderId));
      
      // Trigger ререндер
      setStreamUpdateCounter(prev => prev + 1);
      
      // Сбрасываем pinned если это был он
      if (pinnedUserId === oderId) {
        setPinnedUserId(LOCAL_PIN_ID);
      }

      // Пересчёт режима: если осталось <=2 — возвращаемся в P2P
      const prevLen = participantsRef.current.length;
      const nextLen = Math.max(0, prevLen - 1);
      const nextTotal = nextLen + 1;
      const desiredMode = nextTotal > 2 ? 'sfu' : 'p2p';
      switchModeIfNeeded(desiredMode)
        .then(async () => {
          if (desiredMode === 'p2p' && nextTotal === 2) {
            // найдём оставшегося peer
            const remaining = participantsRef.current.filter((p) => p?.oderId && p.oderId !== oderId);
            const peerId = remaining?.[0]?.oderId;
            if (peerId) await connectP2pIfReady(peerId);
          }
        })
        .catch((e) => console.error('[GroupCall] switchMode failed:', e));
    };

    // Входящий сигнал
    const handleIncomingSignal = (data) => {
      if (data.callId === callIdRef.current) {
        handleP2pSignal(data);
      }
    };

    const handleSfuStreamMapping = ({ callId: cid, userId, streamId }) => {
      if (!cid || cid !== callIdRef.current) return;
      if (!userId || !streamId) return;

      sfuRemoteStreamIdToUserIdRef.current.set(String(streamId), String(userId));

      const pending = sfuPendingRemoteStreamsByIdRef.current.get(String(streamId));
      if (pending) {
        try {
          pending.getTracks().forEach((t) => attachIncomingTrackToUser(String(userId), t));
        } catch (e) {}
        sfuPendingRemoteStreamsByIdRef.current.delete(String(streamId));
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
    socket.on('group-call:sfu-stream', handleSfuStreamMapping);
    socket.on('group-call:ended', handleCallEnded);

    return () => {
      socket.off('group-call:participant-joined', handleParticipantJoined);
      socket.off('group-call:participant-left', handleParticipantLeft);
      socket.off('group-call:signal', handleIncomingSignal);
      socket.off('group-call:sfu-stream', handleSfuStreamMapping);
      socket.off('group-call:ended', handleCallEnded);
    };
  }, [socket, currentUserId, handleP2pSignal, onClose, cleanup, pinnedUserId, switchModeIfNeeded, connectP2pIfReady, attachIncomingTrackToUser, closeP2p]);

  // Завершение звонка
  const handleEndCall = useCallback(() => {
    if (!leaveSentRef.current) {
      leaveSentRef.current = true;
      socket.emit('group-call:leave', { callId: callIdRef.current });
    }
    cleanup();
    onClose();
  }, [socket, cleanup, onClose]);

  // Если модалка закрывается/размонтируется не через кнопку "Выйти",
  // всё равно сообщаем серверу что пользователь покинул звонок.
  useEffect(() => {
    return () => {
      try {
        const cid = callIdRef.current;
        if (!cid) return;
        if (leaveSentRef.current) return;

        // Шлём leave только если реально были в процессе звонка
        // (иначе при неудачном getUserMedia будет лишний запрос, но он безопасен).
        leaveSentRef.current = true;
        socket.emit('group-call:leave', { callId: cid });
      } catch (e) {
        // no-op
      }
    };
  }, [socket]);

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
    // В режиме шаринга: управляем track демонстрации (без renegotiation)
    if (isScreenSharing && screenTrackRef.current) {
      const track = screenTrackRef.current;
      track.enabled = !track.enabled;
      setIsVideoOff(!track.enabled);
      return;
    }

    // Обычная камера
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, [isScreenSharing]);

  const getOutboundVideoSender = useCallback(() => {
    try {
      if (callModeRef.current === 'sfu') {
        const transports = sfuClientRef.current?.transports;
        const pub = transports?.[0] || transports?.pub;
        const pc = pub?.pc;
        return pc?.getSenders?.().find((s) => s.track?.kind === 'video') || null;
      }
      const pc = p2pPcRef.current;
      return pc?.getSenders?.().find((s) => s.track?.kind === 'video') || null;
    } catch (e) {
      return null;
    }
  }, []);

  const stopScreenShare = useCallback(async () => {
    if (!isScreenSharing) return;
    try {
      const cameraTrack = localStreamRef.current?.getVideoTracks?.()?.[0] || null;
      const sender = getOutboundVideoSender();
      if (sender && cameraTrack) {
        await sender.replaceTrack(cameraTrack);
      }
    } catch (e) {
      console.warn('[GroupCall] stopScreenShare replaceTrack failed:', e);
    }

    try {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    } catch (e) {}

    screenStreamRef.current = null;
    screenTrackRef.current = null;
    setIsScreenSharing(false);

    // возвращаем превью на камеру
    if (localStreamRef.current) {
      attachStreamToVideo(localVideoRef.current, localStreamRef.current, { muted: true });
      attachStreamToVideo(localPreviewVideoRef.current, localStreamRef.current, { muted: true });
    }
  }, [attachStreamToVideo, getOutboundVideoSender, isScreenSharing]);

  const startScreenShare = useCallback(async () => {
    if (callType !== 'video') return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert('Демонстрация экрана не поддерживается в этом браузере');
      return;
    }
    if (isScreenSharing) return;

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } },
        audio: false
      });
      const screenTrack = displayStream.getVideoTracks?.()?.[0];
      if (!screenTrack) return;

      screenStreamRef.current = displayStream;
      screenTrackRef.current = screenTrack;

      const sender = getOutboundVideoSender();
      if (sender) {
        await sender.replaceTrack(screenTrack);
      }

      // self-view: показываем шаринг как локальный превью
      attachStreamToVideo(localVideoRef.current, displayStream, { muted: true });
      attachStreamToVideo(localPreviewVideoRef.current, displayStream, { muted: true });

      setIsScreenSharing(true);
      setIsVideoOff(false);

      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (e) {
      console.error('[GroupCall] startScreenShare failed:', e);
    }
  }, [attachStreamToVideo, callType, getOutboundVideoSender, isScreenSharing, stopScreenShare]);

  // Cleanup при unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // ===== RENDER =====

  // Получаем список remote участников с РЕАЛЬНЫМИ стримами
  // useMemo + streamUpdateCounter для ререндера при обновлении стримов
  // ВАЖНО: этот hook должен вызываться всегда (иначе React #310 при смене callStatus)
  const remoteParticipantsWithStreams = useMemo(() => {
    // Триггер зависимости от streamUpdateCounter (не используется напрямую)
    void streamUpdateCounter;

    return participants
      .filter(p => p.oderId !== currentUserId)
      .map(p => ({
        ...p,
        stream: remoteStreamsRef.current.get(p.oderId) || null,
        hasStream: remoteStreamsRef.current.has(p.oderId)
      }));
  }, [participants, currentUserId, streamUpdateCounter]);

  // Определяем главного участника (ТОЛЬКО если есть реальный stream)
  const mainUserId = getMainUserId();
  const mainRemoteStream = mainUserId ? remoteStreamsRef.current.get(mainUserId) : null;
  const mainParticipant = mainUserId
    ? remoteParticipantsWithStreams.find(p => p.oderId === mainUserId)
    : null;
  const isLocalMain = mainUserId === null; // Если null - показываем локальное видео

  // Все remote участники для preview strip (кроме главного)
  const remotePreviewParticipants = remoteParticipantsWithStreams.filter(p => p.oderId !== mainUserId);

  // Формируем preview list
  // Если локальное видео главное - показываем только remote в превью
  // Если remote главное - добавляем локальное видео в превью
  const showLocalInPreview = !isLocalMain && localStream;

  // Общее количество участников (для UI)
  const totalParticipants = remoteParticipantsWithStreams.filter(p => p.hasStream).length + 1;
  
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
            <button onClick={() => joinCall({ unlock: true })} style={styles.acceptBtn}>
              <span>{callType === 'video' ? '🎥' : '📞'}</span>
              <span style={styles.btnLabel}>Присоединиться</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== DISCORD-LIKE LAYOUT =====

  // Рендер активного звонка (Discord UX)
  return (
    <div
      style={styles.overlay}
      onMouseDown={() => {
        if (!mediaUnlockedRef.current) {
          // best-effort unlock on any user interaction
          unlockMediaPlayback();
        }
      }}
    >
      <div style={styles.modal}>
        {/* Заголовок */}
        <div style={styles.header}>
          <div style={styles.headerInfo}>
            <span style={styles.headerIcon}>👥</span>
            <div>
              <h3 style={styles.chatName}>{chatName}</h3>
              <p style={styles.participantCount}>
                {totalParticipants} участник(ов)
              </p>
            </div>
          </div>
          <div style={styles.headerRight}>
            {capacityWarning && (
              <div style={styles.capacityWarning} title={capacityWarning}>
                {capacityWarning}
              </div>
            )}
            {/* SD/HD индикатор текущего capture tier */}
            <div
              style={{
                ...styles.qualityPill,
                ...(captureTierUi === 'HD' ? styles.qualityPillHd : styles.qualityPillSd)
              }}
              title={
                captureTierUi === 'HD'
                  ? 'Камера в HD (авто по stats)'
                  : 'Камера в SD (авто по stats)'
              }
            >
              {captureTierUi}
            </div>
            <div style={styles.callStatus}>
              {callStatus === 'connecting' ? '🔄 Подключение...' : '🟢 В звонке'}
            </div>
          </div>
        </div>

        {/* MAIN VIDEO - Главное видео (60-75% экрана) */}
        <div style={styles.mainVideoContainer}>
          {isLocalMain ? (
            // Локальное видео как главное (ВСЕГДА показываем, если мы одни или выбраны)
            <div style={styles.mainVideoWrapper}>
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  ...styles.mainVideo,
                  ...(isVideoOff ? styles.videoHidden : {})
                }}
              />
              {isVideoOff && (
                <div style={styles.mainVideoPlaceholder}>
                  <span style={styles.mainVideoAvatar}>👤</span>
                  <p style={styles.mainVideoName}>Вы</p>
                </div>
              )}
              <div style={styles.mainVideoLabel}>Вы</div>
              {isMuted && <div style={styles.mainMutedIndicator}>🔇</div>}
            </div>
          ) : mainRemoteStream && mainParticipant ? (
            // Удалённое видео как главное (ТОЛЬКО если есть реальный stream)
            <div 
              style={{
                ...styles.mainVideoWrapper,
                ...(mainParticipant.oderId === activeSpeakerId ? styles.activeSpeaker : {})
              }}
            >
              <MainVideoPlayer 
                stream={mainRemoteStream} 
                ref={mainVideoRef}
              />
              <div style={styles.mainVideoLabel}>
                {mainParticipant.userName || 'Участник'}
                {mainParticipant.oderId === pinnedUserId && ' 📌'}
              </div>
              {mainParticipant.oderId === activeSpeakerId && (
                <div style={styles.activeSpeakerBorder} />
              )}
              {/* Кнопка открепления */}
              {pinnedUserId === mainParticipant.oderId && (
                <button 
                  onClick={() => setPinnedUserId(LOCAL_PIN_ID)}
                  style={styles.unpinBtn}
                  title="Открепить"
                >
                  ✕
                </button>
              )}
            </div>
          ) : (
            // Fallback: показываем локальное видео если remote недоступен
            <div style={styles.mainVideoWrapper}>
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  ...styles.mainVideo,
                  ...(isVideoOff ? styles.videoHidden : {})
                }}
              />
              {isVideoOff && (
                <div style={styles.mainVideoPlaceholder}>
                  <span style={styles.mainVideoAvatar}>👤</span>
                  <p style={styles.mainVideoName}>Вы</p>
                </div>
              )}
              <div style={styles.mainVideoLabel}>Вы</div>
              {isMuted && <div style={styles.mainMutedIndicator}>🔇</div>}
            </div>
          )}
        </div>

        {/* PREVIEW STRIP - Горизонтальная лента превью */}
        {(showLocalInPreview || remotePreviewParticipants.length > 0) && (
          <div style={styles.previewStrip}>
            <div style={styles.previewScrollContainer}>
              {/* Локальное видео в preview (если remote на главном экране) */}
              {showLocalInPreview && (
                <div
                  key="local-preview"
                  style={{
                    ...styles.previewItem,
                    ...(currentUserId === activeSpeakerId ? styles.previewItemActive : {})
                  }}
                  onClick={() => setPinnedUserId(LOCAL_PIN_ID)} // закрепляем локальное как main
                  title="Нажмите, чтобы показать своё видео"
                >
                  <video
                    ref={localPreviewVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      ...styles.previewVideo,
                      ...(isVideoOff ? styles.videoHidden : {})
                    }}
                  />
                  {isVideoOff && (
                    <div style={styles.previewPlaceholder}>
                      <span>👤</span>
                    </div>
                  )}
                  <div style={styles.previewLabel}>Вы</div>
                  {isMuted && <div style={styles.previewMuted}>🔇</div>}
                  {currentUserId === activeSpeakerId && <div style={styles.previewActiveBorder} />}
                </div>
              )}
              
              {/* Remote участники в preview */}
              {remotePreviewParticipants.map((participant) => {
                const isActive = participant.oderId === activeSpeakerId;
                const volume = audioLevels[participant.oderId] || 0;
                
                return (
                  <div
                    key={participant.oderId}
                    style={{
                      ...styles.previewItem,
                      ...(isActive ? styles.previewItemActive : {})
                    }}
                    // "Swap" механика: клик по плитке делает её main.
                    onClick={() => setPinnedUserId(participant.oderId)}
                    title="Нажмите, чтобы закрепить"
                  >
                    {/* Показываем видео ТОЛЬКО если есть реальный stream */}
                    {participant.hasStream && participant.stream ? (
                      <PreviewVideoPlayer stream={participant.stream} />
                    ) : (
                      <div style={styles.previewPlaceholder}>
                        <span>👤</span>
                        <small style={styles.connectingText}>⏳</small>
                      </div>
                    )}
                    <div style={styles.previewLabel}>
                      {participant.userName || 'Участник'}
                    </div>
                    {/* Индикатор громкости */}
                    {volume > 20 && (
                      <div style={styles.volumeIndicator}>🔊</div>
                    )}
                    {/* Визуальная рамка active speaker */}
                    {isActive && <div style={styles.previewActiveBorder} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
              onClick={isScreenSharing ? stopScreenShare : startScreenShare}
              style={{
                ...styles.controlBtn,
                ...styles.controlBtnScreen,
                ...(isScreenSharing ? styles.controlBtnActive : {})
              }}
              title={isScreenSharing ? 'Остановить демонстрацию экрана' : 'Демонстрация экрана'}
            >
              {isScreenSharing ? '🛑' : '🖥️'}
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

// ===== VIDEO PLAYER COMPONENTS =====

// Главное видео (высокое качество)
const MainVideoPlayer = React.forwardRef(({ stream }, forwardedRef) => {
  const innerRef = useRef(null);

  const setRef = useCallback((node) => {
    innerRef.current = node;
    if (!forwardedRef) return;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else forwardedRef.current = node;
  }, [forwardedRef]);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    // ВАЖНО: для удалённых stream НЕЛЬЗЯ ставить muted,
    // иначе звук у всех участников пропадёт полностью.
    el.srcObject = stream || null;

    // Autoplay с аудио требует жеста пользователя. Join/Start — это клик,
    // но на некоторых WebView всё равно полезно явно дёрнуть play().
    const p = el.play?.();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, [stream]);

  return (
    <video
      ref={setRef}
      autoPlay
      playsInline
      style={styles.mainVideo}
    />
  );
});

// Preview видео (низкое качество)
function PreviewVideoPlayer({ stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    // Preview тоже должен воспроизводить аудио (каждый участник слышен независимо от того,
    // в main он или в preview). Локальные элементы остаются muted в основном рендере.
    el.srcObject = stream || null;
    const p = el.play?.();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      style={styles.previewVideo}
    />
  );
}

// ===== STYLES (Discord-like) =====
// ===== STYLES (Discord-like) =====

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
    height: '100%',
    maxWidth: '1920px',
    maxHeight: '1080px',
    background: '#1e1e1e',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    margin: '16px',
  },
  header: {
    padding: '12px 20px',
    background: '#0f0f0f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #2a2a2a',
    flexShrink: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  capacityWarning: {
    padding: '4px 10px',
    borderRadius: '999px',
    background: 'rgba(245, 158, 11, 0.12)',
    color: '#fbbf24',
    border: '1px solid rgba(245, 158, 11, 0.35)',
    fontSize: '12px',
    fontWeight: 700,
    maxWidth: '360px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  qualityPill: {
    padding: '4px 10px',
    borderRadius: '999px',
    border: '1px solid #2a2a2a',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.4px',
    userSelect: 'none',
  },
  qualityPillSd: {
    background: 'rgba(148, 163, 184, 0.15)',
    color: '#cbd5e1',
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  qualityPillHd: {
    background: 'rgba(34, 197, 94, 0.15)',
    color: '#86efac',
    borderColor: 'rgba(34, 197, 94, 0.45)',
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
    color: '#b3b3b3',
    fontSize: '13px',
  },
  callStatus: {
    color: '#22c55e',
    fontSize: '14px',
  },
  
  // ===== MAIN VIDEO (Discord style) =====
  mainVideoContainer: {
    flex: 1,
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 0, // Важно для flex
  },
  mainVideoWrapper: {
    position: 'relative',
    width: '100%',
    height: '100%',
    maxHeight: '75vh',
    background: '#0f0f0f',
    borderRadius: '12px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'box-shadow 0.2s ease',
  },
  mainVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain', // Сохраняем пропорции
  },
  mainVideoPlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    color: '#666',
  },
  mainVideoAvatar: {
    fontSize: '120px',
  },
  mainVideoName: {
    fontSize: '20px',
    color: '#999',
    margin: 0,
  },
  mainVideoLabel: {
    position: 'absolute',
    bottom: '16px',
    left: '16px',
    background: 'rgba(0, 0, 0, 0.8)',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
  },
  mainMutedIndicator: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'rgba(239, 68, 68, 0.9)',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
  },
  unpinBtn: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'rgba(0, 0, 0, 0.7)',
    border: 'none',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    color: '#fff',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
  },
  videoHidden: {
    display: 'none',
  },
  
  // Active speaker визуальная рамка
  activeSpeaker: {
    boxShadow: '0 0 0 3px #22c55e, 0 0 20px rgba(34, 197, 94, 0.5)',
  },
  activeSpeakerBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    border: '3px solid #22c55e',
    borderRadius: '12px',
    pointerEvents: 'none',
    animation: 'pulse 2s infinite',
  },
  
  // ===== PREVIEW STRIP (Горизонтальная лента) =====
  previewStrip: {
    padding: '0 16px 12px 16px',
    background: '#1e1e1e',
    borderTop: '1px solid #2a2a2a',
    flexShrink: 0,
  },
  previewScrollContainer: {
    display: 'flex',
    gap: '12px',
    overflowX: 'auto',
    overflowY: 'hidden',
    paddingBottom: '4px',
    // Стилизация scrollbar (WebKit)
    scrollbarWidth: 'thin',
    scrollbarColor: '#3a3a3a #1e1e1e',
  },
  previewItem: {
    position: 'relative',
    minWidth: '180px',
    width: '180px',
    height: '120px',
    background: '#0f0f0f',
    borderRadius: '8px',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    flexShrink: 0,
  },
  previewItemActive: {
    boxShadow: '0 0 0 2px #22c55e',
  },
  previewVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  previewPlaceholder: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '48px',
    color: '#444',
  },
  previewLabel: {
    position: 'absolute',
    bottom: '6px',
    left: '6px',
    background: 'rgba(0, 0, 0, 0.7)',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500',
    maxWidth: 'calc(100% - 12px)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  connectingText: {
    display: 'block',
    fontSize: '10px',
    marginTop: '4px',
    opacity: 0.7,
  },
  previewMuted: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    background: 'rgba(239, 68, 68, 0.9)',
    borderRadius: '50%',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
  },
  volumeIndicator: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    fontSize: '16px',
  },
  previewActiveBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    border: '2px solid #22c55e',
    borderRadius: '8px',
    pointerEvents: 'none',
  },
  
  // ===== CONTROLS =====
  controls: {
    padding: '16px',
    background: '#0f0f0f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    borderTop: '1px solid #2a2a2a',
    flexShrink: 0,
  },
  controlBtn: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    border: 'none',
    background: '#3a3a3a',
    color: '#fff',
    fontSize: '24px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
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
    transition: 'all 0.2s ease',
  },
  
  // ===== INCOMING CALL =====
  incomingModal: {
    background: '#1e1e1e',
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
    color: '#b3b3b3',
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

// ===== CSS ANIMATIONS (inject to document.head) =====
if (typeof document !== 'undefined') {
  const styleId = 'group-call-animations';
  
  if (!document.getElementById(styleId)) {
    const styleTag = document.createElement('style');
    styleTag.id = styleId;
    styleTag.textContent = `
      /* Fade in animation */
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      
      /* Pulse animation for active speaker */
      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.7;
        }
      }
      
      /* Preview hover effect */
      .preview-item:hover {
        transform: scale(1.05);
      }
      
      /* Scrollbar styling (WebKit) */
      .preview-scroll-container::-webkit-scrollbar {
        height: 6px;
      }
      
      .preview-scroll-container::-webkit-scrollbar-track {
        background: #1e1e1e;
      }
      
      .preview-scroll-container::-webkit-scrollbar-thumb {
        background: #3a3a3a;
        border-radius: 3px;
      }
      
      .preview-scroll-container::-webkit-scrollbar-thumb:hover {
        background: #4a4a4a;
      }
      
      /* Mobile adaptations */
      @media (max-width: 768px) {
        .group-call-modal {
          margin: 0 !important;
          border-radius: 0 !important;
          max-width: 100% !important;
          max-height: 100% !important;
        }
        
        .preview-item {
          min-width: 140px !important;
          width: 140px !important;
          height: 100px !important;
        }
        
        .main-video-label {
          font-size: 12px !important;
          padding: 6px 10px !important;
        }
      }
      
      /* Android WebView optimizations */
      @media (hover: none) and (pointer: coarse) {
        .control-btn:active {
          transform: scale(0.95);
        }
        
        .preview-item:active {
          transform: scale(0.98);
        }
      }
    `;
    document.head.appendChild(styleTag);
  }
}

export default GroupCallModal;
