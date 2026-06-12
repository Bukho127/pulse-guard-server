const Incident = require('../models/incidentModel');
const PolicePersonnel = require('../models/policePersonnelModel');
const { createNotification } = require('./notificationService');
const { Queue, Worker } = require('bullmq');

const useBullQueue = process.env.NOTIFICATION_QUEUE_DRIVER === 'bull';

let incidentNotificationQueue = null;
let incidentNotificationWorker = null;

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379)
};

if (process.env.REDIS_PASSWORD) {
  redisConnection.password = process.env.REDIS_PASSWORD;
}

const buildNewIncidentMessage = (incident) => {
  if (incident.address) {
    return `New incident reported at ${incident.address}.`;
  }
  return `New incident reported near ${incident.latitude}, ${incident.longitude}.`;
};

const notifyPolicePersonnelForIncident = async (incident_id) => {
  const incident = await Incident.findByPk(incident_id);

  if (!incident) {
    return { notified: 0, reason: 'Incident not found' };
  }

  const officers = await PolicePersonnel.findAll({
    attributes: ['security_personnel_id']
  });

  const message = buildNewIncidentMessage(incident);

  await Promise.all(
    officers.map((officer) =>
      createNotification({
        incident_id: incident.incident_id,
        security_personnel_id: officer.security_personnel_id,
        message,
        notification_type: 'general'
      })
    )
  );

  return { notified: officers.length };
};

const getQueue = () => {
  if (!useBullQueue) return null;

  if (!incidentNotificationQueue) {
    incidentNotificationQueue = new Queue('incident-notifications', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: Number(process.env.NOTIFICATION_QUEUE_ATTEMPTS || 3),
        backoff: {
          type: 'exponential',
          delay: Number(process.env.NOTIFICATION_QUEUE_BACKOFF_MS || 5000)
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    });
  }

  return incidentNotificationQueue;
};

const queueIncidentPersonnelNotifications = async (incident) => {
  const queue = getQueue();

  if (!queue) {
    console.log('Incident notification using in-memory mode. Set NOTIFICATION_QUEUE_DRIVER=bull to use BullMQ with Valkey.');
    return null;
  }

  return queue.add(
    'notify-police-personnel',
    { incident_id: incident.incident_id },
    { jobId: `incident:${incident.incident_id}:notify-police-personnel` }
  );
};

const startIncidentNotificationWorker = async () => {
  const queue = getQueue();


  /* this allows the app to function without a queue if Redis/Valkey isn't available, 
   but logs that it's using in-memory mode and won't persist notifications or retry on failure */

  if (!queue) {
    console.log('Incident notification queue using in-memory mode.');
    return;
  }

  if (incidentNotificationWorker) {
    return;
  }

  incidentNotificationWorker = new Worker(
    'incident-notifications',
    async (job) => {
      console.log(`Processing job ${job.id}...`);
      const result = await notifyPolicePersonnelForIncident(job.data.incident_id);
      return result;
    },
    {
      connection: redisConnection,
      concurrency: Number(process.env.NOTIFICATION_QUEUE_CONCURRENCY || 1)
    }
  );

  incidentNotificationWorker.on('completed', (job, result) => {
    console.log(
      `Incident notification job ${job.id} completed. Notified ${result?.notified || 0} personnel.`
    );
  });

  incidentNotificationWorker.on('failed', (job, error) => {
    console.error(`Incident notification job ${job?.id} failed:`, error.message);
  });

  incidentNotificationWorker.on('error', (error) => {
    console.error('Incident notification worker error:', error.message);
  });

  console.log('Incident notification worker started with Valkey');
};

module.exports = {
  queueIncidentPersonnelNotifications,
  startIncidentNotificationWorker
};