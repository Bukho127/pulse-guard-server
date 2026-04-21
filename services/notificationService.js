const Notification = require('../models/notificationModel');
const {
  encryptNotificationMessage,
  decryptNotificationMessage
} = require('../utils/notificationCrypto');
const { emitNotificationToRecipient } = require('./socketService');

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

  emitNotificationToRecipient({
    recipientType: recipient.recipient_type,
    recipientId: recipient.recipientId,
    notification: serializedNotification
  });

  return serializedNotification;
};

module.exports = {
  createNotification,
  serializeNotification
};
