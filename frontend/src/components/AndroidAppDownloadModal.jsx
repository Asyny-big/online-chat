import React, { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { ANDROID_APK_DOWNLOAD_URL } from '../config';
import { useMediaQuery } from '../hooks/useMediaQuery';

function AndroidAppDownloadModal() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isNativePlatform = useMemo(() => {
    try {
      return Capacitor.getPlatform() !== 'web';
    } catch (_) {
      return false;
    }
  }, []);
  const isAndroidBrowser = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return /android/i.test(window.navigator.userAgent || '');
  }, []);

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(Boolean(isMobile && isAndroidBrowser && !isNativePlatform));
  }, [isMobile, isAndroidBrowser, isNativePlatform]);

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          style={styles.closeButton}
          aria-label="Close"
        >
          x
        </button>
        <h2 style={styles.title}>Установите GovChat на Android</h2>
        <p style={styles.description}>
          Скачайте актуальную APK-версию приложения прямо с сервера.
        </p>
        <a href={ANDROID_APK_DOWNLOAD_URL} style={styles.downloadButton} download>
          Скачать APK
        </a>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.72)',
    zIndex: 3000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  },
  modal: {
    position: 'relative',
    width: '100%',
    maxWidth: '420px',
    borderRadius: '16px',
    padding: '22px 18px 18px',
    background: '#111827',
    color: '#f8fafc',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
    border: '1px solid rgba(148, 163, 184, 0.22)',
  },
  closeButton: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: '18px',
    cursor: 'pointer',
    lineHeight: 1,
    padding: '4px',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    lineHeight: 1.25,
    paddingRight: '24px',
  },
  description: {
    margin: '10px 0 16px',
    color: '#cbd5e1',
    fontSize: '14px',
    lineHeight: 1.5,
  },
  downloadButton: {
    display: 'inline-block',
    width: '100%',
    textAlign: 'center',
    textDecoration: 'none',
    fontWeight: 600,
    borderRadius: '12px',
    padding: '12px 14px',
    background: '#22c55e',
    color: '#052e16',
  },
};

export default AndroidAppDownloadModal;
