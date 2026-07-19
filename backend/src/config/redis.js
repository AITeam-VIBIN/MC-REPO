import Redis from 'ioredis';
import env from './env.js';

let mainRedisInstance = null;

// Non-fatal Redis/TCP error codes — must NEVER crash the process
const TRANSIENT_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'EPIPE',
  'ECONNABORTED',
]);

/**
 * Attaches error + reconnect listeners to a Redis client.
 * Also wraps client.duplicate() so cloned clients (used internally by BullMQ)
 * always inherit error handlers — preventing uncaughtException crashes.
 *
 * @param {Redis} client - The ioredis client instance
 * @returns {Redis} The same client with listeners attached
 */
function configureClientListeners(client) {
  let hasWarned = false;

  client.on('error', (err) => {
    // Swallow transient TCP/network errors entirely.
    // Without this listener, Node.js throws them as uncaughtException and crashes.
    if (TRANSIENT_ERROR_CODES.has(err.code)) {
      if (!hasWarned) {
        console.warn(`[Redis] Connection error (${err.code}) — degraded mode active. Background jobs offline.`);
        hasWarned = true;
      }
      return; // Swallowed — do NOT re-throw
    }
    // Non-transient: log once but still don't crash
    if (!hasWarned) {
      console.warn(`[Redis] Unexpected error: ${err.message}`);
      hasWarned = true;
    }
  });

  client.on('reconnecting', () => {
    // Suppress reconnect noise in production logs
  });

  // ─── CRITICAL FIX ─────────────────────────────────────────────────────────
  // BullMQ calls client.duplicate() internally to create subscriber/publisher
  // sub-connections. The default ioredis .duplicate() returns a raw new Redis
  // instance with NO error handlers — causing uncaughtException on ECONNRESET.
  // We override .duplicate() so every cloned client also gets our error handler.
  const originalDuplicate = client.duplicate.bind(client);
  client.duplicate = function (...args) {
    const cloned = originalDuplicate(...args);
    return configureClientListeners(cloned);
  };
  // ──────────────────────────────────────────────────────────────────────────

  return client;
}

/**
 * Builds ioredis connection options.
 * Auto-detects TLS for Railway's rediss:// URLs.
 * Retry strategy stops after 10 attempts to prevent infinite ECONNRESET loops.
 *
 * @returns {Object} ioredis constructor options
 */
function buildRedisOptions() {
  const redisUrl = env.REDIS_URL || '';
  const isTLS = redisUrl.startsWith('rediss://');

  return {
    maxRetriesPerRequest: null,   // Required by BullMQ
    enableReadyCheck: false,      // Don't block startup waiting for Redis
    lazyConnect: false,
    retryStrategy(times) {
      // Stop retrying after 10 attempts — return null = give up gracefully
      if (times > 10) return null;
      // Exponential backoff: 500ms → 1s → 2s … capped at 30s
      return Math.min(times * 500, 30000);
    },
    reconnectOnError(err) {
      // Only reconnect on specific recoverable errors
      return TRANSIENT_ERROR_CODES.has(err.code) ? 1 : false;
    },
    // Auto-enable TLS for Railway's rediss:// URLs
    ...(isTLS && {
      tls: {
        rejectUnauthorized: false, // Railway uses self-signed certs
      },
    }),
  };
}

/**
 * Creates a new configured Redis client with full error handling.
 * Returns a mock client when Redis is disabled (REDIS_ENABLED=false).
 *
 * @returns {Redis|Object}
 */
export function createRedisClient() {
  if (!env.REDIS_ENABLED) {
    // Fully-typed mock — all methods ioredis exposes that BullMQ relies on
    const mock = {
      status: 'ready',
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
      // BullMQ calls .duplicate() on its connections — return another mock
      duplicate: () => createRedisClient(),
    };
    return mock;
  }

  const client = new Redis(env.REDIS_URL, buildRedisOptions());
  return configureClientListeners(client);
}

/**
 * Singleton Redis cache client.
 * One shared connection for general key-value cache operations.
 *
 * @returns {Redis|Object}
 */
export function getRedisClient() {
  if (!mainRedisInstance) {
    mainRedisInstance = createRedisClient();
  }
  return mainRedisInstance;
}

export const redis = getRedisClient();
export default redis;
