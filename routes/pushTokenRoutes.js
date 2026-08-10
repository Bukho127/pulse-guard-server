const express = require("express");
const router = express.Router();
const pushTokenController = require("../controllers/pushTokenController");
const { protect } = require("../middleware/authMiddleware");

router.post("/", protect, pushTokenController.saveToken);
router.delete("/:expoPushToken", protect, pushTokenController.removeToken);

module.exports = router;