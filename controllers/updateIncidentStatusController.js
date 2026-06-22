const IncidentHistory = require('../models/incidentHistoryModel');  // ← Capital I

const updateIncidentStatus = async (req, res) => {
  try {
    console.log('Updating incident:', req.params.incidentId, 'to status:', req.body.status);
    
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
    try {
      await IncidentHistory.create({
        incident_id: req.params.incidentId,
        changed_by: req.user.security_personnel_id,
        status: req.body.status
      });
      console.log('History record created');
    } catch (historyError) {
      console.error('History creation error:', historyError.message);
      throw historyError;
    }

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