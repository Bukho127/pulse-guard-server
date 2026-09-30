const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const ensureAuthSchema = async () => {
  const queryInterface = sequelize.getQueryInterface();

  try {
    const usersTable = await queryInterface.describeTable('users');
    if (!usersTable.email_verified) {
      await queryInterface.addColumn('users', 'email_verified', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
      console.log('Added users.email_verified column');
    }
  } catch (error) {
    const tableMissing = error?.original?.code === 'ER_NO_SUCH_TABLE'
      || /no such table|doesn't exist|Unknown table|No description found/i.test(error.message);

    if (!tableMissing) {
      throw error;
    }
  }
};

module.exports = {
  ensureAuthSchema
};
