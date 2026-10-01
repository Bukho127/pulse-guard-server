const h3 = require('h3-js');
const Incident = require('../models/incidentModel');

const parseIntegerEnv = (value, fallback) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
};

const H3_RESOLUTION = Number(process.env.MOBILE_H3_RESOLUTION || 10);
const DEFAULT_AREA_H3_RESOLUTION = Math.max(H3_RESOLUTION - 2, 0);
const AREA_H3_RESOLUTION = Math.min(
  parseIntegerEnv(process.env.MOBILE_AREA_H3_RESOLUTION, DEFAULT_AREA_H3_RESOLUTION),
  H3_RESOLUTION
);
const H3_SEARCH_RADIUS = Number(process.env.MOBILE_H3_SEARCH_RADIUS || 3);
const TOP_AREA_LIMIT = parseIntegerEnv(process.env.MOBILE_TOP_AREA_LIMIT, 5);
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
  if (incident.h3_index && h3.isValidCell(incident.h3_index)) {
    return incident.h3_index;
  }

  const latitude = Number(incident.latitude);
  const longitude = Number(incident.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return h3.latLngToCell(latitude, longitude, H3_RESOLUTION);
};

const getAreaH3Index = (h3Index) => {
  if (!h3Index || !h3.isValidCell(h3Index)) {
    return null;
  }

  const resolution = h3.getResolution(h3Index);

  if (resolution === AREA_H3_RESOLUTION) {
    return h3Index;
  }

  if (resolution > AREA_H3_RESOLUTION) {
    return h3.cellToParent(h3Index, AREA_H3_RESOLUTION);
  }

  return h3Index;
};

const serializeArea = (h3Index, incidentCount, totalIncidentCount) => {
  const [latitude, longitude] = h3.cellToLatLng(h3Index);
  const boundary = h3.cellToBoundary(h3Index);

  return {
    h3Index,
    latitude,
    longitude,
    incidentCount,
    percentageOfTotal: totalIncidentCount
      ? Number(((incidentCount / totalIncidentCount) * 100).toFixed(2))
      : 0,
    boundary: boundary.map(([lat, lng]) => ({
      lat,
      lng
    }))
  };
};

const serializeDate = (value) => {
  if (!value) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
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

const buildIncidentHotspots = (incidents) => {
  return incidents.map((incident) => ({
    incident_id: incident.incident_id,
    latitude: Number(incident.latitude),
    longitude: Number(incident.longitude),
    status: incident.status,
    created_at: serializeDate(incident.created_at),
    h3Index: getIncidentH3Index(incident)
  }));
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

const buildRankedAreaCounts = (incidents) => {
  const countsByArea = new Map();

  incidents.forEach((incident) => {
    const incidentH3Index = getIncidentH3Index(incident);
    const areaH3Index = getAreaH3Index(incidentH3Index);

    if (!areaH3Index) {
      return;
    }

    countsByArea.set(areaH3Index, (countsByArea.get(areaH3Index) || 0) + 1);
  });

  let previousCount = null;
  let previousRank = 0;

  return Array.from(countsByArea.entries())
    .map(([areaH3Index, incidentCount]) => (
      serializeArea(areaH3Index, incidentCount, incidents.length)
    ))
    .sort((a, b) => {
      if (b.incidentCount !== a.incidentCount) {
        return b.incidentCount - a.incidentCount;
      }

      return a.h3Index.localeCompare(b.h3Index);
    })
    .map((area, index) => {
      if (area.incidentCount !== previousCount) {
        previousRank = index + 1;
        previousCount = area.incidentCount;
      }

      return {
        ...area,
        rank: previousRank
      };
    });
};

const buildAreaAnalytics = (userH3Index, localIncidents, allAcknowledgedIncidents) => {
  const userAreaH3Index = getAreaH3Index(userH3Index);
  const localAreas = buildRankedAreaCounts(localIncidents);
  const globalAreas = buildRankedAreaCounts(allAcknowledgedIncidents);
  const globalCurrentArea = globalAreas.find((area) => area.h3Index === userAreaH3Index);
  const localCurrentArea = localAreas.find((area) => area.h3Index === userAreaH3Index);
  const currentAreaBase = globalCurrentArea || serializeArea(userAreaH3Index, 0, allAcknowledgedIncidents.length);

  return {
    resolution: AREA_H3_RESOLUTION,
    currentArea: {
      ...currentAreaBase,
      rank: globalCurrentArea ? globalCurrentArea.rank : globalAreas.length + 1,
      localIncidentCount: localCurrentArea ? localCurrentArea.incidentCount : 0,
      localPercentageOfNearbyTotal: localIncidents.length && localCurrentArea
        ? Number(((localCurrentArea.incidentCount / localIncidents.length) * 100).toFixed(2))
        : 0
    },
    topAreas: globalAreas.slice(0, TOP_AREA_LIMIT),
    localAreas,
    totalAreasCompared: globalAreas.length,
    totalNearbyAreas: localAreas.length
  };
};

const getMobileCrimeAnalytics = async (h3Index) => {
  assertValidUserH3Index(h3Index);

  const searchedCells = h3.gridDisk(h3Index, H3_SEARCH_RADIUS);

  const [incidents, allAcknowledgedIncidents] = await Promise.all([
    Incident.findAll({
      attributes: ['incident_id', 'latitude', 'longitude', 'status', 'created_at', 'h3_index'],
      where: {
        status: 'acknowledged',
        h3_index: {
          $in: searchedCells
        }
      }
    }),
    Incident.findAll({
      attributes: ['incident_id', 'latitude', 'longitude', 'h3_index'],
      where: {
        status: 'acknowledged'
      }
    })
  ]);
  const localIncidents = incidents;

  const totalIncidentCount = localIncidents.length;

  return {
    type: 'mobile-crime-analytics',
    h3Index,
    resolution: H3_RESOLUTION,
    searchRadius: H3_SEARCH_RADIUS,
    searchedCells,
    totalIncidentCount,
    riskRank: getRiskRank(totalIncidentCount),
    areaAnalytics: buildAreaAnalytics(h3Index, localIncidents, allAcknowledgedIncidents),
    localCrimePoints: buildLocalCrimePoints(localIncidents),
    cellCounts: buildCellCounts(localIncidents),
    hotspots: buildIncidentHotspots(localIncidents)
  };
};

module.exports = {
  getMobileCrimeAnalytics
};
