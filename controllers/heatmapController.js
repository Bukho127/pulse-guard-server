const { Op } = require('sequelize');
const h3 = require('h3-js');
const chroma = require('chroma-js');
const Incident = require('../models/incidentModel');

const H3_RESOLUTION = 10; // Adjust: 12 = ~1km, 13 = ~250m, 14 = ~65m
const colorScale = chroma.scale(['green', 'yellow', 'orange', 'red']).domain([0, 15]);
const CAPE_TOWN_BOUNDS = {
  minLat: -34.4,
  maxLat: -33.5,
  minLng: 18.2,
  maxLng: 19.0
};

const hasValidCoordinates = (incident) => {
  const latitude = Number(incident.latitude);
  const longitude = Number(incident.longitude);

  return Number.isFinite(latitude) && Number.isFinite(longitude);
};

const isWithinCapeTownBounds = (incident) => {
  if (!hasValidCoordinates(incident)) {
    return false;
  }

  const latitude = Number(incident.latitude);
  const longitude = Number(incident.longitude);

  return latitude >= CAPE_TOWN_BOUNDS.minLat
    && latitude <= CAPE_TOWN_BOUNDS.maxLat
    && longitude >= CAPE_TOWN_BOUNDS.minLng
    && longitude <= CAPE_TOWN_BOUNDS.maxLng;
};

const getIncidentCoordinateDebugFields = (incident) => ({
  incident_id: incident.incident_id,
  address: incident.address,
  latitude: incident.latitude,
  longitude: incident.longitude,
  coordinates: incident.coordinates || null,
  location: incident.location || null,
  city: incident.city || null,
  province: incident.province || null
});

const buildHeatmapMetadata = (incidents, heatmapFeatures, extra = {}) => ({
  totalIncidents: incidents.length,
  incidentsInsideCapeTownBounds: incidents.filter(isWithinCapeTownBounds).length,
  incidentsOutsideCapeTownBounds: incidents.filter((incident) => !isWithinCapeTownBounds(incident)).length,
  totalHexagons: heatmapFeatures.length,
  ...extra,
  resolution: H3_RESOLUTION,
  colorScale: 'greenâ†’yellowâ†’orangeâ†’red'
});

const logHeatmapDiagnostics = (label, incidents, features, metadata = {}) => {
  const validCoordinateCount = incidents.filter(hasValidCoordinates).length;
  const insideCapeTownBoundsCount = incidents.filter(isWithinCapeTownBounds).length;
  const outsideCapeTownBounds = incidents
    .filter((incident) => !isWithinCapeTownBounds(incident))
    .map(getIncidentCoordinateDebugFields);
  const uniqueH3Indexes = new Set(features.map((feature) => feature.h3Index));
  const boundaryPoints = features.flatMap((feature) => feature.boundary || []);
  const bounds = boundaryPoints.reduce((acc, point) => {
    const lat = Number(point.lat);
    const lng = Number(point.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return acc;
    }

    return {
      minLat: Math.min(acc.minLat, lat),
      maxLat: Math.max(acc.maxLat, lat),
      minLng: Math.min(acc.minLng, lng),
      maxLng: Math.max(acc.maxLng, lng)
    };
  }, {
    minLat: Infinity,
    maxLat: -Infinity,
    minLng: Infinity,
    maxLng: -Infinity
  });

  console.log(`[HEATMAP DEBUG] ${label}`, {
    totalIncidentsQueried: incidents.length,
    incidentCoordinateRows: incidents.map(getIncidentCoordinateDebugFields),
    validCoordinateCount,
    insideCapeTownBoundsCount,
    outsideCapeTownBoundsCount: outsideCapeTownBounds.length,
    outsideCapeTownBounds,
    uniqueH3IndexesCount: uniqueH3Indexes.size,
    finalFeaturesLength: features.length,
    metadataTotalHexagons: metadata.totalHexagons,
    featuresLengthMatchesMetadata: metadata.totalHexagons === undefined
      ? 'metadata.totalHexagons not present'
      : features.length === metadata.totalHexagons,
    sampleFeatures: features.slice(0, 5).map((feature) => ({
      h3Index: feature.h3Index,
      count: feature.count,
      intensity: feature.intensity,
      color: feature.color,
      boundaryLength: Array.isArray(feature.boundary) ? feature.boundary.length : null
    })),
    boundaryBounds: boundaryPoints.length ? bounds : null
  });
};

// Build H3-based heatmap with smooth colors
const buildHeatmapData = (incidents) => {
  const incidentsByHex = {};

  const drawableIncidents = incidents.filter(isWithinCapeTownBounds);

  console.log("================================");
  console.log("Drawable incidents:", drawableIncidents.length);

  drawableIncidents.forEach((incident) => {
    const lat = Number(incident.latitude);
    const lng = Number(incident.longitude);

    const h3Index = h3.latLngToCell(lat, lng, H3_RESOLUTION);

    console.log({
      incidentId: incident.incident_id,
      lat,
      lng,
      h3Index
    });

    if (!incidentsByHex[h3Index]) {
      incidentsByHex[h3Index] = [];
    }

    incidentsByHex[h3Index].push(incident);
  });

  console.log("======= HEX SUMMARY =======");

  Object.entries(incidentsByHex).forEach(([hex, list]) => {
    console.log(hex, "=>", list.length);
  });

  console.log("===========================");

  return Object.entries(incidentsByHex).map(([h3Index, hexIncidents]) => {

    const count = hexIncidents.length;

    const boundary = h3.cellToBoundary(h3Index);
    const center = h3.cellToLatLng(h3Index);

    return {
      h3Index,
      latitude: center[0],
      longitude: center[1],
      count,
      weight: count,
      color: colorScale(count).hex(),
      intensity: Math.min(count / 15, 1),
      boundary: boundary.map(([lat, lng]) => ({
        lat,
        lng
      }))
    };

  });

};

const getAcknowledgedIncidents = async (where = {}) => {
  return Incident.findAll({
    attributes: ['incident_id', 'address', 'latitude', 'longitude'],
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
    const heatmapFeatures = buildHeatmapData(incidents);
    logHeatmapDiagnostics('GET /heatmap', incidents, heatmapFeatures);
    res.json({
      type: 'heatmap',
      features: heatmapFeatures,
      metadata: {
        totalIncidents: incidents.length,
        incidentsInsideCapeTownBounds: incidents.filter(isWithinCapeTownBounds).length,
        incidentsOutsideCapeTownBounds: incidents.filter((incident) => !isWithinCapeTownBounds(incident)).length,
        totalHexagons: heatmapFeatures.length,
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
    const heatmapFeatures = buildHeatmapData(incidents);
    logHeatmapDiagnostics('GET /heatmap/range', incidents, heatmapFeatures);

    res.json({
      type: 'heatmap',
      features: heatmapFeatures,
      metadata: {
        totalIncidents: incidents.length,
        incidentsInsideCapeTownBounds: incidents.filter(isWithinCapeTownBounds).length,
        incidentsOutsideCapeTownBounds: incidents.filter((incident) => !isWithinCapeTownBounds(incident)).length,
        totalHexagons: heatmapFeatures.length,
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

    console.log("========== OSRM ROUTE REQUEST ==========");
    console.log({
      startLng,
      startLat,
      endLng,
      endLat
    });

    if (!startLng || !startLat || !endLng || !endLat) {
      return res.status(400).json({
        error: "startLng, startLat, endLng and endLat are required"
      });
    }

    const OSRM_BASE_URL =
      process.env.OSRM_URL || "http://host.docker.internal:5000";

    const url =
      `${OSRM_BASE_URL}/route/v1/driving/` +
      `${startLng},${startLat};${endLng},${endLat}` +
      `?geometries=geojson&overview=full`;

    console.log("OSRM_BASE_URL:", OSRM_BASE_URL);
    console.log("OSRM URL:", url);

    const response = await fetch(url, {
      headers: {
        "ngrok-skip-browser-warning": "true",
        "User-Agent": "PulseGuard/1.0",
        "Accept": "application/json"
      }
    })
    console.log("OSRM_BASE_URL:", OSRM_BASE_URL);
    console.log("OSRM URL:", url);
    console.log("Status:", response.status);
    console.log("Content-Type:", response.headers.get("content-type"));
    console.log(
      "OSRM response content-type:",
      response.headers.get("content-type")
    );

    const body = await response.text();

    console.log("========== OSRM RAW RESPONSE ==========");
    console.log(body.substring(0, 500));
    console.log("=======================================");

    if (!response.ok) {
      return res.status(response.status).json({
        error: `OSRM returned ${response.status}`,
        url,
        body: body.substring(0, 500)
      });
    }

    let data;

    try {
      data = JSON.parse(body);
    } catch (err) {
      return res.status(500).json({
        error: "OSRM did not return valid JSON",
        url,
        body: body.substring(0, 500)
      });
    }

    console.log("OSRM JSON:", JSON.stringify(data));

    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      return res.status(400).json({
        error: `No route found: ${data.code}`,
        data
      });
    }

    return res.json(data.routes[0].geometry);

  } catch (err) {
    console.error("OSRM controller error:", err);

    return res.status(500).json({
      error: err.message
    });
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
    const metadata = {
      totalHexagons: heatmapFeatures.length
    };

    logHeatmapDiagnostics('GET /heatmap/month', incidents, heatmapFeatures, metadata);

    res.json({
      type: 'heatmap',
      features: heatmapFeatures,
      metadata: {
        totalIncidents: incidents.length,
        incidentsInsideCapeTownBounds: incidents.filter(isWithinCapeTownBounds).length,
        incidentsOutsideCapeTownBounds: incidents.filter((incident) => !isWithinCapeTownBounds(incident)).length,
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
