const asyncHandler = require('express-async-handler');
const Notification = require('../models/notificationModel.js');
const Incident = require('../models/incidentModel.js');
const {
  createNotification: createNotificationEntry,
  serializeNotification
} = require('../services/notificationService.js');

const getAuthenticatedRecipient = (req) => {
  if (req.user?.role === 'personnel') {
    const personnelId = req.user?.security_personnel_id ?? req.user?.id;
    return personnelId
      ? { recipient_type: 'personnel', security_personnel_id: personnelId }
      : null;
  }

  const userId = req.user?.user_id ?? req.user?.id;
  return userId ? { recipient_type: 'user', user_id: userId } : null;
};

const buildRecipientWhere = (recipient) => {
  if (!recipient) {
    return null;
  }

  if (recipient.recipient_type === 'personnel') {
    return {
      recipient_type: 'personnel',
      security_personnel_id: recipient.security_personnel_id
    };
  }

  return {
    recipient_type: 'user',
    user_id: recipient.user_id
  };
};

const ownsNotification = (notification, recipient) => {
  if (!recipient) {
    return false;
  }

  if (recipient.recipient_type === 'personnel') {
    return (
      notification.recipient_type === 'personnel' &&
      notification.security_personnel_id === recipient.security_personnel_id
    );
  }

  return notification.recipient_type === 'user' && notification.user_id === recipient.user_id;
};


// @desc    Create notification
// @route   POST /api/notifications
// @access  Private
const createNotification = asyncHandler(async (req, res) => {
  const { incident_id, user_id, security_personnel_id, message, notification_type } = req.body;

  if (!incident_id || !message || (!user_id && !security_personnel_id)) {
    res.status(400);
    throw new Error('incident_id, message and a recipient id are required');
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


// @desc    Get all notifications for logged-in user
// @route   GET /api/notifications
// @access  Private
const getUserNotifications = asyncHandler(async (req, res) => {
  const recipient = getAuthenticatedRecipient(req);
  const where = buildRecipientWhere(recipient);

  if (!where) {
    res.status(401);
    throw new Error('Authenticated recipient not found in token');
  }

  const notifications = await Notification.findAll({
    where,
    order: [['sent_at', 'DESC']],
  });

  res.json(notifications.map(serializeNotification));
});


// @desc    Get unread notifications
// @route   GET /api/notifications/unread
// @access  Private
const getUnreadNotifications = asyncHandler(async (req, res) => {
  const recipient = getAuthenticatedRecipient(req);
  const where = buildRecipientWhere(recipient);

  if (!where) {
    res.status(401);
    throw new Error('Authenticated recipient not found in token');
  }

  const notifications = await Notification.findAll({
    where: {
      ...where,
      status: 'sent',
    },
    order: [['sent_at', 'DESC']],
  });

  res.json(notifications.map(serializeNotification));
});


// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const recipient = getAuthenticatedRecipient(req);

  const notification = await Notification.findByPk(id);

  if (!notification) {
    res.status(404);
    throw new Error('Notification not found');
  }

  if (!recipient) {
    res.status(401);
    throw new Error('Authenticated recipient not found in token');
  }

  if (!ownsNotification(notification, recipient)) {
    res.status(403);
    throw new Error('Not authorized');
  }

  notification.status = 'read';
  await notification.save();

  res.json(serializeNotification(notification));
});


// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const recipient = getAuthenticatedRecipient(req);

  const notification = await Notification.findByPk(id);

  if (!notification) {
    res.status(404);
    throw new Error('Notification not found');
  }

  if (!recipient) {
    res.status(401);
    throw new Error('Authenticated recipient not found in token');
  }

  if (!ownsNotification(notification, recipient)) {
    res.status(403);
    throw new Error('Not authorized');
  }

  await notification.destroy();

  res.json({ message: 'Notification deleted' });
});

const notifyPersonnelNearby = asyncHandler(async (req, res) => {
  const incident = await Incident.findByPk(req.params.incidentId);

  if (!incident) {
    return res.status(404).json({ message: 'Incident not found' });
  }

  const notification = await createNotificationEntry({
    incident_id: incident.incident_id,
    user_id: incident.user_id,
    message:
      req.body.message || 'Police personnel are nearby and responding to your incident.',
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
