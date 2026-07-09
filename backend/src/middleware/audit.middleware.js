import { AuditService } from '../services/audit.service.js';
import { parseUserAgent } from '../utils/security.util.js';

const auditService = new AuditService();

/**
 * Express middleware that automatically captures request context, authentication status,
 * response execution time, and writes a compliance-ready audit log event.
 * 
 * @async
 * @function auditMiddleware
 * @param {import('express').Request} req - Express Request object
 * @param {import('express').Response} res - Express Response object
 * @param {import('express').NextFunction} next - Express Next function callback
 * @returns {void}
 */
export function auditMiddleware(req, res, next) {
  // Capture execution start time
  const startTime = process.hrtime();

  // Intercept the response completion event to record metrics
  res.on('finish', async () => {
    try {
      const elapsed = process.hrtime(startTime);
      const durationMs = (elapsed[0] * 1000 + elapsed[1] / 1000000).toFixed(2);

      const path = req.baseUrl + req.path;
      const method = req.method;
      const statusCode = res.statusCode;

      // Don't audit standard health probes to avoid database noise
      if (path === '/health' || path === '/health/') {
        return;
      }

      // Bypass audit if requested via headers (useful for API test isolation)
      if (req.headers['x-bypass-audit'] === 'true') {
        return;
      }

      // Map request properties to Category, Action, and Event types
      let category = 'SYSTEM';
      let action = 'VIEW';

      if (path.includes('/auth/')) {
        category = 'AUTHENTICATION';
        action = path.includes('logout') ? 'LOGOUT' : 'LOGIN';
      } else if (path.includes('/documents')) {
        category = 'DOCUMENT';
        if (method === 'POST') action = 'UPLOAD';
        else if (method === 'DELETE') action = 'DELETE';
        else if (method === 'GET') {
          action = path.includes('download') ? 'DOWNLOAD' : 'VIEW';
        } else {
          action = 'UPDATE';
        }
      } else if (path.includes('/checkouts')) {
        category = 'CHECKOUT';
        action = method === 'POST' ? 'CREATE' : 'UPDATE';
      } else if (path.includes('/approvals')) {
        category = 'APPROVAL';
        if (path.includes('approve')) action = 'APPROVE';
        else if (path.includes('reject')) action = 'REJECT';
        else action = method === 'POST' ? 'CREATE' : 'UPDATE';
      } else if (path.includes('/signatures')) {
        category = 'SIGNATURE';
        if (path.includes('verify')) action = 'VERIFY';
        else action = method === 'POST' ? 'CREATE' : 'UPDATE';
      }

      // Handle override keywords anywhere in paths
      if (path.includes('download')) {
        action = 'DOWNLOAD';
      } else if (path.includes('verify')) {
        action = 'VERIFY';
      } else if (path.includes('export')) {
        action = 'EXPORT';
      }

      // Parse user agent
      const userAgentStr = req.headers['user-agent'] || '';
      const { browser, os, device } = parseUserAgent(userAgentStr);

      // Extract user context from req.user (populated by requireAuth middleware)
      const user = req.user || null;
      const userId = user?.id || null;

      // Extract access result
      let result = 'SUCCESS';
      if (statusCode >= 400) {
        result = statusCode === 403 ? 'DENIED' : 'FAILED';
      }

      const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

      // Build context payload
      const auditPayload = {
        userId,
        eventType: `${category}_${action}`,
        category,
        action,
        description: `HTTP ${method} ${path} completed with status ${statusCode} in ${durationMs}ms`,
        ipAddress: clientIp,
        userAgent: userAgentStr,
        device,
        browser,
        os,
        sessionId: req.cookies?.sid || req.headers['x-session-id'] || null,
        result,
        metadata: {
          method,
          path,
          statusCode,
          durationMs,
          correlationId: req.id || null, // request id from requestIdMiddleware
          query: req.query || {},
        },
      };

      // Record the event using AuditService
      await auditService.recordEvent(auditPayload);

    } catch (err) {
      // Middleware errors must not disrupt route handler flows
      console.error('[AuditMiddleware] Failed to process auto audit log capture:', err);
    }
  });

  next();
}

export default auditMiddleware;
