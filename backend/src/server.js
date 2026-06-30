import { createServer } from 'http';
import dotenv from 'dotenv';
import app from './app.js';
import { shutdownQueuesAndWorkers } from './jobs/index.js';
import redis from './config/redis.js';

// Load environmental parameters
dotenv.config();

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const server = createServer(app);

// ==========================================
// Graceful Shutdown Management
// ==========================================

/**
 * Executes a graceful server shutdown. Closes incoming network ports
 * and disconnects downstream connection pools (Postgres, Redis, Workers).
 * 
 * @async
 * @function handleGracefulShutdown
 * @param {string} signal - The OS signal intercepted (e.g. SIGINT, SIGTERM)
 * @returns {Promise<void>}
 */
async function handleGracefulShutdown(signal) {
  console.log(`\n[${signal}] Graceful shutdown sequence initiated...`);

  // Refuse new incoming HTTP connections while processing existing pipelines
  server.close(async () => {
    console.log('HTTP connection ports successfully closed.');

    try {
      // 1. Gracefully stop BullMQ queue connections and worker processes
      await shutdownQueuesAndWorkers();

      // 2. Disconnect the main Redis ioredis client
      await redis.quit();
      console.log('Redis cache client connection closed.');

      // PLACEHOLDER: Disconnect Prisma database client
      // await prisma.$disconnect();
      // console.log('Database client disconnected.');

      console.log('Graceful cleanup completed. Exiting process.');
      process.exit(0);
    } catch (err) {
      console.error('Error encountered during database/cache resource cleanup:', err);
      process.exit(1);
    }
  });

  // Forcefully terminate process after a 10-second safety timeout
  setTimeout(() => {
    console.error('Forced shutdown triggered: Cleanup took too long.');
    process.exit(1);
  }, 10000);
}

// OS system signal hooks
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

// Uncaught system-level runtime monitors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection detected at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception detected:', error);
  // Immediately exit on uncaught synchronous errors to avoid runtime corruption
  process.exit(1);
});

// ==========================================
// Application Bootstrap Initiation
// ==========================================

/**
 * Tests downstream infrastructure bindings and boots up the Express HTTP server.
 * 
 * @async
 * @function startBootstrap
 * @returns {Promise<void>}
 */
async function startBootstrap() {
  try {
    console.log('Initializing MITCON BCD-FSS application bootstrap...');

    // PLACEHOLDER: Verify Prisma database connection
    // await prisma.$connect();
    // console.log('Database connection tested successfully.');

    // Verify Redis connection client gracefully for local development runs
    try {
      await redis.ping();
      console.log('Redis Cache connection verified.');
    } catch (redisErr) {
      console.warn('⚠️ Redis Cache connection failed. Background job workers may be offline.');
    }

    // PLACEHOLDER: Initialize Socket.IO server
    // await initSocketServer(server);

    server.listen(PORT, () => {
      console.log(`🚀 System successfully booted in [${NODE_ENV}] mode`);
      console.log(`API endpoint available at: http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Critical bootstrap initiation failure:', err);
    process.exit(1);
  }
}

startBootstrap();
