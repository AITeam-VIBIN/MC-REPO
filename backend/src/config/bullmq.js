import env from './env.js';

/**
 * BullMQ Connection Options derived from Redis Configuration.
 * Used by Queue publishers and Worker consumers.
 * 
 * @type {Object}
 */
export const queueConnectionOptions = {
  connection: {
    // BullMQ expects a connection URL or parsed host/port parameters
    url: env.REDIS_URL,
  },
};

/**
 * Global default BullMQ job configuration parameters.
 * Sets standard retries, concurrency limits, and exponential backoff.
 * 
 * @type {Object}
 */
export const defaultJobOptions = {
  removeOnComplete: {
    age: 24 * 3600, // Keep completed logs for 24 hours
    count: 1000,
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // Keep failed logs for 7 days
  },
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000, // Start retrying after 5 seconds
  },
};

/**
 * Queue-specific configurations.
 * 
 * @type {Object}
 */
export const queueConfigs = {
  virusScan: {
    name: 'virus-scan-queue',
    concurrency: 5,
    priority: 'HIGH',
  },
  pdfConversion: {
    name: 'pdf-conversion-queue',
    concurrency: 2,
    priority: 'MEDIUM',
  },
  auditArchival: {
    name: 'audit-archival-queue',
    concurrency: 10,
    priority: 'LOW',
  },
};
