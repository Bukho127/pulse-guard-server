const express = require('express');
const { 
    getHeatmapData, 
    getHeatmapByDateRange,  
    getHeatmapByMonth, 
    getOSRMRoute 
} = require('../controllers/heatmapController');

const { 
    protect, 
    authorizePersonnel 
} = require('../middleware/authMiddleware');

const router = express.Router();

// Get all heatmap data (general)
// Usage: GET /heatmap
router.get('/heatmap', protect, authorizePersonnel, getHeatmapData);

// Get heatmap by date range
// Usage: GET /heatmap/range?startDate=2026-01-01&endDate=2026-06-30
router.get('/heatmap/range', protect, authorizePersonnel, getHeatmapByDateRange);

// Get heatmap by month (most specific)
// Usage: GET /heatmap/month?month=2026-06
router.get('/heatmap/month', protect, authorizePersonnel, getHeatmapByMonth);

// Get OSRM route
// Usage: GET /heatmap/route?startLng=18.4232&startLat=-33.9249&endLng=18.4241&endLat=-33.9258
router.get('/heatmap/route', protect, authorizePersonnel, getOSRMRoute);

module.exports = router;

