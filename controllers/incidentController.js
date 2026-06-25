const axios = require('axios');
const fs = require('fs');
const path = require('path');

const Incident = require('../models/incidentModel');
const IncidentHistory = require('../models/incidentHistoryModel');
const User = require('../models/userModel');
const { createNotification } = require('../services/notificationService');
const { resolveLocation } = require('../services/locationResolver');
const { queueIncidentPersonnelNotifications } = require('../services/incidentNotificationQueue');
const { getIo } = require('../services/socketService');

const GO_SERVICE_URL = process.env.GO_SERVICE_URL || 'http://go-worker:5002';


const getIncidentReporterInclude = () => [{
  model: User,
  attributes: ['full_name', 'email']
}];

const buildPagination = (page, limit, total) => {
  const pages = Math.ceil(total / limit);
  return { page, limit, total, pages, hasPrev: page > 1, hasNext: page < pages };
};

const getAllIncidentsQuery = () => ({
  include: getIncidentReporterInclude(),
  order: [['created_at', 'DESC']]
});


const createIncident = async (req, res) => {
  console.log('[createIncident] Called');

  try {
    const user_id = req.user.user_id;

    // validateUpload middleware already guards this, but belt-and-suspenders
    if (!req.file) {
      return res.status(400).json({ message: 'Video file is required' });
    }

    // Reverse-geocode coordinates — non-fatal if it fails
    let resolvedAddress = null;
    try {
      const locationData = await resolveLocation(req.body.latitude, req.body.longitude);
      resolvedAddress = locationData?.short || locationData?.full || null;
    } catch (geoError) {
      console.error('[createIncident] Location resolve failed:', geoError.message);
    }

    // Persist the incident immediately with a placeholder URL.
    // The Go worker will call back via /internal/video-complete to set the real URL.
    const incident = await Incident.create({
      user_id,
      video_url: 'processing',
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      address: resolvedAddress,
      status: 'pending'
    });

    await incident.reload();
    console.log('[createIncident] Incident created with ID:', incident.incident_id);

    // Hand off the video to the Go worker.
    // req.file.containerPath was set by validateUpload middleware 
    console.log('[createIncident] Incident created with ID:', incident.incident_id);

    axios.post(`${GO_SERVICE_URL}/process-video`, {
      incidentId: incident.incident_id,
      filePath: req.file.containerPath,
      originalName: req.file.originalname
    }).catch(err => console.error('[createIncident] Go worker unreachable:', err.message));

    console.log('[createIncident] Handed off to Go worker');

    try {
      await queueIncidentPersonnelNotifications(incident);
      console.log('[createIncident] Notifications queued');
    } catch (queueError) {
      console.error('[createIncident] Notification queue failed:', queueError.message);
      console.error('[createIncident] Notification queue stack:', queueError.stack);
    }

    console.log('[createIncident] Sending 201');
    return res.status(201).json(incident);

  } catch (err) {
    // Only clean up the uploaded file if the DB write itself failed.
    // If the DB succeeded, Go owns the file and will delete it after upload.
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('[createIncident] Fatal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};



// Called by the Go worker via PingExpressWebhook once the Azure upload completes.
// Route: POST /internal/video-complete
const finalizeIncidentVideo = async (req, res) => {
  try {
    const { incidentId, videoUrl } = req.body;

    const incident = await Incident.findById(incidentId);
    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    await incident.update({ video_url: videoUrl });

    console.log(`[finalizeIncidentVideo] Incident ${incidentId} video ready: ${videoUrl}`);

   
    //req.io.emit('video-uploaded', { incidentId, videoUrl });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[finalizeIncidentVideo] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};



const getIncidents = async (req, res) => {
  try {
    const hasPage = req.query.page !== undefined;
    const hasLimit = req.query.limit !== undefined;

    if (hasPage !== hasLimit) {
      return res.status(400).json({
        message: 'Both page and limit are required for paginated requests.'
      });
    }

    if (!hasPage && !hasLimit) {
      const incidents = await Incident.findAll(getAllIncidentsQuery());
      return res.json({ data: incidents });
    }

    let page = Math.max(1, parseInt(req.query.page, 10));
    let limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10)));

    if (Number.isNaN(page) || Number.isNaN(limit)) {
      return res.status(400).json({ message: 'page and limit must be valid numbers.' });
    }

    const { count, rows } = await Incident.findAndCountAll({
      include: getIncidentReporterInclude(),
      order: [['created_at', 'DESC']],
      limit,
      offset: (page - 1) * limit
    });

    res.json({ data: rows, pagination: buildPagination(page, limit, count) });
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

const getMyIncidents = async (req, res) => {
  try {
    let page = Math.max(1, parseInt(req.query.page, 10) || 1);
    let limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));

    const { count, rows } = await Incident.findAndCountAll({
      where: { user_id: req.user.user_id },
      order: [['created_at', 'DESC']],
      limit,
      offset: (page - 1) * limit
    });

    res.json({ data: rows, pagination: buildPagination(page, limit, count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getMyIncidentById = async (req, res) => {
  try {
    const incident = await Incident.findOne({
      where: { incident_id: req.params.incidentId, user_id: req.user.user_id }
    });

    if (!incident) return res.status(404).json({ message: 'Incident not found' });
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getIncidentById = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.incidentId, {
      include: getIncidentReporterInclude()
    });

    if (!incident) return res.status(404).json({ message: 'Incident not found' });
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



const updateIncidentStatus = async (req, res) => {
  try {
    const [updated] = await Incident.update(
      {
        status: req.body.status,
        acknowledged_at: req.body.status === 'acknowledged' ? new Date() : null,
        updated_at: new Date()
      },
      { where: { incident_id: req.params.incidentId } }
    );

    if (!updated) return res.status(404).json({ message: 'Incident not found' });

    await IncidentHistory.create({
      incident_id: req.params.incidentId,
      changed_by: req.user.security_personnel_id,
      status: req.body.status
    });

    const updatedIncident = await Incident.findById(req.params.incidentId);

    if (updatedIncident.status === 'acknowledged' && updatedIncident.user_id) {
      try {
        await createNotification({
          incident_id: updatedIncident.incident_id,
          user_id: updatedIncident.user_id,
          message: 'Your incident has been acknowledged. Help is on the way.',
          notification_type: 'incident_acknowledged'
        });
      } catch (notifErr) {
        console.error('[updateIncidentStatus] Notification failed:', notifErr.message);
      }
    }

    res.json(updatedIncident);
  } catch (err) {
    console.error('[updateIncidentStatus] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};



const deleteIncident = async (req, res) => {
  try {
    const deleted = await Incident.destroy({
      where: { incident_id: req.params.incidentId }
    });

    if (!deleted) return res.status(404).json({ message: 'Incident not found' });
    res.json({ message: 'Incident deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

module.exports = {
  createIncident,
  finalizeIncidentVideo,
  getIncidents,
  getAllIncidents,
  getMyIncidents,
  getMyIncidentById,
  getIncidentById,
  updateIncidentStatus,
  deleteIncident
};