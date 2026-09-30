const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const EmailVerificationOtp = sequelize.define('EmailVerificationOtp', {
  id: {
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
  email: {
    type: DataTypes.STRING(150),
    allowNull: false,
    set(value) {
      this.setDataValue('email', String(value || '').trim().toLowerCase());
    }
  },
  otp_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  attempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  consumed_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'email_verification_otps',
  timestamps: false,
  indexes: [
    {
      name: 'idx_email_verification_otps_email_consumed',
      fields: ['email', 'consumed_at']
    },
    {
      name: 'idx_email_verification_otps_user_id',
      fields: ['user_id']
    }
  ]
});

module.exports = EmailVerificationOtp;
