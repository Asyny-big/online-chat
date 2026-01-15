import { Capacitor } from '@capacitor/core';

// УКАЖИТЕ IP/ХОСТ И ПОРТ ВАШЕГО СЕРВЕРА для нативного приложения
// Например: http://192.168.0.50:5000
const NATIVE_SERVER_BASE = 'https://govchat.ru';

export const API_URL = (() => {
  const platform = Capacitor.getPlatform();
  if (platform === 'android' || platform === 'ios') {
    return `${NATIVE_SERVER_BASE}/api`;
  }
  return '/api'; // веб-приложение проксирует на backend по тому же хосту
})();

export const SOCKET_URL = (() => {
  const platform = Capacitor.getPlatform();
  if (platform === 'android' || platform === 'ios') {
    return NATIVE_SERVER_BASE;
  }
  return '/';
})();

export const LIVEKIT_URL = 'wss://govchat.ru/rtc';
