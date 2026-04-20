const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');


const Notification = sequelize.define(
  'Notification',
  {
    notification_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    incident_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    security_personnel_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM('sent', 'read'),
      defaultValue: 'sent',
    },

    sent_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'notifications',
    timestamps: false,
  }
);

module.exports = Notification;
