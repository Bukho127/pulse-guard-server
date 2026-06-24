const express = require('express');
const {
  createNotification,
  getUnreadNotifications,
  markAsRead,
  deleteNotification,
  notifyPersonnelNearby
} = require('../controllers/notificationController.js');
const { protect, authorizePersonnel } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.use(protect);

router.post('/notifications', authorizePersonnel, createNotification);
router.get('/notifications/unread', getUnreadNotifications);
router.post('/notifications/incidents/:incidentId/personnel-nearby', authorizePersonnel, notifyPersonnelNearby);
router.put('/notifications/:id/read', markAsRead);
router.delete('/notifications/:id', deleteNotification);

module.exports = router;
