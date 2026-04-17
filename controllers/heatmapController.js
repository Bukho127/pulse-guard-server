const { Op } = require('sequelize');
const Incident = require('../models/incidentModel');

const GRID_SIZE = 0.01;

const buildHeatmapData = (incidents) => {
  const heatmapGrid = {};

  incidents.forEach((incident) => {
    const lat = Math.floor(Number(incident.latitude) / GRID_SIZE) * GRID_SIZE;
    const lng = Math.floor(Number(incident.longitude) / GRID_SIZE) * GRID_SIZE;
    const key = `${lat},${lng}`;

    heatmapGrid[key] = (heatmapGrid[key] || 0) + 1;
  });

  return Object.entries(heatmapGrid).map(([coords, weight]) => {
    const [latitude, longitude] = coords.split(',');

    return {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      weight
    };
  });
};

const getAcknowledgedIncidents = async (where = {}) => {
  return Incident.findAll({
    attributes: ['latitude', 'longitude'],
    where: {
      status: 'acknowledged',
      ...where
    }
  });
};

const getHeatmapData = async (req, res) => {
  try {
    const incidents = await getAcknowledgedIncidents();
    res.json(buildHeatmapData(incidents));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getHeatmapByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    end.setHours(23, 59, 59, 999);

    const incidents = await getAcknowledgedIncidents({
      created_at: {
        [Op.between]: [start, end]
      }
    });

    res.json(buildHeatmapData(incidents));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getHeatmapData,
  getHeatmapByDateRange
};
