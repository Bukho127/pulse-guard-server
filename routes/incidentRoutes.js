const express = require('express');
const {
  createIncident,
  getIncidents,
  getAllIncidents,
  getMyIncidentById,
  getIncidentById,
  updateIncidentStatus,
  deleteIncident,
  getMyIncidents,
  finalizeIncidentVideo,
  unsupportedPutIncidents
} = require('../controllers/incidentController');
const { 
  protect, 
  authorizeUser, 
  authorizePersonnel 
} = require('../middleware/authMiddleware');
const { upload, 
  validateUpload } = require('../middleware/uploadsMiddleware');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/incidents', protect, authorizeUser, rateLimiter, upload.single('video'), validateUpload, createIncident);
router.post('/internal/video-complete', finalizeIncidentVideo);
router.put('/incidents', unsupportedPutIncidents);

router.get('/incidents/my', protect, authorizeUser, getMyIncidents);
router.get('/incidents/my/:incidentId', protect, authorizeUser, getMyIncidentById);

router.get('/incidents/all', protect, authorizePersonnel, getAllIncidents);
router.get('/incidents/:incidentId', protect, authorizePersonnel, getIncidentById);
router.get('/incidents', protect, authorizePersonnel, getIncidents);
router.put('/incidents/:incidentId/status', protect, authorizePersonnel, updateIncidentStatus);
router.delete('/incidents/:incidentId', protect, authorizePersonnel, deleteIncident);

module.exports = router;
