const PushToken = require("../models/pushTokenModel");

exports.saveToken = async (req, res) => {
  const { token: expoPushToken } = req.body;

  if (!expoPushToken) {
    return res.status(400).json({ error: "expoPushToken is required" });
  }

  const isPersonnel = req.user.role === "personnel";

  try {
    await PushToken.upsert({
      user_id: isPersonnel ? null : req.user.user_id,
      security_personnel_id: isPersonnel ? req.user.security_personnel_id : null,
      recipient_type: isPersonnel ? "personnel" : "user",
      expoPushToken,
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to save push token:", error);
    res.status(500).json({ error: "Failed to save push token" });
  }
};

exports.removeToken = async (req, res) => {
  try {
    await PushToken.destroy({
      where: { expoPushToken: req.params.expoPushToken },
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to remove push token:", error);
    res.status(500).json({ error: "Failed to remove push token" });
  }
};