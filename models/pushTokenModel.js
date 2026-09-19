const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const PushToken = sequelize.define(
  "PushToken",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
      type: DataTypes.ENUM("user", "personnel"),
      allowNull: false,
      defaultValue: "user",
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

PushToken.getTokensForUser = async function (recipientType, recipientId) {
  if (!["user", "personnel"].includes(recipientType)) {
    throw new Error("recipientType must be 'user' or 'personnel'");
  }

  const idColumn =
    recipientType === "personnel" ? "security_personnel_id" : "user_id";

  const tokens = await PushToken.findAll({
    attributes: ["expoPushToken"],
    where: {
      recipient_type: recipientType,
      [idColumn]: recipientId,
    },
  });

  return tokens.map((token) => token.expoPushToken);
};

module.exports = PushToken;
