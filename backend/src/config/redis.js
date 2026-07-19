import Redis from 'ioredis';
import env from './env.js';

let mainRedisInstance = null;

// Non-fatal error codes that should NOT crash the process
const TRANSIENT_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'EPIPE',
]);

/**
 * Registers standard event listeners on a Redis client.
 * Each client instance has its own warning flag to prevent console spam.
 * Uses per-instance state so BullMQ's 12+ clients all suppress independently.
 *
 * @param {Redis} client - The Redis client instance
 * @returns {Redis} The same client instance
 */
function configureClientListeners(client) {
  let hasWarned = false;

  client.on('error', (err) => {
    // Swallow transient network errors — do NOT let them bubble to process.on('uncaughtException')
    if (TRANSIENT_ERROR_CODES.has(err.code)) {
      if (!hasWarned) {
        console.warn(`[Redis] Connection error (${err.code}): ${err.message}`);
        console.warn('[Redis] Running in degraded mode — background jobs and real-time locks offline.');
        hasWarned = true;
      }
      return; // Explicitly swallow — ioredis emits these as non-fatal
    }
    // Log unexpected errors once
    if (!hasWarned) {
      console.warn(`[Redis] Unexpected error: ${err.message}`);
      hasWarned = true;
    }
  });

  client.on('reconnecting', (delay) => {
    // Suppress reconnect noise in production
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Redis] Reconnecting in ${delay}ms...`);
    }
  });

  return client;
}

/**
 * Builds ioredis connection options from the REDIS_URL.
 * Automatically enables TLS for rediss:// URLs (required by Railway Redis).
 *
 * @returns {Object} ioredis constructor options
 */
function buildRedisOptions() {
  const redisUrl = env.REDIS_URL;
  const isTLS = redisUrl.startsWith('rediss://');

  return {
    // Required by BullMQ — null means unlimited pipeline retries
    maxRetriesPerRequest: null,
    // Disable ready check so server starts even if Redis is slow to connect
    enableReadyCheck: false,
    // Reconnect strategy: exponential backoff capped at 30s, max 10 attempts
    // Returns null after 10 attempts to stop retrying and prevent ECONNRESET spam
    retryStrategy(times) {
      if (times > 10) {
        // Stop retrying — connection is definitively unavailable
        return null;
      }
      return Math.min(times * 500, 30000);
    },
    // Auto-enable TLS for Railway's rediss:// connections
    ...(isTLS && {
      tls: {
        rejectUnauthorized: false, // Railway uses self-signed certs
      },
    }),
  };
}

/**
 * Creates a new, configured Redis connection client instance.
 * Suitable for queues and workers that require dedicated client channels.
 *
 * @function createRedisClient
 * @returns {Redis|Object} A configured Redis connection client instance (or mock if disabled)
 */
export function createRedisClient() {
  if (!env.REDIS_ENABLED) {
    // Return mock Redis client if Redis is disabled (local dev without Redis)
    return {
      connect: async () => {},
      disconnect: async () => {},
      quit: async () => {},
      ping: async () => 'PONG',
      on: () => {},
      off: () => {},
      emit: () => {},
      // BullMQ calls .duplicate() — return another mock to prevent crashes
      duplicate: () => createRedisClient(),
    };
  }

  const client = new Redis(env.REDIS_URL, buildRedisOptions());
  return configureClientListeners(client);
}

/**
 * Retrieves the singleton Redis Cache client.
 * Ensures only one general cache connection exists.
 *
 * @function getRedisClient
 * @returns {Redis|Object} Singleton Redis Client connection instance (or mock if disabled)
 */
export function getRedisClient() {
  if (!mainRedisInstance) {
    mainRedisInstance = createRedisClient();
  }
  return mainRedisInstance;
}

export const redis = getRedisClient();
export default redis;
