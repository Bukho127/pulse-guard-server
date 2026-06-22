const Incident = require('../models/incidentModel');
const IncidentHistory = require('../models/incidentHistoryModel')
const User = require('../models/userModel');
const { uploadToBlob } = require('../services/blobServices');
const { createNotification } = require('../services/notificationService');
const { queueIncidentPersonnelNotifications } = require('../services/incidentNotificationQueue');
const fs = require('fs');

const getIncidentReporterInclude = () => [{
  model: User,
  attributes: ['full_name', 'email']
}];

const buildPagination = (page, limit, total) => {
  const pages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    pages,
    hasPrev: page > 1,
    hasNext: page < pages
  };
};

const getAllIncidentsQuery = () => ({
  include: getIncidentReporterInclude(),
  order: [['created_at', 'DESC']]
});

// CREATE
const createIncident = async (req, res) => {
  console.log("CREATE INCIDENT CALLED")
  
  try {
    const user_id = req.user.user_id; // from JWT middleware
     console.log('req.user:', req.user)

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

// GET ALL, optionally paginated when page and limit are both provided
const getIncidents = async (req, res) => {
  try {
    const hasPage = req.query.page !== undefined;
    const hasLimit = req.query.limit !== undefined;

    if (hasPage !== hasLimit) {
      return res.status(400).json({
        message: 'Both page and limit are required for paginated incident requests.'
      });
    }

    if (!hasPage && !hasLimit) {
      const incidents = await Incident.findAll(getAllIncidentsQuery());
      return res.json({ data: incidents });
    }

    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);

    if (Number.isNaN(page) || Number.isNaN(limit)) {
      return res.status(400).json({
        message: 'page and limit must be valid numbers.'
      });
    }

    page = Math.max(1, page);
    limit = Math.min(100, Math.max(1, limit));

    const offset = (page - 1) * limit;

    const { count, rows } = await Incident.findAndCountAll({
      include: getIncidentReporterInclude(),
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    res.json({
      data: rows,
      pagination: buildPagination(page, limit, count)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getAllIncidents = async (req, res) => {
  try {
    const incidents = await Incident.findAll(getAllIncidentsQuery());

    res.json({ data: incidents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET MY INCIDENTS with PAGINATION
const getMyIncidents = async (req, res) => {
  try {
    console.log('=== GET INCIDENTS CALLED ===');
    console.log('Query params:', req.query);
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;

    page = Math.max(1, page);
    limit = Math.min(100, Math.max(1, limit));

    const offset = (page - 1) * limit;

    const { count, rows } = await Incident.findAndCountAll({
      where: { user_id: req.user.user_id },
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    res.json({
      data: rows,
      pagination: buildPagination(page, limit, count)
    });
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
    const incident = await Incident.findById(req.params.incidentId, {
      include: getIncidentReporterInclude()
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
    console.log('Updating incident:', req.params.incidentId, 'to status:', req.body.status);
    console.log('User:', req.user);

    const [updated] = await Incident.update(
      {
        status: req.body.status,
        acknowledged_at: req.body.status === 'acknowledged' ? new Date() : null,
        updated_at: new Date()
      },
      { where: { incident_id: req.params.incidentId } }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    console.log('Incident updated successfully');

    // CREATE HISTORY RECORD
    console.log('Creating history record with changed_by:', req.user.security_personnel_id);
    await IncidentHistory.create({
      incident_id: req.params.incidentId,
      changed_by: req.user.security_personnel_id,
      status: req.body.status
    });
    console.log('History record created');

    const updatedIncident = await Incident.findById(req.params.incidentId);

    if (updatedIncident.status === 'acknowledged' && updatedIncident.user_id) {
      try {
        await createNotification({
          incident_id: updatedIncident.incident_id,
          user_id: updatedIncident.user_id,
          message: 'Your incident has been acknowledged. Help is on the way.',
          notification_type: 'incident_acknowledged'
        });
        console.log('Notification created');
      } catch (notificationError) {
        console.error('Notification creation error:', notificationError.message);
      }
    }

    console.log('Sending response');
    res.json(updatedIncident);
  } catch (err) {
    console.error('UPDATE INCIDENT STATUS ERROR:', err.message);
    console.error('Stack:', err.stack);
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
  getAllIncidents,
  getMyIncidentById,
  getIncidentById,
  updateIncidentStatus,
  deleteIncident,
  getMyIncidents
};
