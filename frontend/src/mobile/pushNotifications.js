import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { API_URL } from '../config';

const PUSH_OPEN_EVENT = 'govchat:push-open';
const PENDING_PUSH_KEY = 'govchat.pending_push_action';

function isNativePlatform() {
  const platform = Capacitor.getPlatform();
  return platform === 'android' || platform === 'ios';
}

function normalizePushData(data = {}) {
  const typeRaw = String(data.type || data.eventType || data.event_type || '').trim();
  const type = typeRaw.toUpperCase();
  return {
    type,
    chatId: String(data.chatId || data.chat_id || ''),
    chatName: String(data.chatName || data.chat_name || ''),
    messageId: String(data.messageId || data.message_id || ''),
    senderName: String(data.senderName || data.sender_name || data.initiatorName || data.initiator_name || ''),
    senderId: String(data.senderId || data.sender_id || data.initiatorId || data.initiator_id || ''),
    roomId: String(data.roomId || data.room_id || data.callId || data.call_id || ''),
    callId: String(data.callId || data.call_id || data.roomId || data.room_id || ''),
    callType: String(data.callType || data.call_type || '').toLowerCase() || 'audio',
    isGroupCall: String(data.isGroupCall || data.is_group_call || data.isGroup || data.is_group || '').toLowerCase() === 'true'
  };
}

async function registerDeviceToken({ jwtToken, pushToken }) {
  if (!jwtToken || !pushToken) return;
  try {
    await axios.post(
      `${API_URL}/devices/register`,
      {
        token: pushToken,
        platform: Capacitor.getPlatform(),
        appVersion: ''
      },
      {
        headers: { Authorization: `Bearer ${jwtToken}` }
      }
    );
  } catch (error) {
    console.warn('[Push] device register failed', error?.message || error);
  }
}

function emitPushOpen(data) {
  const payload = normalizePushData(data);
  localStorage.setItem(PENDING_PUSH_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent(PUSH_OPEN_EVENT, { detail: payload }));
}

export function consumePendingPushAction() {
  const raw = localStorage.getItem(PENDING_PUSH_KEY);
  if (!raw) return null;
  localStorage.removeItem(PENDING_PUSH_KEY);
  try {
    return normalizePushData(JSON.parse(raw));
  } catch (_) {
    return null;
  }
}

export function initPushNotifications({ token }) {
  if (!isNativePlatform()) {
    return () => {};
  }

  let removed = false;
  const listeners = [];

  const addListener = async (eventName, handler) => {
    const listener = await PushNotifications.addListener(eventName, handler);
    listeners.push(listener);
  };

  (async () => {
    try {
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== 'granted') {
        console.warn('[Push] permission not granted');
        return;
      }

      await PushNotifications.register();

      await addListener('registration', async (tokenValue) => {
        if (removed) return;
        await registerDeviceToken({
          jwtToken: token,
          pushToken: tokenValue?.value || ''
        });
      });

      await addListener('registrationError', (err) => {
        if (removed) return;
        console.warn('[Push] registration error', err);
      });

      await addListener('pushNotificationActionPerformed', (notification) => {
        if (removed) return;
        emitPushOpen(notification?.notification?.data || {});
      });

      await addListener('pushNotificationReceived', (notification) => {
        if (removed) return;
        const data = notification?.data || notification?.notification?.data || {};
        if (!data || Object.keys(data).length === 0) return;
        if (document.visibilityState === 'visible') {
          window.dispatchEvent(new CustomEvent(PUSH_OPEN_EVENT, { detail: normalizePushData(data) }));
        }
      });
    } catch (error) {
      console.warn('[Push] init failed', error?.message || error);
    }
  })();

  return () => {
    removed = true;
    listeners.forEach((listener) => {
      try {
        listener.remove();
      } catch (_) {}
    });
  };
}

export const pushEvents = {
  OPEN_EVENT: PUSH_OPEN_EVENT
};
