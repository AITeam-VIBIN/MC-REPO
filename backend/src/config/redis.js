import Redis from 'ioredis';
import env from './env.js';

let mainRedisInstance = null;

// Non-fatal TCP error codes — must NEVER crash the process
const TRANSIENT_ERROR_CODES = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND',
  'ETIMEDOUT', 'EHOSTUNREACH', 'EPIPE', 'ECONNABORTED',
]);

/**
 * Determines whether Redis should actually be used.
 * Auto-disables if:
 *  - REDIS_ENABLED is explicitly false
 *  - REDIS_URL points to localhost (no Redis on Railway containers)
 *
 * @returns {boolean}
 */
function isRedisActive() {
  if (!env.REDIS_ENABLED) return false;
  const url = env.REDIS_URL || '';
  // Never try to connect to localhost in a container — it will always ECONNRESET
  if (url.includes('localhost') || url.includes('127.0.0.1')) return false;
  return true;
}

/**
 * Returns a fully-typed mock Redis client.
 * Satisfies all interfaces used by BullMQ, cache.service.js, and server.js.
 *
 * @returns {Object} Mock Redis client
 */
function createMockClient() {
  const mock = {
    status: 'ready',
    isReady: true,
    connect: async () => {},
    disconnect: async () => {},
    quit: async () => {},
    ping: async () => 'PONG',
    get: async () => null,
    set: async () => 'OK',
    setex: async () => 'OK',
    del: async () => 0,
    keys: async () => [],
    on: () => mock,
    off: () => mock,
    once: () => mock,
    emit: () => false,
    removeListener: () => mock,
    removeAllListeners: () => mock,
    // BullMQ calls .duplicate() for every queue/worker sub-connection
    duplicate: () => createMockClient(),
  };
  return mock;
}

/**
 * Attaches error + reconnect listeners to a live Redis client.
 * Overrides .duplicate() so BullMQ's internally-cloned clients also get handlers.
 *
 * @param {Redis} client
 * @returns {Redis}
 */
function attachErrorHandlers(client) {
  let hasWarned = false;

  client.on('error', (err) => {
    if (TRANSIENT_ERROR_CODES.has(err.code)) {
      if (!hasWarned) {
        console.warn(`[Redis] Connection lost (${err.code}) — running without Redis. Background jobs offline.`);
        hasWarned = true;
      }
      return; // Swallow — do NOT re-throw to process
    }
    if (!hasWarned) {
      console.warn(`[Redis] Error: ${err.message}`);
      hasWarned = true;
    }
  });

  // Suppress all reconnect noise in production
  client.on('reconnecting', () => {});

  // Override duplicate() so BullMQ's internal subscriber/publisher clones
  // always inherit our error handler and never throw uncaughtException
  const _duplicate = client.duplicate.bind(client);
  client.duplicate = function (...args) {
    return attachErrorHandlers(_duplicate(...args));
  };

  return client;
}

/**
 * Builds ioredis options with safe retry strategy and auto-TLS.
 *
 * @returns {Object}
 */
function buildOptions() {
  const url = env.REDIS_URL || '';
  const isTLS = url.startsWith('rediss://');

  return {
    maxRetriesPerRequest: null,  // Required by BullMQ
    enableReadyCheck: false,     // Don't block startup on Redis
    retryStrategy(times) {
      if (times > 5) return null; // Give up after 5 attempts — no more ECONNRESET spam
      return Math.min(times * 1000, 10000);
    },
    reconnectOnError() {
      return false; // Don't auto-reconnect on error — prevents ECONNRESET loops
    },
    ...(isTLS && {
      tls: { rejectUnauthorized: false }, // Railway's self-signed certs
    }),
  };
}

/**
 * Creates a Redis client (real or mock).
 * Always returns a mock when Redis is disabled or URL is localhost.
 *
 * @returns {Redis|Object}
 */
export function createRedisClient() {
  if (!isRedisActive()) {
    return createMockClient();
  }
  return attachErrorHandlers(new Redis(env.REDIS_URL, buildOptions()));
}

/**
 * Singleton cache Redis client.
 *
 * @returns {Redis|Object}
 */
export function getRedisClient() {
  if (!mainRedisInstance) {
    mainRedisInstance = createRedisClient();
  }
  return mainRedisInstance;
}

// Export singleton
export const redis = getRedisClient();
export default redis;
