const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const bcrypt = require('bcrypt');

const PolicePersonnel = sequelize.define('PolicePersonnel', {
    security_personnel_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        field: 'name',
        type: DataTypes.STRING,
        allowNull: false,
        required: true
    },
    surname: {
        field: 'surname',
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
    force_number: {
        // persisted column name matches DB
        field: 'force_number',
        type: DataTypes.STRING,
        unique: true,
        allowNull: true,
        required: false,
        set(value) {
            if (!value && value !== '') return this.setDataValue('force_number', value);
            const digits = String(value).replace(/\D/g, '');
            const formatted = digits.length > 1 ? (digits.length > 7 ? digits.slice(0, 7) + '-' + digits.slice(7, 8) : digits) : digits;
            this.setDataValue('force_number', formatted);
        },
        validate: {
            is: {
                args: /^[0-9]{7}-[0-9]{1}$/,
                msg: 'force_number must match the format 1234567-8'
            }
        }
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
    updatedAt: 'updated_at',
    defaultScope: {
        attributes: { exclude: ['password'] }
    },
    scopes: {
        withPassword: {
            attributes: { include: ['password'] }
        }
    }
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
