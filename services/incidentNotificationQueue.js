const Incident = require('../models/incidentModel');
const PolicePersonnel = require('../models/policePersonnelModel');
const Notification = require('../models/notificationModel');
const { Queue, Worker } = require('bullmq');

const useBullQueue = process.env.NOTIFICATION_QUEUE_DRIVER === 'bull';

let incidentNotificationQueue = null;
let incidentNotificationWorker = null;

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  maxLoadingRetryTime: 5000 // Prevents worker from hanging indefinitely if Valkey reboots
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

// OPTIMIZED: Pagination + Batch Insert
const notifyPolicePersonnelForIncident = async (incident_id) => {
  const incident = await Incident.findById(incident_id);
  if (!incident) {
    return { notified: 0, reason: 'Incident not found' };
  }

  const batchSize = 100;
  let offset = 0;
  let totalNotified = 0;
  const message = buildNewIncidentMessage(incident);

  let hasMore = true;
  while (hasMore) {
    try {
      // Pagination: Fetch officers in chunks of 100
      const officers = await PolicePersonnel.findAll({
        attributes: ['security_personnel_id'],
        raw: true,
        limit: batchSize,
        offset: offset
      });

      if (officers.length === 0) {
        hasMore = false;
        break;
      }

      // Batch Insert: Create all notifications for this batch at once
      const notifications = officers.map((officer) => ({
        incident_id: incident.incident_id,
        security_personnel_id: officer.security_personnel_id,
        message_encrypted: message,
        recipient_type: 'personnel',
        notification_type: 'general'
      }));

      await Notification.bulkCreate(notifications, {
        ignoreDuplicates: true,  // Skip duplicates
        validate: false           // Skip validation for speed
      });

      console.log(`Batch ${Math.floor(offset / batchSize) + 1}: Notified ${officers.length} personnel`);

      totalNotified += officers.length;
      offset += batchSize;
    } catch (batchError) {
      console.error(`Error processing batch at offset ${offset}:`, batchError.message);
      throw batchError; // Re-throw to let the worker handle retry
    }
  }

  return { notified: totalNotified };
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
        removeOnComplete: {
          age: 3600 // Remove completed jobs after 1 hour
        },
        removeOnFail: false,    // Keep failed jobs for debugging
        timeout: 60000          // 60 second timeout per job
      }
    });
  }
  return incidentNotificationQueue;
};

const queueIncidentPersonnelNotifications = async (incident) => {
  const queue = getQueue();

  if (!queue) {
    console.log('Notification queue disabled. Executing sync in-memory notification.');
    return notifyPolicePersonnelForIncident(incident.incident_id).catch(err => 
      console.error('In-memory notification failed:', err.message)
    );
  }

  return queue.add(
    'notify-police-personnel',
    { incident_id: incident.incident_id },
    { jobId: `incident:${incident.incident_id}:notify-police-personnel` }
  );
};

const startIncidentNotificationWorker = async () => {
  if (!useBullQueue) {
    console.log('Incident notification worker skipped: running in-memory mode.');
    return;
  }

  if (incidentNotificationWorker) return;

  incidentNotificationWorker = new Worker(
    'incident-notifications',
    async (job) => {
      const startTime = Date.now();
      console.log(`Processing job ${job.id} for incident ${job.data.incident_id}...`);
      
      const result = await notifyPolicePersonnelForIncident(job.data.incident_id);
      
      const duration = Date.now() - startTime;
      console.log(`Job ${job.id} completed in ${duration}ms. Total notified: ${result?.notified || 0} personnel.`);
      
      return result;
    },
    {
      connection: redisConnection,
      concurrency: Number(process.env.NOTIFICATION_QUEUE_CONCURRENCY || 1),
      lockDuration: 30000,  // Prevent duplicate execution
      lockRenewTime: 15000
    }
  );

  incidentNotificationWorker.on('completed', (job, result) => {
    console.log(`✓ Job ${job.id} completed successfully. Notified ${result?.notified || 0} personnel.`);
  });

  incidentNotificationWorker.on('failed', (job, error) => {
    console.error(`✗ Job ${job?.id} failed:`, error.message);
  });

  incidentNotificationWorker.on('error', (error) => {
    console.error('Queue Worker global error:', error.message);
  });

  console.log('Incident notification worker started successfully.');
};

module.exports = {
  queueIncidentPersonnelNotifications,
  startIncidentNotificationWorker
};