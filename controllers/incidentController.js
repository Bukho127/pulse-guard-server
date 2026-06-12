const Incident = require('../models/incidentModel');
const User = require('../models/userModel');
const { uploadToBlob } = require('../services/blobServices');
const { createNotification } = require('../services/notificationService');
const { queueIncidentPersonnelNotifications } = require('../services/incidentNotificationQueue');
const fs = require('fs');

// CREATE
const createIncident = async (req, res) => {
  try {
    const user_id = req.user.user_id; // from JWT middleware

    if (!req.file) {
      return res.status(400).json({ message: 'Video file is required' });
    }

    const video_url = await uploadToBlob(req.file);

    const incident = await Incident.create({
      user_id,
      video_url,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      address: req.body.address,
      status: 'pending'
    });

    try {
      await queueIncidentPersonnelNotifications(incident);
    } catch (queueError) {
      console.error('Failed to queue police personnel notifications:', queueError.message);
    }

    res.status(201).json(incident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
};

// GET ALL
const getIncidents = async (req, res) => {
  try {
    const incidents = await Incident.findAll({
      include: [{
          model: User,
          attributes: ['full_name', 'email'] // include user details
        }],
      order: [['created_at', 'DESC']]
    });
    res.json(incidents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getMyIncidents = async (req, res) => {
  try {
    const incidents = await Incident.findAll({
      where: { user_id: req.user.user_id },
      order: [['created_at', 'DESC']]
    });
    res.json(incidents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getMyIncidentById = async (req, res) => {
  try {
    const incident = await Incident.findOne({
      where: {
        incident_id: req.params.incidentId,
        user_id: req.user.user_id
      }
    });

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// GET ONE
const getIncidentById = async (req, res) => {
  try {
    const incident = await Incident.findByPk(req.params.incidentId, {
      include: [{
          model: User,
          attributes: ['full_name', 'email']
        }]
    });

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE STATUS
const updateIncidentStatus = async (req, res) => {
  try {
    const [updated] = await Incident.update(
      {
        status: req.body.status,
        acknowledged_at: req.body.status === 'acknowledged' ? new Date() : null
      },
      { where: { incident_id: req.params.incidentId } }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    const updatedIncident = await Incident.findByPk(req.params.incidentId);

    if (updatedIncident.status === 'acknowledged' && updatedIncident.user_id) {
      await createNotification({
        incident_id: updatedIncident.incident_id,
        user_id: updatedIncident.user_id,
        message: 'Your incident has been acknowledged. Help is on the way.',
        notification_type: 'incident_acknowledged'
      });
    }

    res.json(updatedIncident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE
const deleteIncident = async (req, res) => {
  try {
    const deleted = await Incident.destroy({
      where: { incident_id: req.params.incidentId }
    });

    if (!deleted) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    res.json({ message: 'Incident deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createIncident,
  getIncidents,
  getMyIncidentById,
  getIncidentById,
  updateIncidentStatus,
  deleteIncident,
  getMyIncidents
};
