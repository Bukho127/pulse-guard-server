const asyncHandler = require('express-async-handler');
const Notification = require('../models/notificationModel.js');
const Incident = require('../models/incidentModel.js');

const {
  createNotification: createNotificationEntry,
  serializeNotification
} = require('../services/notificationService.js');

const {
  emitNotificationToRecipient
} = require('../services/socketService.js');


// NORMALIZED USER CONTEXT
const getAuthenticatedRecipient = (req) => {
  if (!req.user || !req.user.role) return null;

  if (req.user.role === 'personnel') {
    if (!req.user.id) return null;
    return {
      recipient_type: 'personnel',
      security_personnel_id: req.user.id
    };
  }

  if (!req.user.user_id) return null;

  return {
    recipient_type: 'user',
    user_id: req.user.user_id
  };
};


// CREATE NOTIFICATION
const createNotification = asyncHandler(async (req, res) => {
  const {
    incident_id,
    user_id,
    security_personnel_id,
    message,
    notification_type
  } = req.body;

  if (!incident_id || !message || (!user_id && !security_personnel_id)) {
    return res.status(400).json({
      message: 'incident_id, message and recipient id are required'
    });
  }

  // 1. CREATE DB RECORD
  const notification = await createNotificationEntry({
    incident_id,
    user_id,
    security_personnel_id,
    message,
    notification_type
  });

  const serialized = serializeNotification(notification);

  // 2. DEBUG LOG (CONFIRM FLOW)
  console.log("BEFORE EMIT");

  // 3. EMIT SOCKET EVENT
  try {
    const recipientType = security_personnel_id ? 'personnel' : 'user';
    const recipientId = security_personnel_id || user_id;

    console.log("EMIT TARGET:", `${recipientType}:${recipientId}`);

    emitNotificationToRecipient({
      recipientType,
      recipientId,
      notification: serialized
    });

    console.log("AFTER EMIT");
  } catch (err) {
    console.error("❌ SOCKET EMIT FAILED:", err.message);
  }

  // 4. RESPONSE
  return res.status(201).json(serialized);
});


const getUnreadNotifications = asyncHandler(async (req, res) => {
  try {
    const recipient = getAuthenticatedRecipient(req);

    const where = recipient?.recipient_type === 'personnel'
      ? { recipient_type: 'personnel', security_personnel_id: recipient.security_personnel_id }
      : { recipient_type: 'user', user_id: recipient.user_id };

    const notifications = await Notification.findAll({
      where: {
        ...where,
        status: 'sent'
      },
      order: [['sent_at', 'DESC']]
    });

    const serialized = notifications.map(serializeNotification);

    return res.json({
      count: serialized.length,
      notifications: serialized
    });
  } catch (err) {
    console.error("SEQUELIZE ERROR:", err);
    return res.status(500).json({ message: "Database query failed" });
  }
});

const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const recipient = getAuthenticatedRecipient(req);

  const notification = await Notification.findById(id);
  if (!notification) return res.status(404).json({ message: 'Not found' });

  const isOwner = recipient?.recipient_type === 'personnel'
    ? notification.security_personnel_id === recipient.security_personnel_id
    : notification.user_id === recipient.user_id;

  if (!isOwner) return res.status(403).json({ message: 'Forbidden' });

  await notification.update({ status: 'read' });

  res.json(serializeNotification(notification));
});

const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const recipient = getAuthenticatedRecipient(req);

  const notification = await Notification.findById(id);
  if (!notification) return res.status(404).json({ message: 'Not found' });

  const isOwner = recipient?.recipient_type === 'personnel'
    ? notification.security_personnel_id === recipient.security_personnel_id
    : notification.user_id === recipient.user_id;

  if (!isOwner) return res.status(403).json({ message: 'Forbidden' });

  await notification.destroy();

  res.json({ message: 'Deleted' });
});

const notifyPersonnelNearby = asyncHandler(async (req, res) => {
  const incident = await Incident.findById(req.params.incidentId);

  if (!incident) {
    return res.status(404).json({ message: 'Incident not found' });
  }

  const notification = await createNotificationEntry({
    incident_id: incident.incident_id,
    user_id: incident.user_id,
    message:
      req.body.message ||
      'Police personnel are nearby and responding to your incident.',
    notification_type: 'personnel_nearby'
  });

  const serialized = serializeNotification(notification);

  // IMPORTANT: EMIT HERE TOO
  emitNotificationToRecipient({
    recipientType: 'user',
    recipientId: incident.user_id,
    notification: serialized
  });

  res.status(201).json(serialized);
});

module.exports = {
  createNotification,
  getUnreadNotifications,
  markAsRead,
  deleteNotification,
  notifyPersonnelNearby
};