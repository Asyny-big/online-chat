import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';

/**
 * VideoTile
 * - Отдельный компонент: минимизирует re-render поверх видео элементов.
 * - Прямое управление srcObject (MediaStream) вместо пересоздания/attach на каждый render.
 * - Без canvas: только <video>/<audio>.
 */
function VideoTileImpl({
  id,
  name,
  isLocal,
  isPinned,
  isActiveSpeaker,
  micMuted,
  cameraOff,
  videoTrack,
  audioTrack,
  onTogglePin
}) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  // LiveKit attach/detach: держим ссылки на «сейчас прикрепленный» трек,
  // чтобы не дергать DOM на обычных re-render.
  const attachedVideoTrackRef = useRef(null);
  const attachedAudioTrackRef = useRef(null);

  const initials = useMemo(() => {
    const safe = String(name || '').trim();
    if (!safe) return '??';
    return safe.slice(0, 2).toUpperCase();
  }, [name]);

  const safePlay = useCallback((el) => {
    if (!el) return;
    try {
      const p = el.play?.();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // autoplay policy / iOS: игнорируем. UI должен оставаться стабильным.
        });
      }
    } catch (_) {
      // no-op
    }
  }, []);

  // VIDEO: LiveKit track.attach/detach (стабильно, без повторных attach)
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return undefined;

    el.autoplay = true;
    el.playsInline = true;
    // Важно: local видео всегда muted (эхо/автоплей)
    el.muted = !!isLocal;

    const nextTrack = !cameraOff ? videoTrack : null;

    // Снять предыдущий трек при выключении камеры или смене объекта трека.
    if (attachedVideoTrackRef.current && attachedVideoTrackRef.current !== nextTrack) {
      try {
        attachedVideoTrackRef.current.detach?.(el);
      } catch (_) {
        // no-op
      }
      attachedVideoTrackRef.current = null;
    }

    if (!nextTrack) {
      if (el.srcObject) el.srcObject = null;
      return undefined;
    }

    if (attachedVideoTrackRef.current !== nextTrack) {
      try {
        nextTrack.attach?.(el);
        attachedVideoTrackRef.current = nextTrack;
      } catch (_) {
        // Если attach недоступен/сломался, оставляем UI без видео (аватар).
        attachedVideoTrackRef.current = null;
      }
    }

    safePlay(el);

    return () => {
      // Cleanup только на unmount/смену трека.
      if (attachedVideoTrackRef.current) {
        try {
          attachedVideoTrackRef.current.detach?.(el);
        } catch (_) {
          // no-op
        }
        attachedVideoTrackRef.current = null;
      }
      if (el.srcObject) el.srcObject = null;
    };
  }, [cameraOff, isLocal, safePlay, videoTrack]);

  // AUDIO: LiveKit track.attach/detach. Local audio не проигрываем.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;

    el.autoplay = true;
    el.muted = false;

    const nextTrack = !isLocal ? audioTrack : null;

    if (attachedAudioTrackRef.current && attachedAudioTrackRef.current !== nextTrack) {
      try {
        attachedAudioTrackRef.current.detach?.(el);
      } catch (_) {
        // no-op
      }
      attachedAudioTrackRef.current = null;
    }

    if (!nextTrack) {
      if (el.srcObject) el.srcObject = null;
      return undefined;
    }

    if (attachedAudioTrackRef.current !== nextTrack) {
      try {
        nextTrack.attach?.(el);
        attachedAudioTrackRef.current = nextTrack;
      } catch (_) {
        attachedAudioTrackRef.current = null;
      }
    }

    safePlay(el);
    return () => {
      if (attachedAudioTrackRef.current) {
        try {
          attachedAudioTrackRef.current.detach?.(el);
        } catch (_) {
          // no-op
        }
        attachedAudioTrackRef.current = null;
      }
      if (el.srcObject) el.srcObject = null;
    };
  }, [audioTrack, isLocal, safePlay]);

  const handlePin = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      onTogglePin?.(id);
    },
    [id, onTogglePin]
  );

  const showVideo = !!videoTrack && !!videoTrack.mediaStreamTrack && !cameraOff;

  return (
    <div
      className={[
        'lkVideoTile',
        isPinned ? 'isPinned' : '',
        isActiveSpeaker ? 'isActiveSpeaker' : '',
        !showVideo ? 'isNoVideo' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      role="button"
      tabIndex={0}
      onClick={handlePin}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handlePin(e);
      }}
      aria-label={isPinned ? `Открепить ${name}` : `Закрепить ${name}`}
    >
      {showVideo ? (
        <video ref={videoRef} className="lkVideoTile__video" />
      ) : (
        <div className="lkVideoTile__avatar" aria-hidden="true">
          <div className="lkVideoTile__avatarInner">{initials}</div>
        </div>
      )}

      {/* Remote audio playback */}
      <audio ref={audioRef} className="lkVideoTile__audio" />

      <div className="lkVideoTile__hud">
        <div className="lkVideoTile__name">
          {micMuted ? <span className="lkVideoTile__muted">mic off</span> : null}
          <span className="lkVideoTile__nameText">{isLocal ? 'Вы' : name || 'Участник'}</span>
        </div>

        <button
          type="button"
          className={['lkVideoTile__pinBtn', isPinned ? 'isOn' : ''].filter(Boolean).join(' ')}
          onClick={handlePin}
          aria-label={isPinned ? 'Unpin' : 'Pin'}
          title={isPinned ? 'Открепить' : 'Закрепить'}
        >
          {isPinned ? 'Unpin' : 'Pin'}
        </button>
      </div>
    </div>
  );
}

export const VideoTile = memo(
  VideoTileImpl,
  (prev, next) =>
    prev.id === next.id &&
    prev.name === next.name &&
    prev.isLocal === next.isLocal &&
    prev.isPinned === next.isPinned &&
    prev.isActiveSpeaker === next.isActiveSpeaker &&
    prev.micMuted === next.micMuted &&
    prev.cameraOff === next.cameraOff &&
    prev.videoTrack === next.videoTrack &&
    prev.audioTrack === next.audioTrack
);

