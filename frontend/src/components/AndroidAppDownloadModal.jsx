import React, { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { ANDROID_APK_DOWNLOAD_URL } from '../config';
import { useMediaQuery } from '../hooks/useMediaQuery';
import './AndroidAppDownloadModal.css';

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
    <div className="apk-modal-overlay" role="dialog" aria-modal="true" aria-label="Скачать GovChat для Android">
      <div className="apk-modal-card">
        <div className="apk-modal-glow apk-modal-glow-top" />
        <div className="apk-modal-glow apk-modal-glow-bottom" />

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="apk-modal-close"
          aria-label="Закрыть"
        >
          x
        </button>

        <div className="apk-modal-pill">GovChat Android</div>
        <h2 className="apk-modal-title">Установите приложение за 30 секунд</h2>
        <p className="apk-modal-description">
          Скачайте актуальный APK с вашего сервера и используйте GovChat как полноценное приложение.
        </p>

        <ul className="apk-modal-benefits">
          <li>Быстрый запуск чатов в один тап</li>
          <li>Более удобные звонки и пуш-уведомления</li>
          <li>Всегда свежий APK с govchat.ru</li>
        </ul>

        <a href={ANDROID_APK_DOWNLOAD_URL} className="apk-modal-download" download>
          Скачать APK
        </a>

        <p className="apk-modal-footnote">Файл загружается с вашего сервера: govchat.ru</p>
      </div>
    </div>
  );
}

export default AndroidAppDownloadModal;
