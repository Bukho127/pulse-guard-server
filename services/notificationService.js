const { Expo } = require('expo-server-sdk');

const Notification = require('../models/notificationModel');
const PushToken = require('../models/pushTokenModel');
const {
  encryptNotificationMessage,
  decryptNotificationMessage
} = require('../utils/notificationCrypto');
const { emitNotificationToRecipient } = require('./socketService');

const expo = new Expo();

const NOTIFICATION_COPY = {
  general: {
    title: 'Pulse Guard',
    body: 'You have a new notification.',
  },
  incident_acknowledged: {
    title: 'Incident acknowledged',
    body: 'Security has acknowledged your report.',
  },
  personnel_nearby: {
    title: 'Security nearby',
    body: 'Security personnel are near your reported incident.',
  },
};

const getRecipientFromPayload = ({ user_id, security_personnel_id }) => {
  if (user_id) {
    return {
      recipient_type: 'user',
      user_id,
      security_personnel_id: null,
      recipientId: user_id
    };
  }
  if (security_personnel_id) {
    return {
      recipient_type: 'personnel',
      user_id: null,
      security_personnel_id,
      recipientId: security_personnel_id
    };
  }
  throw new Error('A notification recipient is required');
};

const serializeNotification = (notification) => {
  const plainNotification =
    typeof notification.get === 'function'
      ? notification.get({ plain: true })
      : notification;
  const {
    message_encrypted,
    message_iv,
    message_auth_tag,
    ...safeNotification
  } = plainNotification;
  return {
    ...safeNotification,
    message: decryptNotificationMessage({
      message_encrypted,
      message_iv,
      message_auth_tag
    })
  };
};

const dispatchPush = async (notification, recipient, notificationType, incidentId) => {
  const tokens =
    recipient.recipient_type === 'user'
      ? await PushToken.getTokensForUser(recipient.recipientId)
      : await PushToken.getTokensForPersonnel(recipient.recipientId);

  if (tokens.length === 0) {
    return;
    // No tokens available for push notification so we don't attempt to send a push notification. 
    // The notification will still be stored in the database for later retrieval.
  }

  const validTokens = tokens.filter(Expo.isExpoPushToken);

  if (validTokens.length === 0) {
    await notification.update({ status: 'failed' });
    return;
  }

  const copy = NOTIFICATION_COPY[notificationType] || NOTIFICATION_COPY.general;

  const messages = validTokens.map((pushToken) => ({
    to: pushToken,
    sound: 'default',
    title: copy.title,
    body: copy.body,
    data: {
      notificationId: notification.notification_id,
      incidentId,
    },
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  try {
    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    const hasError = tickets.some((ticket) => ticket.status === 'error');

    await notification.update({
      status: hasError ? 'failed' : 'sent',
      expo_ticket_id: tickets[0] && tickets[0].id ? tickets[0].id : null,
    });
  } catch (error) {
    console.error('[dispatchPush] Failed to send push notification:', error.message);
    await notification.update({ status: 'failed' });
  }
};

const createNotification = async ({
  incident_id,
  user_id = null,
  security_personnel_id = null,
  message,
  notification_type = 'general'
}) => {
  const recipient = getRecipientFromPayload({ user_id, security_personnel_id });
  const encryptedMessage = encryptNotificationMessage(message);

  const notification = await Notification.create({
    incident_id,
    notification_type,
    ...recipient,
    ...encryptedMessage,
    status: 'sent'
  });

  const serializedNotification = serializeNotification(notification);

  // Real-time delivery for anyone with the app open right now.
  emitNotificationToRecipient({
    recipientType: recipient.recipient_type,
    recipientId: recipient.recipientId,
    notification: serializedNotification
  });

  try {
    await dispatchPush(notification, recipient, notification_type, incident_id);
  } catch (error) {
    console.error('[createNotification] Push dispatch failed:', error.message);
  }

  return serializedNotification;
};

module.exports = {
  createNotification,
  serializeNotification
};