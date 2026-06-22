const { Op } = require('sequelize');
const h3 = require('h3-js');
const chroma = require('chroma-js');
const Incident = require('../models/incidentModel');

const H3_RESOLUTION = 10; // Adjust: 12 = ~1km, 13 = ~250m, 14 = ~65m
const colorScale = chroma.scale(['green', 'yellow', 'orange', 'red']).domain([0, 15]);

// Build H3-based heatmap with smooth colors
const buildHeatmapData = (incidents) => {
  const incidentsByHex = {};

  // Bin incidents into H3 hexagons
  incidents.forEach((incident) => {
    const h3Index = h3.latLngToCell(
      Number(incident.latitude),
      Number(incident.longitude),
      H3_RESOLUTION
    );

    if (!incidentsByHex[h3Index]) {
      incidentsByHex[h3Index] = [];
    }
    incidentsByHex[h3Index].push(incident);
  });

  // Convert to features with smooth colors
  return Object.entries(incidentsByHex).map(([h3Index, hexIncidents]) => {
    const count = hexIncidents.length;
    const color = colorScale(count).hex(); // Smooth gradient color
    const center = h3.cellToLatLng(h3Index);
    const boundary = h3.cellToBoundary(h3Index);

    return {
      h3Index: h3Index,
      latitude: center[0],
      longitude: center[1],
      count: count,
      weight: count, // Keep 'weight' for backward compatibility
      color: color, // Smooth color for map rendering
      intensity: Math.min(count / 15, 1), // Normalized 0-1 for opacity
      boundary: boundary.map(([lat, lng]) => ({ lat, lng })) // Hex polygon for mapping
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

// Get all heatmap data
const getHeatmapData = async (req, res) => {
  try {
    const incidents = await getAcknowledgedIncidents();
    res.json({
      type: 'heatmap',
      features: buildHeatmapData(incidents),
      metadata: {
        totalIncidents: incidents.length,
        resolution: H3_RESOLUTION,
        colorScale: 'green→yellow→orange→red'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get heatmap by date range
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

    end.setHours(23, 59, 59, 999); // Include the entire end date

    const incidents = await getAcknowledgedIncidents({
      created_at: {
        $between: [start, end]
      }
    });

    res.json({
      type: 'heatmap',
      features: buildHeatmapData(incidents),
      metadata: {
        totalIncidents: incidents.length,
        startDate: startDate,
        endDate: endDate,
        resolution: H3_RESOLUTION,
        colorScale: 'green→yellow→orange→red'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getOSRMRoute = async (req, res) => {
  try {
    const { startLng, startLat, endLng, endLat } = req.query;
    console.log('OSRM route request:', { startLng, startLat, endLng, endLat });

    if (!startLng || !startLat || !endLng || !endLat) {
      return res.status(400).json({ error: 'startLng, startLat, endLng, endLat are required' });
    }

    const url = `http://host.docker.internal:5000/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?geometries=geojson&overview=full`
    console.log('Calling OSRM URL:', url);

    const response = await fetch(url);
    console.log('OSRM response status:', response.status);

    const data = await response.json();
    console.log('OSRM response data:', JSON.stringify(data));

    if (data.code !== 'Ok' || !data.routes?.length) {
      return res.status(400).json({ error: `No route found: ${data.code}` });
    }

    res.json(data.routes[0].geometry);
  } catch (err) {
    console.error('OSRM controller error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Optional: Get heatmap by month (for convenience)
const getHeatmapByMonth = async (req, res) => {
  try {
    const { month } = req.query; // Format: '2026-06'

    if (!month || !month.match(/^\d{4}-\d{2}$/)) {
      return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM' });
    }

    const [year, monthNum] = month.split('-');
    const start = new Date(year, monthNum - 1, 1);
    const end = new Date(year, monthNum, 0, 23, 59, 59, 999);

    const incidents = await getAcknowledgedIncidents({
      created_at: {
        $between: [start, end]
      }
    });

    const heatmapFeatures = buildHeatmapData(incidents);

    res.json({
      type: 'heatmap',
      features: heatmapFeatures,
      metadata: {
        totalIncidents: incidents.length,
        totalHexagons: heatmapFeatures.length,
        month: month,
        resolution: H3_RESOLUTION,
        colorScale: 'green→yellow→orange→red'
      }
    });
  } catch (err) {
     console.error('HEATMAP ERROR:', err.message)
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getHeatmapData,
  getHeatmapByDateRange,
  getHeatmapByMonth,
  getOSRMRoute
};