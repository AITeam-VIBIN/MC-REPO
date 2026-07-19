import { createServer } from 'http';
import dotenv from 'dotenv';
import app from './app.js';
import { shutdownQueuesAndWorkers } from './jobs/index.js';
import { initSocketServer, getIO } from './config/socket.js';
import { prisma } from './config/database.js';
import { supabaseAdmin } from './config/supabase.js';

// Load environmental parameters
dotenv.config();

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const server = createServer(app);

// ==========================================
// Graceful Shutdown Management
// ==========================================

/**
 * Executes a graceful server shutdown.
 * Closes HTTP, Socket.IO, BullMQ workers, and Prisma in order.
 *
 * @async
 * @param {string} signal - OS signal (SIGINT, SIGTERM)
 */
async function handleGracefulShutdown(signal) {
  console.log(`\n[${signal}] Graceful shutdown initiated...`);

  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      const io = getIO();
      if (io) {
        io.close();
        console.log('Socket.IO server closed.');
      }

      await shutdownQueuesAndWorkers();

      await prisma.$disconnect();
      console.log('Database disconnected.');

      console.log('Shutdown complete.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });

  // Force-kill if shutdown takes longer than 10s
  setTimeout(() => {
    console.error('Forced shutdown: cleanup timeout.');
    process.exit(1);
  }, 10000);
}

// OS signal handlers
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => handleGracefulShutdown('SIGINT'));

// ==========================================
// Process-Level Safety Net
// Catch any Redis/TCP errors that escape all
// other handlers — prevents container crashes
// ==========================================

const TRANSIENT_CODES = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND',
  'ETIMEDOUT',  'EHOSTUNREACH', 'EPIPE', 'ECONNABORTED',
]);

process.on('unhandledRejection', (reason) => {
  if (reason && TRANSIENT_CODES.has(reason.code)) {
    // Swallow Redis/TCP rejections silently — server keeps running
    return;
  }
  console.error('[Process] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  if (TRANSIENT_CODES.has(error.code)) {
    // Last-resort catch for Redis ECONNRESET — do NOT crash
    return;
  }
  // Truly fatal errors (syntax, type, etc.) — exit cleanly
  console.error('[Process] Fatal exception — shutting down:', error);
  process.exit(1);
});

// ==========================================
// Application Bootstrap
// ==========================================

/**
 * Checks core infrastructure and starts the HTTP server.
 * Only the database is required — storage is optional.
 * Redis is fully removed from this flow.
 */
async function startBootstrap() {
  try {
    // ── 1. Database (required) ──────────────────────────────────────────────
    let dbReady = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbReady = true;
    } catch (dbErr) {
      console.error('❌ Database connection failed:', dbErr.message);
    }

    if (!dbReady) {
      console.error('❌ Startup FAILED — Database unreachable. Cannot start.');
      process.exit(1);
    }

    // ── 2. Supabase Storage (optional) ──────────────────────────────────────
    let storageReady = false;
    try {
      const { error } = await supabaseAdmin.storage.listBuckets();
      if (error) throw error;
      storageReady = true;
    } catch {
      console.warn('⚠️  Supabase Storage unavailable — file uploads disabled.');
    }

    console.log(`✅ Startup Health Check: PASSED (db=${dbReady}, storage=${storageReady}, redis=disabled)`);

    // ── 3. Socket.IO ─────────────────────────────────────────────────────────
    initSocketServer(server);

    // ── 4. Listen on all interfaces (required for Railway/containers) ────────
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT} [${NODE_ENV}]`);
    });

  } catch (err) {
    console.error('❌ Critical bootstrap failure:', err);
    process.exit(1);
  }
}

startBootstrap();
