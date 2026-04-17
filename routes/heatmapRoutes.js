const express = require('express');
const { getHeatmapData, getHeatmapByDateRange } = require('../controllers/heatmapController');
const { protect, authorizePersonnel } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/heatmap', protect, authorizePersonnel, getHeatmapData);
router.get('/heatmap/range', protect, authorizePersonnel, getHeatmapByDateRange);

module.exports = router;