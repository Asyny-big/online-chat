import React, { useCallback, useEffect, useRef } from 'react';

function MediaViewerModal({ media, onClose }) {
  const videoRef = useRef(null);

  const stopPlayback = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    try {
      el.pause();
    } catch (_) {}
    try {
      el.currentTime = 0;
    } catch (_) {}
    try {
      el.removeAttribute('src');
      el.load();
    } catch (_) {}
  }, []);

  const handleClose = useCallback(() => {
    stopPlayback();
    onClose?.();
  }, [onClose, stopPlayback]);

  useEffect(() => {
    if (!media) return undefined;
    const prevOverflow = document.body.style.overflow;
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleEsc);
    };
  }, [media, handleClose]);

  useEffect(() => {
    if (!media || !videoRef.current) return;
    videoRef.current.play().catch(() => {});
  }, [media]);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  useEffect(() => {
    return () => {
      if (videoRef.current) {
        try {
          videoRef.current.pause();
        } catch (_) {}
      }
    };
  }, []);

  if (!media) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="video-note-overlay"
      onClick={handleClose}
    >
      <div className="video-note-modal" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="video-note-close"
          onClick={handleClose}
          aria-label="Close"
        >
          x
        </button>
        <video
          ref={videoRef}
          src={media.url}
          controls
          playsInline
          preload="metadata"
          className="video-note-modal-video"
          controlsList="nodownload"
        />
      </div>
    </div>
  );
}

export default MediaViewerModal;
