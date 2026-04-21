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

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    security_personnel_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    recipient_type: {
      type: DataTypes.ENUM('user', 'personnel'),
      allowNull: false,
    },

    notification_type: {
      type: DataTypes.ENUM('general', 'incident_acknowledged', 'personnel_nearby'),
      allowNull: false,
      defaultValue: 'general',
    },

    message: {
      type: DataTypes.VIRTUAL,
      set(value) {
        this.setDataValue('message', value);
      },
      get() {
        return this.getDataValue('message');
      }
    },

    message_encrypted: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },

    message_iv: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },

    message_auth_tag: {
      type: DataTypes.STRING(32),
      allowNull: true,
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
    underscored: true,
  }
);

module.exports = Notification;
