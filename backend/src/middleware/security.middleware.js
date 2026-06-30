import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import securityConfig from '../config/security.js';

/**
 * Helmet middleware configured with production-safe security headers.
 * Protects the app from well-known web vulnerabilities by setting HTTP headers appropriately.
 * 
 * @type {import('express').RequestHandler}
 */
export const helmetMiddleware = helmet(securityConfig.helmet);

/**
 * CORS middleware configured with environment-based allowed origins.
 * Restricts cross-origin requests to trusted origins only.
 * 
 * @type {import('express').RequestHandler}
 */
export const corsMiddleware = cors(securityConfig.cors);

/**
 * Helper to build custom rate limit handlers/responses.
 * 
 * @param {string} errorMsg - Customized error message
 * @returns {Function} Rate limit handler function
 */
function createRateLimitHandler(errorMsg) {
  return (req, res, next, options) => {
    res.status(options.statusCode).json({
      success: false,
      error: {
        message: errorMsg,
        code: 'TOO_MANY_REQUESTS',
      },
    });
  };
}

/**
 * Rate limiter for general API endpoints.
 * 
 * @type {import('express').RequestHandler}
 */
export const apiLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.general.windowMs,
  max: securityConfig.rateLimit.general.max,
  message: securityConfig.rateLimit.general.message,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(securityConfig.rateLimit.general.message),
});

/**
 * Rate limiter for authentication attempts.
 * 
 * @type {import('express').RequestHandler}
 */
export const authLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.auth.windowMs,
  max: securityConfig.rateLimit.auth.max,
  message: securityConfig.rateLimit.auth.message,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(securityConfig.rateLimit.auth.message),
});

/**
 * Rate limiter for resource upload endpoints.
 * 
 * @type {import('express').RequestHandler}
 */
export const uploadLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.upload.windowMs,
  max: securityConfig.rateLimit.upload.max,
  message: securityConfig.rateLimit.upload.message,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler(securityConfig.rateLimit.upload.message),
});

/**
 * Compression middleware utilizing gzip compression for responses.
 * Reduces the size of response bodies, improving request/response speeds.
 * 
 * @type {import('express').RequestHandler}
 */
export const compressionMiddleware = compression({
  threshold: 1024, // Compress responses only above 1KB size
});

/**
 * JSON request body parser middleware with production-safe size limits.
 * 
 * @type {import('express').RequestHandler}
 */
export const jsonParser = express.json({
  limit: securityConfig.bodyLimits.json,
});

/**
 * URL-encoded request body parser middleware with production-safe size limits.
 * 
 * @type {import('express').RequestHandler}
 */
export const urlEncodedParser = express.urlencoded({
  extended: true,
  limit: securityConfig.bodyLimits.urlEncoded,
});

/**
 * Cookie Parser middleware for securely extracting cookies from requests.
 * 
 * @type {import('express').RequestHandler}
 */
export const cookieParserMiddleware = cookieParser(securityConfig.cookieSecret);

/**
 * Registers the comprehensive suite of security middleware on the provided Express application instance.
 * Orders middleware sequentially to optimize pipeline execution:
 * 1. CORS Configuration
 * 2. Helmet Security Headers
 * 3. Cookie Parsing
 * 4. Body Parsing (JSON & URL-Encoded size limits)
 * 5. Response Compression
 * 6. Global API Rate Limiting
 * 
 * @function registerSecurityMiddleware
 * @param {import('express').Express} app - The Express application instance
 * @returns {void}
 */
export function registerSecurityMiddleware(app) {
  app.use(corsMiddleware);
  app.use(helmetMiddleware);
  app.use(cookieParserMiddleware);
  app.use(jsonParser);
  app.use(urlEncodedParser);
  app.use(compressionMiddleware);
  app.use(apiLimiter);
}

export default registerSecurityMiddleware;
