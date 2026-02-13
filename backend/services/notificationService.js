const UserDevice = require('../models/UserDevice');
const { getMessaging } = require('./firebaseAdmin');

const MESSAGE_TYPE = {
  MESSAGE: 'MESSAGE',
  GROUP_MESSAGE: 'GROUP_MESSAGE',
  ATTACHMENT: 'ATTACHMENT',
  INCOMING_CALL: 'INCOMING_CALL'
};

class NotificationService {
  constructor({ userSockets }) {
    this.userSockets = userSockets;
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
      forceWakeup: true
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
    const sockets = this.userSockets?.get?.(String(userId));
    return !!(sockets && sockets.size > 0);
  }

  async sendToRecipients({ userIds, payloadType, title, body, data, forceWakeup = false }) {
    const messaging = getMessaging();
    if (!messaging) {
      return { sent: 0, skipped: 'firebase_not_initialized' };
    }

    const normalizedIds = Array.from(new Set((userIds || []).map((id) => String(id)).filter(Boolean)));
    if (!normalizedIds.length) return { sent: 0, skipped: 'empty_recipients' };

    const offlineUserIds = normalizedIds.filter((userId) => !this.isUserOnline(userId));
    if (!offlineUserIds.length) return { sent: 0, skipped: 'all_recipients_online' };

    const devices = await UserDevice.find(
      { userId: { $in: offlineUserIds } },
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

    const baseData = {
      ...Object.fromEntries(
        Object.entries(data || {}).map(([key, value]) => [key, value == null ? '' : String(value)])
      ),
      title: title || '',
      body: body || ''
    };

    const multicast = {
      tokens: tokenRows.map((row) => row.token),
      data: baseData,
      android: forceWakeup
        ? {
            priority: 'high',
            ttl: 0,
            directBootOk: true
          }
        : {
            priority: 'high',
            ttl: 24 * 60 * 60 * 1000
          },
      apns: {
        headers: forceWakeup ? { 'apns-priority': '10' } : undefined,
        payload: {
          aps: {
            'content-available': 1
          }
        }
      }
    };

    const response = await messaging.sendEachForMulticast(multicast);
    const invalidTokens = [];
    const failed = [];

    response.responses.forEach((item, index) => {
      if (item.success) return;
      const token = tokenRows[index]?.token;
      const code = item.error?.code || '';
      failed.push({ token, code });
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        invalidTokens.push(token);
      }
    });

    if (invalidTokens.length) {
      await UserDevice.deleteMany({ token: { $in: invalidTokens } });
    }

    if (failed.length) {
      console.warn('[Push] send failures:', {
        payloadType,
        failedCount: failed.length,
        sample: failed.slice(0, 3)
      });
    }

    return {
      sent: response.successCount,
      failed: response.failureCount,
      offlineRecipients: offlineUserIds.length,
      tokens: tokenRows.length
    };
  }
}

module.exports = {
  NotificationService,
  MESSAGE_TYPE
};
