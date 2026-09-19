const h3 = require('h3-js');

const { sequelize } = require('../config/db');
require('../models/associations');

const User = require('../models/userModel');
const Incident = require('../models/incidentModel');

const H3_RESOLUTION = Number(process.env.MOBILE_H3_RESOLUTION || 10);

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`${name} is required to seed demo Cape Town users`);
  }
  return String(value).trim();
};

const DEMO_USER_PASSWORD = requiredEnv('DEMO_USER_PASSWORD');
const DEMO_EMAIL_DOMAIN = process.env.DEMO_USER_EMAIL_DOMAIN || 'pulseguard.demo';

const demoUsers = [
  { full_name: 'Demo User One', email: `demo.user.one@${DEMO_EMAIL_DOMAIN}` },
  { full_name: 'Demo User Two', email: `demo.user.two@${DEMO_EMAIL_DOMAIN}` },
  { full_name: 'Demo User Three', email: `demo.user.three@${DEMO_EMAIL_DOMAIN}` },
  { full_name: 'Demo User Four', email: `demo.user.four@${DEMO_EMAIL_DOMAIN}` },
  { full_name: 'Demo User Five', email: `demo.user.five@${DEMO_EMAIL_DOMAIN}` },
  { full_name: 'Demo User Six', email: `demo.user.six@${DEMO_EMAIL_DOMAIN}` }
];

const demoIncidentLocations = [
  {
    key: 'cape-town-station-repeat-a',
    userIndex: 0,
    latitude: -33.922087,
    longitude: 18.425370,
    address: 'Cape Town Station, Cape Town CBD'
  },
  {
    key: 'cape-town-station-repeat-b',
    userIndex: 1,
    latitude: -33.922087,
    longitude: 18.425370,
    address: 'Cape Town Station, Cape Town CBD'
  },
  {
    key: 'cape-town-station-repeat-c',
    userIndex: 2,
    latitude: -33.922087,
    longitude: 18.425370,
    address: 'Cape Town Station, Cape Town CBD'
  },
  {
    key: 'cape-town-station-nearby-a',
    userIndex: 3,
    latitude: -33.921980,
    longitude: 18.425260,
    address: 'Near Cape Town Station, Cape Town CBD'
  },
  {
    key: 'cape-town-station-nearby-b',
    userIndex: 4,
    latitude: -33.922220,
    longitude: 18.425540,
    address: 'Adderley Street near Cape Town Station'
  },
  {
    key: 'grand-parade-repeat-a',
    userIndex: 5,
    latitude: -33.925067,
    longitude: 18.427510,
    address: 'Grand Parade, Cape Town CBD'
  },
  {
    key: 'grand-parade-repeat-b',
    userIndex: 0,
    latitude: -33.925067,
    longitude: 18.427510,
    address: 'Grand Parade, Cape Town CBD'
  },
  {
    key: 'grand-parade-nearby',
    userIndex: 1,
    latitude: -33.925160,
    longitude: 18.427660,
    address: 'Near Grand Parade, Cape Town CBD'
  },
  {
    key: 'khayelitsha-repeat-a',
    userIndex: 2,
    latitude: -34.039500,
    longitude: 18.669200,
    address: 'Khayelitsha Site C'
  },
  {
    key: 'khayelitsha-repeat-b',
    userIndex: 3,
    latitude: -34.039500,
    longitude: 18.669200,
    address: 'Khayelitsha Site C'
  }
];

const shouldUpdateExisting = () => {
  const value = process.env.DEMO_USER_UPDATE_EXISTING;
  return value ? value.toLowerCase() !== 'false' : true;
};

const upsertDemoUser = async (demoUser) => {
  const existing = await User.scope('withPassword').findOne({
    where: { email: demoUser.email }
  });

  if (!existing) {
    return User.create({
      ...demoUser,
      password: DEMO_USER_PASSWORD
    });
  }

  if (shouldUpdateExisting()) {
    await existing.update({
      full_name: demoUser.full_name,
      password: DEMO_USER_PASSWORD
    });
  }

  return existing;
};

const upsertDemoIncident = async (demoIncident, users) => {
  const user = users[demoIncident.userIndex];
  const videoUrl = `demo://cape-town-h3/${demoIncident.key}`;
  const h3Index = h3.latLngToCell(demoIncident.latitude, demoIncident.longitude, H3_RESOLUTION);

  const payload = {
    user_id: user.user_id,
    video_url: videoUrl,
    latitude: demoIncident.latitude,
    longitude: demoIncident.longitude,
    address: demoIncident.address,
    h3_index: h3Index,
    status: 'acknowledged',
    acknowledged_at: new Date()
  };

  const existing = await Incident.findOne({ where: { video_url: videoUrl } });

  if (!existing) {
    return Incident.create(payload);
  }

  if (shouldUpdateExisting()) {
    await existing.update(payload);
  }

  return existing;
};

const seedDemoCapeTownUsers = async () => {
  await sequelize.authenticate();
  await sequelize.sync();

  const users = [];
  for (const demoUser of demoUsers) {
    users.push(await upsertDemoUser(demoUser));
  }

  const incidents = [];
  for (const demoIncident of demoIncidentLocations) {
    incidents.push(await upsertDemoIncident(demoIncident, users));
  }

  const countsByH3Index = incidents.reduce((counts, incident) => {
    const index = incident.h3_index;
    counts[index] = (counts[index] || 0) + 1;
    return counts;
  }, {});

  console.log(`Seeded ${users.length} demo users and ${incidents.length} acknowledged Cape Town incidents.`);
  console.log('Demo H3 index counts:');
  Object.entries(countsByH3Index).forEach(([h3Index, count]) => {
    console.log(`${h3Index}: ${count}`);
  });
};

seedDemoCapeTownUsers()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Demo Cape Town user seed failed:', error.message);
    await sequelize.close().catch(() => {});
    process.exit(1);
  });
