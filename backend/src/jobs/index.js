import { Queue, Worker } from 'bullmq';
import env from '../config/env.js';
import { getQueueConnectionOptions, defaultJobOptions, queueConfigs } from '../config/bullmq.js';
import { lifecycleService } from '../services/lifecycle.service.js';
import { ReportService } from '../services/report.service.js';

const reportService = new ReportService();

// --- Mocks for Offline Mode ---
class MockQueue {
  constructor(name) {
    this.name = name;
  }
  async add(name, data) {
    console.log(`[Mock Queue: ${this.name}] Job '${name}' enqueued (Redis offline mode).`);
    return { id: `mock-job-${Date.now()}` };
  }
  async close() {
    console.log(`[Mock Queue: ${this.name}] Connection closed.`);
  }
}

class MockWorker {
  constructor(name) {
    this.name = name;
    console.log(`[Mock Worker: ${this.name}] Initialized (Redis offline mode).`);
  }
  async close() {
    console.log(`[Mock Worker: ${this.name}] Terminated.`);
  }
}

/**
 * Helper to construct a Queue or MockQueue depending on Redis availability.
 * @param {string} configKey - Key in queueConfigs
 * @returns {Queue|MockQueue}
 */
function createQueue(configKey) {
  const config = queueConfigs[configKey];
  return env.REDIS_ENABLED
    ? new Queue(config.name, {
        ...getQueueConnectionOptions(),
        defaultJobOptions,
      })
    : new MockQueue(config.name);
}

/**
 * Helper to construct a Worker or MockWorker depending on Redis availability.
 * @param {string} configKey - Key in queueConfigs
 * @param {Function} processor - Job processing handler function
 * @returns {Worker|MockWorker}
 */
function createWorker(configKey, processor) {
  const config = queueConfigs[configKey];
  const worker = env.REDIS_ENABLED
    ? new Worker(
        config.name,
        processor,
        {
          ...getQueueConnectionOptions(),
          concurrency: config.concurrency,
        }
      )
    : new MockWorker(config.name);

  if (env.REDIS_ENABLED) {
    worker.on('completed', (job) => {
      console.log(`[${configKey.toUpperCase()} Worker] Job ID ${job.id} completed successfully.`);
    });
    worker.on('failed', (job, err) => {
      console.error(`[${configKey.toUpperCase()} Worker] Job ID ${job.id} failed with error:`, err);
    });
  }
  return worker;
}

// --- Worker Processor Implementations (Skeletons) ---

async function processAuditJob(job) {
  console.log(`[Audit Worker] Processing job ID ${job.id} (Action: ${job.name})`);
  // Placeholder for audit logging DB insertions
}

async function processNotificationJob(job) {
  console.log(`[Notification Worker] Processing job ID ${job.id} (Type: ${job.name})`);
  // Placeholder for notification dispatching logic (Socket.io/Mailers)
}

async function processPreviewJob(job) {
  console.log(`[Preview Worker] Processing job ID ${job.id} (File: ${job.name})`);
  // Placeholder for thumbnail conversions using canvas/sharp utilities
}

async function processReportJob(job) {
  console.log(`[Report Worker] Processing job ID ${job.id} (Template: ${job.name})`);
  if (job.name === 'generate-compliance-report') {
    const { reportType, format, filters, requestedBy } = job.data;
    const result = await reportService.generateAndStoreReportFile(
      job.id,
      reportType,
      format,
      filters,
      requestedBy
    );
    return result;
  }
}

async function processSchedulerJob(job) {
  console.log(`[Scheduler Worker] Processing job ID ${job.id} (Schedule: ${job.name})`);
  try {
    if (job.name === 'daily-expiry-scan') {
      const summary = await lifecycleService.runDailyExpiryScan();
      console.log(`[Scheduler Worker] daily-expiry-scan result:`, summary);
    } else if (job.name === 'retention-processor') {
      const summary = await lifecycleService.runRetentionProcessor();
      console.log(`[Scheduler Worker] retention-processor result:`, summary);
    } else if (job.name === 'cleanup-preparation') {
      const summary = await lifecycleService.runCleanupPreparation();
      console.log(`[Scheduler Worker] cleanup-preparation result:`, summary);
    } else {
      console.log(`[Scheduler Worker] Unrecognized schedule job name: ${job.name}`);
    }
  } catch (err) {
    console.error(`[Scheduler Worker] Error executing scheduler job:`, err);
    throw err;
  }
}

async function processVirusJob(job) {
  console.log(`[Virus Worker] Processing job ID ${job.id} (File UUID: ${job.name})`);
  // Placeholder for ClamAV scans operations
}

// --- Queue Instantiations ---
export const auditQueue = createQueue('audit');
export const notificationQueue = createQueue('notification');
export const previewQueue = createQueue('preview');
export const reportQueue = createQueue('report');
export const schedulerQueue = createQueue('scheduler');
export const virusQueue = createQueue('virus');

// --- Worker Instantiations ---
export const auditWorker = createWorker('audit', processAuditJob);
export const notificationWorker = createWorker('notification', processNotificationJob);
export const previewWorker = createWorker('preview', processPreviewJob);
export const reportWorker = createWorker('report', processReportJob);
export const schedulerWorker = createWorker('scheduler', processSchedulerJob);
export const virusWorker = createWorker('virus', processVirusJob);

// --- Aggregated Registries ---
export const queues = {
  audit: auditQueue,
  notification: notificationQueue,
  preview: previewQueue,
  report: reportQueue,
  scheduler: schedulerQueue,
  virus: virusQueue,
};

export const workers = {
  audit: auditWorker,
  notification: notificationWorker,
  preview: previewWorker,
  report: reportWorker,
  scheduler: schedulerWorker,
  virus: virusWorker,
};

/**
 * Terminate all queue connections and close worker listener loops gracefully.
 * Resolves once all ongoing active job processes conclude.
 * 
 * @async
 * @function shutdownQueuesAndWorkers
 * @returns {Promise<void>}
 */
export async function shutdownQueuesAndWorkers() {
  console.log('Shutting down BullMQ workers and closing queue connections...');

  // 1. Terminate all worker listener loops first to stop receiving new jobs
  const workerCloses = Object.entries(workers).map(async ([name, worker]) => {
    try {
      await worker.close();
      console.log(`Worker [${name}] terminated gracefully.`);
    } catch (err) {
      console.error(`Error terminating worker [${name}]:`, err);
    }
  });
  await Promise.all(workerCloses);

  // 2. Conclude and close connections for queue clients
  const queueCloses = Object.entries(queues).map(async ([name, queue]) => {
    try {
      await queue.close();
      console.log(`Queue [${name}] connection closed.`);
    } catch (err) {
      console.error(`Error closing connection for queue [${name}]:`, err);
    }
  });
  await Promise.all(queueCloses);

  console.log('All BullMQ resource connections terminated.');
}

export default {
  queues,
  workers,
  shutdownQueuesAndWorkers,
};
