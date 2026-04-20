const asyncHandler = require('express-async-handler');
const Notification = require('../models/notificationModel.js');

const getAuthenticatedPersonnelId = (req) =>
  req.user?.security_personnel_id ?? req.user?.id ?? req.user?.user_id;


// @desc    Create notification
// @route   POST /api/notifications
// @access  Private
const createNotification = asyncHandler(async (req, res) => {
  const { incident_id, security_personnel_id } = req.body;

  if (!incident_id || !security_personnel_id) {
    res.status(400);
    throw new Error('Missing required fields');
  }

  const notification = await Notification.create({
    incident_id,
    security_personnel_id,
    status: 'sent',
  });

  res.status(201).json(notification);
});


// @desc    Get all notifications for logged-in user
// @route   GET /api/notifications
// @access  Private
const getUserNotifications = asyncHandler(async (req, res) => {
  const personnelId = getAuthenticatedPersonnelId(req);

  if (!personnelId) {
    res.status(401);
    throw new Error('Authenticated user id not found in token');
  }

  const notifications = await Notification.findAll({
    where: { security_personnel_id: personnelId },
    order: [['sent_at', 'DESC']],
  });

  res.json(notifications);
});


// @desc    Get unread notifications
// @route   GET /api/notifications/unread
// @access  Private
const getUnreadNotifications = asyncHandler(async (req, res) => {
  const personnelId = getAuthenticatedPersonnelId(req);

  if (!personnelId) {
    res.status(401);
    throw new Error('Authenticated user id not found in token');
  }

  const notifications = await Notification.findAll({
    where: {
      security_personnel_id: personnelId,
      status: 'sent',
    },
    order: [['sent_at', 'DESC']],
  });

  res.json(notifications);
});


// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const personnelId = getAuthenticatedPersonnelId(req);

  const notification = await Notification.findByPk(id);

  if (!notification) {
    res.status(404);
    throw new Error('Notification not found');
  }

  if (!personnelId) {
    res.status(401);
    throw new Error('Authenticated user id not found in token');
  }

  if (notification.security_personnel_id !== personnelId) {
    res.status(403);
    throw new Error('Not authorized');
  }

  notification.status = 'read';
  await notification.save();

  res.json({ message: 'Notification marked as read' });
});


// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const personnelId = getAuthenticatedPersonnelId(req);

  const notification = await Notification.findByPk(id);

  if (!notification) {
    res.status(404);
    throw new Error('Notification not found');
  }

  if (!personnelId) {
    res.status(401);
    throw new Error('Authenticated user id not found in token');
  }

  if (notification.security_personnel_id !== personnelId) {
    res.status(403);
    throw new Error('Not authorized');
  }

  await notification.destroy();

  res.json({ message: 'Notification deleted' });
});

module.exports = {
  createNotification,
  getUserNotifications, 
  getUnreadNotifications,
  markAsRead,
  deleteNotification
};  
