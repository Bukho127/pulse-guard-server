const express = require('express');
const {
  createIncident,
  getIncidents,
  getIncidentById,
  updateIncidentStatus,
  deleteIncident,
  getMyIncidents
} = require('../controllers/incidentController');
const { protect, authorizeUser, authorizePersonnel } = require('../middleware/authMiddleware');
const { upload, compressVideo } = require('../middleware/uploadsMiddleware');

const router = express.Router();

router.post('/incidents', protect, authorizeUser, upload.single('video'), compressVideo, createIncident);
router.put('/incidents', (req, res) => {
  return res.status(400).json({
    message: 'PUT /incidents is not supported. Use PUT /incidents/:incidentId/status to update incident status.'
  });
});

router.get('/incidents/my', protect, authorizeUser, getMyIncidents);

router.get('/incidents/:incidentId', protect, authorizePersonnel, getIncidentById);
router.get('/incidents', protect, authorizePersonnel, getIncidents);
router.put('/incidents/:incidentId/status', protect, authorizePersonnel, updateIncidentStatus);
router.delete('/incidents/:incidentId', protect, authorizePersonnel, deleteIncident);

module.exports = router;