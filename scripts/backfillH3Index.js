const { Op } = require('sequelize');

const getMobileCrimeAnalytics = async (h3Index) => {
  assertValidUserH3Index(h3Index);

  const searchedCells = h3.gridDisk(h3Index, 1);

  const localIncidents = await Incident.findAll({
    attributes: ['incident_id', 'latitude', 'longitude', 'status', 'created_at'],
    where: {
      status: 'acknowledged',
      h3_index: { [Op.in]: searchedCells }
    }
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