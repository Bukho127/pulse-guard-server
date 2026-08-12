const { DataTypes } = require('sequelize');
const h3 = require('h3-js');
const { sequelize } = require('../config/db');

const H3_RESOLUTION = Number(process.env.MOBILE_H3_RESOLUTION || 10);

const Incident = sequelize.define('Incident', {
  incident_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'user_id'
    }
  },
  video_url: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false
  },
  address: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  h3_index: {
    type: DataTypes.STRING(15),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'acknowledged', 'dismissed'),
    defaultValue: 'pending',
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  acknowledged_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'incidents',
  timestamps: false,
  hooks: {
    beforeSave: (incident) => {
      const latitude = Number(incident.latitude);
      const longitude = Number(incident.longitude);

      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        incident.h3_index = h3.latLngToCell(latitude, longitude, H3_RESOLUTION);
      }
    }
  }
});

module.exports = Incident;