const { sequelize } = require('../config/db');
require('../models/associations');

const PolicePersonnel = require('../models/policePersonnelModel');

const normalizeForceNumber = (value) => {
  if (!value) return value;
  const digits = String(value).replace(/\D/g, '');
  return digits.length === 8 ? `${digits.slice(0, 7)}-${digits.slice(7)}` : String(value);
};

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`${name} is required to seed the dashboard personnel account`);
  }
  return String(value).trim();
};

const getSeedData = () => ({
  name: process.env.SEED_PERSONNEL_NAME || 'Dashboard',
  surname: process.env.SEED_PERSONNEL_SURNAME || 'Personnel',
  email: process.env.SEED_PERSONNEL_EMAIL || 'dashboard.personnel@pulseguard.local',
  force_number: normalizeForceNumber(process.env.SEED_PERSONNEL_FORCE_NUMBER || '0000000-1'),
  role_title: process.env.SEED_PERSONNEL_ROLE_TITLE || 'Dashboard Administrator',
  password: requiredEnv('SEED_PERSONNEL_PASSWORD')
});

const shouldUpdateExisting = () => {
  const value = process.env.SEED_PERSONNEL_UPDATE_EXISTING;
  return value ? value.toLowerCase() !== 'false' : true;
};

const seedPersonnelDashboard = async () => {
  const seedData = getSeedData();

  await sequelize.authenticate();
  await sequelize.sync();

  const existingByForceNumber = await PolicePersonnel.scope('withPassword').findOne({
    where: { force_number: seedData.force_number }
  });

  const existingByEmail = await PolicePersonnel.scope('withPassword').findOne({
    where: { email: seedData.email }
  });

  if (
    existingByForceNumber &&
    existingByEmail &&
    existingByForceNumber.security_personnel_id !== existingByEmail.security_personnel_id
  ) {
    throw new Error(
      `Seed force number ${seedData.force_number} and email ${seedData.email} belong to different personnel records`
    );
  }

  const existing = existingByForceNumber || existingByEmail;

  if (!existing) {
    const officer = await PolicePersonnel.create(seedData);
    console.log(`Seeded dashboard personnel account: ${officer.force_number} (${officer.email})`);
    return;
  }

  if (!shouldUpdateExisting()) {
    console.log(`Dashboard personnel account already exists: ${existing.force_number} (${existing.email})`);
    return;
  }

  await existing.update(seedData);
  console.log(`Updated dashboard personnel account: ${seedData.force_number} (${seedData.email})`);
};

seedPersonnelDashboard()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Dashboard personnel seed failed:', error.message);
    await sequelize.close().catch(() => {});
    process.exit(1);
  });
