import env from './env.js';

/**
 * BullMQ Shared Connection settings.
 * Points to the verified Redis cluster instance.
 * 
 * @type {Object}
 */
export const queueConnectionOptions = {
  connection: {
    url: env.REDIS_URL,
  },
};

/**
 * Global default BullMQ job configuration parameters.
 * Configures automatic retries with exponential backoffs,
 * and handles completion cleanup to prevent Redis memory bloats.
 * 
 * @type {Object}
 */
export const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000, // Initial wait of 5 seconds before retry
  },
  // Automatically cleanup logs to restrict Redis memory consumption
  removeOnComplete: {
    age: 24 * 3600, // Keep completed job metadata for 24 hours
    count: 1000,    // Limit completed logs to 1000 records max
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // Keep failed job records for 7 days
    count: 5000,        // Limit failed logs to 5000 records max
  },
};

/**
 * Enterprise Queue Specific Configuration limits.
 * 
 * @type {Object}
 */
export const queueConfigs = {
  audit: {
    name: 'audit-queue',
    concurrency: 10,
  },
  notification: {
    name: 'notification-queue',
    concurrency: 5,
  },
  preview: {
    name: 'preview-queue',
    concurrency: 2, // CPU intensive image tasks
  },
  report: {
    name: 'report-queue',
    concurrency: 1, // Restrict reports runs to avoid DB locking
  },
  scheduler: {
    name: 'scheduler-queue',
    concurrency: 3,
  },
  virus: {
    name: 'virus-scan-queue',
    concurrency: 5,
  },
};

export default {
  queueConnectionOptions,
  defaultJobOptions,
  queueConfigs,
};
