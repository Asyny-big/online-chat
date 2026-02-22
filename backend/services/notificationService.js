const UserDevice = require('../models/UserDevice');
const { getMessaging } = require('./firebaseAdmin');

const MESSAGE_TYPE = {
  MESSAGE: 'MESSAGE',
  GROUP_MESSAGE: 'GROUP_MESSAGE',
  ATTACHMENT: 'ATTACHMENT',
  INCOMING_CALL: 'INCOMING_CALL',
  CALL_CANCELLED: 'CALL_CANCELLED'
};

const MESSAGE_CHANNEL_ID = 'govchat_messages';
const MESSAGE_TTL_MS = 90 * 1000;
const CALL_TTL_MS = 30 * 1000;

class NotificationService {
  constructor({ userSockets, io }) {
    this.userSockets = userSockets;
    this.io = io;
  }

  async sendMessageNotification({ chat, message, senderId, senderName, text }) {
    const recipients = this.resolveRecipients(chat, senderId);
    return this.sendToRecipients({
      userIds: recipients,
      payloadType: MESSAGE_TYPE.MESSAGE,
      title: senderName || 'Новое сообщение',
      body: (text || '').trim() || 'Новое сообщение',
      data: {
        type: MESSAGE_TYPE.MESSAGE,
        eventType: MESSAGE_TYPE.MESSAGE,
        chatId: String(chat?._id || ''),
        messageId: String(message?._id || ''),
        senderName: senderName || '',
        senderId: String(senderId || ''),
        roomId: ''
      }
    });
  }

  async sendGroupNotification({ chat, message, senderId, senderName, text }) {
    const recipients = this.resolveRecipients(chat, senderId);
    return this.sendToRecipients({
      userIds: recipients,
      payloadType: MESSAGE_TYPE.GROUP_MESSAGE,
      title: chat?.name ? `${chat.name}` : 'Групповой чат',
      body: `${senderName || 'Участник'}: ${(text || '').trim() || 'Новое сообщение'}`,
      data: {
        type: MESSAGE_TYPE.GROUP_MESSAGE,
        eventType: MESSAGE_TYPE.GROUP_MESSAGE,
        chatId: String(chat?._id || ''),
        messageId: String(message?._id || ''),
        senderName: senderName || '',
        senderId: String(senderId || ''),
        roomId: ''
      }
    });
  }

  async sendAttachmentNotification({ chat, message, senderId, senderName, attachmentName }) {
    const recipients = this.resolveRecipients(chat, senderId);
    const isGroup = String(chat?.type || '') === 'group';
    const itemName = (attachmentName || '').trim();
    const body = itemName
      ? `${senderName || 'Пользователь'} отправил(а): ${itemName}`
      : `${senderName || 'Пользователь'} отправил(а) вложение`;

    return this.sendToRecipients({
      userIds: recipients,
      payloadType: MESSAGE_TYPE.ATTACHMENT,
      title: isGroup ? (chat?.name || 'Групповой чат') : 'Вложение',
      body,
      data: {
        type: MESSAGE_TYPE.ATTACHMENT,
        eventType: MESSAGE_TYPE.ATTACHMENT,
        chatId: String(chat?._id || ''),
        messageId: String(message?._id || ''),
        senderName: senderName || '',
        senderId: String(senderId || ''),
        roomId: ''
      }
    });
  }

  async sendIncomingCallNotification({
    chat,
    callId,
    senderId,
    senderName,
    callType = 'audio',
    isGroup = false
  }) {
    const recipients = this.resolveRecipients(chat, senderId);
    const callTitle = isGroup ? 'Входящий групповой звонок' : 'Входящий звонок';
    const callBody = isGroup
      ? `${senderName || 'Участник'} приглашает в звонок`
      : `${senderName || 'Пользователь'} звонит вам`;

    return this.sendToRecipients({
      userIds: recipients,
      payloadType: MESSAGE_TYPE.INCOMING_CALL,
      title: callTitle,
      body: callBody,
      data: {
        type: MESSAGE_TYPE.INCOMING_CALL,
        eventType: 'INCOMING_CALL',
        chatId: String(chat?._id || ''),
        chatName: String(chat?.name || ''),
        callId: String(callId || ''),
        roomId: String(callId || ''),
        senderName: senderName || '',
        senderId: String(senderId || ''),
        initiatorName: senderName || '',
        initiatorId: String(senderId || ''),
        callType: String(callType || 'audio'),
        isGroupCall: isGroup ? 'true' : 'false',
        messageId: ''
      },
      forceWakeup: true,
      sendToOnlineUsers: true
    });
  }

  async sendCallCancelledNotification({
    chat,
    callId,
    senderId,
    senderName,
    callType = 'audio',
    isGroup = false,
    reason = 'cancelled'
  }) {
    const recipients = this.resolveRecipients(chat, senderId);
    if (!recipients.length) return { sent: 0, skipped: 'empty_recipients' };

    return this.sendToRecipients({
      userIds: recipients,
      payloadType: MESSAGE_TYPE.CALL_CANCELLED,
      title: 'Call ended',
      body: 'Incoming call was cancelled',
      data: {
        type: MESSAGE_TYPE.CALL_CANCELLED,
        eventType: MESSAGE_TYPE.CALL_CANCELLED,
        chatId: String(chat?._id || ''),
        chatName: String(chat?.name || ''),
        callId: String(callId || ''),
        roomId: String(callId || ''),
        senderName: senderName || '',
        senderId: String(senderId || ''),
        initiatorName: senderName || '',
        initiatorId: String(senderId || ''),
        callType: String(callType || 'audio'),
        isGroupCall: isGroup ? 'true' : 'false',
        reason: String(reason || 'cancelled'),
        messageId: ''
      },
      forceWakeup: true,
      sendToOnlineUsers: true
    });
  }

  resolveRecipients(chat, senderId) {
    const sender = String(senderId || '');
    const participants = Array.isArray(chat?.participants) ? chat.participants : [];

    return participants
      .map((participant) => {
        const value = participant?.user?._id?.toString?.()
          || participant?.user?.toString?.()
          || participant?.user;
        return String(value || '');
      })
      .filter((id) => id && id !== sender);
  }

  isUserOnline(userId) {
    const userKey = String(userId);
    const sockets = this.userSockets?.get?.(userKey);
    if (!sockets || sockets.size === 0) return false;

    // Remove stale socket IDs that are no longer present in Socket.IO server.
    const aliveSocketIds = [];
    sockets.forEach((socketId) => {
      const isAlive = !!this.io?.sockets?.sockets?.get?.(socketId);
      if (isAlive) {
        aliveSocketIds.push(socketId);
      } else {
        sockets.delete(socketId);
      }
    });

    if (sockets.size === 0) {
      this.userSockets.delete(userKey);
    }

    return aliveSocketIds.length > 0;
  }

  resolveDeliveryProfile({ payloadType, forceWakeup }) {
    const isChatMessagePayload = [
      MESSAGE_TYPE.MESSAGE,
      MESSAGE_TYPE.GROUP_MESSAGE,
      MESSAGE_TYPE.ATTACHMENT
    ].includes(payloadType);

    if (forceWakeup || payloadType === MESSAGE_TYPE.INCOMING_CALL) {
      return {
        android: {
          priority: 'high',
          ttl: CALL_TTL_MS,
          directBootOk: true
        },
        includeNotification: false,
        apnsHeaders: { 'apns-priority': '10' },
        ttlMs: CALL_TTL_MS
      };
    }

    if (payloadType === MESSAGE_TYPE.CALL_CANCELLED) {
      return {
        android: {
          priority: 'high',
          ttl: CALL_TTL_MS
        },
        includeNotification: false,
        apnsHeaders: { 'apns-priority': '10' },
        ttlMs: CALL_TTL_MS
      };
    }

    if (isChatMessagePayload) {
      return {
        android: {
          priority: 'high',
          ttl: MESSAGE_TTL_MS,
          notification: {
            channelId: MESSAGE_CHANNEL_ID
          }
        },
        includeNotification: true,
        apnsHeaders: { 'apns-priority': '10' },
        ttlMs: MESSAGE_TTL_MS
      };
    }

    return {
      android: {
        priority: 'high',
        ttl: MESSAGE_TTL_MS
      },
      includeNotification: false,
      apnsHeaders: undefined,
      ttlMs: MESSAGE_TTL_MS
    };
  }

  async sendToRecipients({
    userIds,
    payloadType,
    title,
    body,
    data,
    forceWakeup = false,
    sendToOnlineUsers = false
  }) {
    const messaging = getMessaging();
    if (!messaging) {
      return { sent: 0, skipped: 'firebase_not_initialized' };
    }

    const normalizedIds = Array.from(new Set((userIds || []).map((id) => String(id)).filter(Boolean)));
    if (!normalizedIds.length) return { sent: 0, skipped: 'empty_recipients' };

    const targetUserIds = sendToOnlineUsers
      ? normalizedIds
      : normalizedIds.filter((userId) => !this.isUserOnline(userId));

    if (!targetUserIds.length) {
      return {
        sent: 0,
        skipped: 'all_recipients_online',
        recipients: normalizedIds.length
      };
    }

    const devices = await UserDevice.find(
      { userId: { $in: targetUserIds } },
      { token: 1, userId: 1, _id: 0 }
    ).lean();

    const tokenRows = [];
    const seenTokens = new Set();
    devices.forEach((device) => {
      const token = String(device?.token || '').trim();
      if (!token || seenTokens.has(token)) return;
      seenTokens.add(token);
      tokenRows.push({ token, userId: String(device.userId || '') });
    });

    if (!tokenRows.length) return { sent: 0, skipped: 'no_device_tokens' };

    const dispatchTimestampMs = Date.now();
    const pushTraceId = `${String(payloadType || 'push').toLowerCase()}-${dispatchTimestampMs}-${Math.random().toString(36).slice(2, 8)}`;
    const deliveryProfile = this.resolveDeliveryProfile({ payloadType, forceWakeup });

    const baseData = {
      ...Object.fromEntries(
        Object.entries(data || {}).map(([key, value]) => [key, value == null ? '' : String(value)])
      ),
      title: title || '',
      body: body || '',
      pushTraceId,
      pushSentAt: String(dispatchTimestampMs),
      pushTtlSeconds: String(Math.floor(deliveryProfile.ttlMs / 1000))
    };

    const multicast = {
      tokens: tokenRows.map((row) => row.token),
      data: baseData,
      notification: deliveryProfile.includeNotification
        ? {
            title: title || '',
            body: body || ''
          }
        : undefined,
      android: deliveryProfile.android,
      apns: {
        headers: deliveryProfile.apnsHeaders,
        payload: {
          aps: {
            'content-available': 1
          }
        }
      }
    };

    console.info('[Push] dispatch:', {
      pushTraceId,
      payloadType,
      recipients: targetUserIds.length,
      tokens: tokenRows.length,
      forceWakeup,
      androidPriority: deliveryProfile.android.priority,
      ttlMs: deliveryProfile.ttlMs,
      includeNotification: deliveryProfile.includeNotification,
      timestamp: new Date(dispatchTimestampMs).toISOString()
    });

    const response = await messaging.sendEachForMulticast(multicast);
    const invalidTokens = [];
    const failed = [];

    response.responses.forEach((item, index) => {
      if (item.success) return;
      const token = tokenRows[index]?.token;
      const code = item.error?.code || '';
      const message = item.error?.message || '';
      failed.push({ token, code, message });
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        invalidTokens.push(token);
      }
    });

    if (invalidTokens.length) {
      await UserDevice.deleteMany({ token: { $in: invalidTokens } });
    }

    if (failed.length) {
      console.warn('[Push] send failures:', {
        pushTraceId,
        payloadType,
        failedCount: failed.length,
        sample: failed.slice(0, 3)
      });

      if (failed.every((item) => item.code === 'app/invalid-credential')) {
        console.error(
          '[Push] Firebase credentials rejected by FCM. Check service-account key validity, IAM access and server time sync.'
        );
      }
    }

    console.info('[Push] delivery result:', {
      pushTraceId,
      payloadType,
      sent: response.successCount,
      failed: response.failureCount,
      tokens: tokenRows.length
    });

    return {
      sent: response.successCount,
      failed: response.failureCount,
      targetRecipients: targetUserIds.length,
      tokens: tokenRows.length,
      pushTraceId,
      pushSentAt: dispatchTimestampMs
    };
  }
}

module.exports = {
  NotificationService,
  MESSAGE_TYPE
};
