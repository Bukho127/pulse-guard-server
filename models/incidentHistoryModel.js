const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const IncidentHistory = sequelize.define('IncidentHistory', {
  history_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  incident_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'incidents',
      key: 'incident_id'
    }
  },
  changed_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'security_personnel',
      key: 'security_personnel_id'
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'acknowledged', 'dismissed'),
    allowNull: false
  },
  changed_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'incident_status_history',
  timestamps: false
});

module.exports = IncidentHistory;