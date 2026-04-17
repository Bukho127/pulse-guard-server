const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const bcrypt = require('bcrypt');

const PolicePersonnel = sequelize.define('PolicePersonnel', {
    security_personnel_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    full_name: {
        type: DataTypes.STRING,
        allowNull: false,
        required: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        required: true,
        validate: {
            isEmail: true
        }
    },
    badge_number: {
        type: DataTypes.STRING,
        unique: true,
        required: true
    },
    role_title: {
        type: DataTypes.STRING,
        required: true

    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
        required: true
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'security_personnel',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

PolicePersonnel.beforeCreate(async (personnel) => {
    if (personnel.password) {
        const salt = await bcrypt.genSalt(10);
        personnel.password = await bcrypt.hash(personnel.password, salt);
    }
});

PolicePersonnel.beforeUpdate(async (personnel) => {
    if (personnel.password) {
        const salt = await bcrypt.genSalt(10);
        personnel.password = await bcrypt.hash(personnel.password, salt);
    }
});



module.exports = PolicePersonnel;