//this file is used to encrypt and decrypt notification messages using AES-256-GCM algorithm.
// The encryption key is retrieved from the environment variable NOTIFICATION_ENCRYPTION_KEY, 
// which must be a 64-character hex string.

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

const getEncryptionKey = () => {
  const rawKey = process.env.NOTIFICATION_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error('NOTIFICATION_ENCRYPTION_KEY is not set');
  }

  if (!/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    throw new Error('NOTIFICATION_ENCRYPTION_KEY must be a 64-character hex string');
  }

  return Buffer.from(rawKey, 'hex');
};

const encryptNotificationMessage = (message) => {
  if (typeof message !== 'string' || message.trim() === '') {
    throw new Error('Notification message is required');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(message, 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return {
    message_encrypted: encrypted.toString('hex'),
    message_iv: iv.toString('hex'),
    message_auth_tag: authTag.toString('hex')
  };
};

const decryptNotificationMessage = (notification) => {
  if (
    !notification?.message_encrypted ||
    !notification?.message_iv ||
    !notification?.message_auth_tag
  ) {
    return null;
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(notification.message_iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(notification.message_auth_tag, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(notification.message_encrypted, 'hex')),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
};

module.exports = {
  encryptNotificationMessage,
  decryptNotificationMessage
};
