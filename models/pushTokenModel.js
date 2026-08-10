const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./userModel");

const PushToken = sequelize.define(
  "PushToken",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    expoPushToken: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: "expo_push_token",
    },
  },
  {
    tableName: "push_tokens",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  },
);

module.exports = PushToken;