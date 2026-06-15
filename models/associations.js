// This file defines the associations between the models in the application using Sequelize ORM.
//the associations are defined in a way that reflects the relationships between the entities in the database.

const User = require('./userModel');
const PolicePersonnel = require('./policePersonnelModel');
const Incident = require('./incidentModel');
const IncidentHistory = require('./incidentHistoryModel');
const Notification = require('./notificationModel');

// User  Incident
User.hasMany(Incident, { foreignKey: 'user_id' });
Incident.belongsTo(User, { foreignKey: 'user_id' });

// PolicePersonnel  IncidentHistory
PolicePersonnel.hasMany(IncidentHistory, { foreignKey: 'changed_by' });
IncidentHistory.belongsTo(PolicePersonnel, { foreignKey: 'changed_by' });

// Incident  IncidentHistory
Incident.hasMany(IncidentHistory, { foreignKey: 'incident_id' });
IncidentHistory.belongsTo(Incident, { foreignKey: 'incident_id' });
// User  Notification
User.hasMany(Notification, { foreignKey: 'user_id' });
Notification.belongsTo(User, { foreignKey: 'user_id' });
// PolicePersonnel  Notification
PolicePersonnel.hasMany(Notification, { foreignKey: 'security_personnel_id' });
Notification.belongsTo(PolicePersonnel, { foreignKey: 'security_personnel_id' });

module.exports = { User, PolicePersonnel, Incident, IncidentHistory, Notification };