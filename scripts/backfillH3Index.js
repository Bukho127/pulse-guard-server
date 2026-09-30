const h3 = require('h3-js');
const { sequelize } = require('../config/db');
const Incident = require('../models/incidentModel');

const H3_RESOLUTION = Number(process.env.MOBILE_H3_RESOLUTION || 10);

const INDEXES = [
  {
    name: 'idx_incidents_status_h3_index',
    columns: ['status', 'h3_index']
  },
  {
    name: 'idx_incidents_status_created_at',
    columns: ['status', 'created_at']
  }
];

const quoteIdentifier = (identifier) => {
  return `\`${identifier.replace(/`/g, '``')}\``;
};

const hasIndex = async (indexName) => {
  const rows = await sequelize.query(
    'SHOW INDEX FROM `incidents` WHERE Key_name = ?',
    {
      replacements: [indexName],
      type: sequelize.QueryTypes.SELECT
    }
  );

  return rows.length > 0;
};

const ensureIndex = async ({ name, columns }) => {
  if (await hasIndex(name)) {
    console.log(`Index already exists: ${name}`);
    return;
  }

  const columnSql = columns.map(quoteIdentifier).join(', ');
  await sequelize.query(
    `ALTER TABLE \`incidents\` ADD INDEX ${quoteIdentifier(name)} (${columnSql})`
  );
  console.log(`Created index: ${name}`);
};

const backfillMissingH3Indexes = async () => {
  const incidents = await Incident.findAll({
    attributes: ['incident_id', 'latitude', 'longitude', 'h3_index'],
    where: {
      $or: [
        { h3_index: null },
        { h3_index: '' }
      ]
    }
  });

  let updatedCount = 0;
  let skippedCount = 0;

  for (const incident of incidents) {
    const latitude = Number(incident.latitude);
    const longitude = Number(incident.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      skippedCount += 1;
      continue;
    }

    const h3Index = h3.latLngToCell(latitude, longitude, H3_RESOLUTION);

    await Incident.update(
      { h3_index: h3Index },
      { where: { incident_id: incident.incident_id } }
    );
    updatedCount += 1;
  }

  console.log(`Backfilled h3_index for ${updatedCount} incidents`);

  if (skippedCount > 0) {
    console.log(`Skipped ${skippedCount} incidents with invalid coordinates`);
  }
};

const main = async () => {
  try {
    await sequelize.authenticate();
    await backfillMissingH3Indexes();

    for (const index of INDEXES) {
      await ensureIndex(index);
    }
  } finally {
    await sequelize.close();
  }
};

main().catch((error) => {
  console.error('Failed to backfill incident H3 indexes:', error.message);
  process.exit(1);
});
