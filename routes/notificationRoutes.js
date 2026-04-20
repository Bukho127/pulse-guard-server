const express = require('express');
const {
  createNotification,
  getUserNotifications,
  getUnreadNotifications,
  markAsRead,
  deleteNotification
} = require('../controllers/notificationController.js');
const { protect } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.use(protect);

router.post('/notifications', createNotification);
router.get('/notifications', getUserNotifications);
router.get('/notifications/unread', getUnreadNotifications);
router.put('/notifications/:id/read', markAsRead);
router.delete('/notifications/:id', deleteNotification);

module.exports = router;
