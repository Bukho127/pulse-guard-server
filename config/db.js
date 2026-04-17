const { Sequelize } = require('sequelize');
require('dotenv').config();

// 1. CREATE sequelize FIRST
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'mysql',
        logging: false
    }
);

// 2. CONNECT DB
const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('MySQL Connected via Sequelize!');
        return true;
    } catch (error) {
        console.error('Connection failed:', error.message);
        return false;
    }
};

// 3. EXPORT
module.exports = { sequelize, connectDB };