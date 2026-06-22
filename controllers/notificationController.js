const asyncHandler = require('express-async-handler');
const Notification = require('../models/notificationModel.js');
const Incident = require('../models/incidentModel.js');
const {
  createNotification: createNotificationEntry,
  serializeNotification
} = require('../services/notificationService.js');


// NORMALIZED USER CONTEXT (SINGLE SOURCE OF TRUTH)
const getAuthenticatedRecipient = (req) => {
  if (!req.user || !req.user.role) return null;

  if (req.user.role === 'personnel') {
    if (!req.user.id) return null;  // 
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


// BUILD SAFE SEQUELIZE WHERE CLAUSE
const buildRecipientWhere = (recipient) => {
  if (!recipient) return null;

  if (recipient.recipient_type === 'personnel') {
    if (!recipient.security_personnel_id) return null;

    return {
      recipient_type: 'personnel',
      security_personnel_id: recipient.security_personnel_id
    };
  }

  if (!recipient.user_id) return null;

  return {
    recipient_type: 'user',
    user_id: recipient.user_id
  };
};



// OWNERSHIP CHECK

const ownsNotification = (notification, recipient) => {
  if (!recipient || !notification) return false;

  if (recipient.recipient_type === 'personnel') {
    return (
      notification.recipient_type === 'personnel' &&
      notification.security_personnel_id === recipient.security_personnel_id
    );
  }

  return (
    notification.recipient_type === 'user' &&
    notification.user_id === recipient.user_id
  );
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
      message: 'incident_id, message and a recipient id are required'
    });
  }

  const notification = await createNotificationEntry({
    incident_id,
    user_id,
    security_personnel_id,
    message,
    notification_type
  });

  res.status(201).json(notification);
});


// GET ALL NOTIFICATIONS
const getUserNotifications = asyncHandler(async (req, res) => {
  const recipient = getAuthenticatedRecipient(req);
  const where = buildRecipientWhere(recipient);

  if (!where) {
    return res.status(401).json({
      message: 'Invalid authenticated user context'
    });
  }

  const notifications = await Notification.findAll({
    where,
    order: [['sent_at', 'DESC']]
  });

  res.json(notifications.map(serializeNotification));
});



// GET UNREAD NOTIFICATIONS (FIXED)

const getUnreadNotifications = asyncHandler(async (req, res) => {
  try {
    const recipient = getAuthenticatedRecipient(req);
    const where = buildRecipientWhere(recipient);

    console.log("REQ USER:", req.user);
    console.log("RECIPIENT:", recipient);
    console.log("WHERE:", where);

    const notifications = await Notification.findAll({
      where: {
        ...where,
        status: 'sent'
      },
      order: [['sent_at', 'DESC']]
    });

    res.json(notifications.map(serializeNotification));
  } catch (err) {
    console.error("SEQUELIZE ERROR:", err);
    console.error("STACK:", err.stack);

    return res.status(500).json({
      message: "Database query failed",
      error: err.message
    });
  }
});



// MARK AS READ

const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const recipient = getAuthenticatedRecipient(req);

  const notification = await Notification.findById(id);

  if (!notification) {
    return res.status(404).json({ message: 'Notification not found' });
  }

  if (!recipient) {
    return res.status(401).json({ message: 'Invalid user context' });
  }

  if (!ownsNotification(notification, recipient)) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  notification.status = 'read';
  await notification.save();

  res.json(serializeNotification(notification));
});



// DELETE NOTIFICATION

const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const recipient = getAuthenticatedRecipient(req);

  const notification = await Notification.findById(id);

  if (!notification) {
    return res.status(404).json({ message: 'Notification not found' });
  }

  if (!recipient) {
    return res.status(401).json({ message: 'Invalid user context' });
  }

  if (!ownsNotification(notification, recipient)) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  await notification.destroy();

  res.json({ message: 'Notification deleted' });
});


// INCIDENT NOTIFICATION
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

  res.status(201).json(notification);
});

module.exports = {
  createNotification,
  getUserNotifications,
  getUnreadNotifications,
  markAsRead,
  deleteNotification,
  notifyPersonnelNearby
};