const h3 = require('h3-js');
const Incident = require('../models/incidentModel');

const H3_RESOLUTION = Number(process.env.MOBILE_H3_RESOLUTION || 10);
const MODERATE_RISK_MIN = Number(process.env.MOBILE_MODERATE_RISK_MIN || 5);
const CRITICAL_RISK_MIN = Number(process.env.MOBILE_CRITICAL_RISK_MIN || 15);

const createClientError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getRiskRank = (incidentCount) => {
  if (incidentCount >= CRITICAL_RISK_MIN) {
    return 'Critical Risk';
  }

  if (incidentCount >= MODERATE_RISK_MIN) {
    return 'Moderate Risk';
  }

  return 'Low Risk';
};

const assertValidUserH3Index = (h3Index) => {
  if (!h3Index || typeof h3Index !== 'string') {
    throw createClientError('h3Index is required');
  }

  if (!h3.isValidCell(h3Index)) {
    throw createClientError('Invalid H3 index');
  }

  const resolution = h3.getResolution(h3Index);

  if (resolution !== H3_RESOLUTION) {
    throw createClientError(`H3 index must use resolution ${H3_RESOLUTION}`);
  }
};

const getIncidentH3Index = (incident) => {
  const latitude = Number(incident.latitude);
  const longitude = Number(incident.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return h3.latLngToCell(latitude, longitude, H3_RESOLUTION);
};

const buildLocalCrimePoints = (incidents) => {
  const pointsByCoordinate = new Map();

  incidents.forEach((incident) => {
    const latitude = Number(incident.latitude);
    const longitude = Number(incident.longitude);
    const key = `${latitude},${longitude}`;
    const existingPoint = pointsByCoordinate.get(key);

    if (existingPoint) {
      existingPoint.count += 1;
      existingPoint.incidentIds.push(incident.incident_id);
      return;
    }

    pointsByCoordinate.set(key, {
      latitude,
      longitude,
      count: 1,
      incidentIds: [incident.incident_id]
    });
  });

  return Array.from(pointsByCoordinate.values());
};

const buildCellCounts = (incidents) => {
  const countsByCell = new Map();

  incidents.forEach((incident) => {
    const h3Index = getIncidentH3Index(incident);

    if (!h3Index) {
      return;
    }

    countsByCell.set(h3Index, (countsByCell.get(h3Index) || 0) + 1);
  });

  return Array.from(countsByCell.entries()).map(([h3Index, count]) => ({
    h3Index,
    count
  }));
};

const getMobileCrimeAnalytics = async (h3Index) => {
  assertValidUserH3Index(h3Index);

  const searchedCells = h3.gridDisk(h3Index, 1);
  const searchedCellSet = new Set(searchedCells);

  const incidents = await Incident.findAll({
    attributes: ['incident_id', 'latitude', 'longitude', 'status', 'created_at'],
    where: {
      status: 'acknowledged'
    }
  });

  const localIncidents = incidents.filter((incident) => {
    const incidentH3Index = getIncidentH3Index(incident);
    return incidentH3Index && searchedCellSet.has(incidentH3Index);
  });

  const totalIncidentCount = localIncidents.length;

  return {
    type: 'mobile-crime-analytics',
    h3Index,
    resolution: H3_RESOLUTION,
    searchedCells,
    totalIncidentCount,
    riskRank: getRiskRank(totalIncidentCount),
    localCrimePoints: buildLocalCrimePoints(localIncidents),
    cellCounts: buildCellCounts(localIncidents)
  };
};

module.exports = {
  getMobileCrimeAnalytics
};
