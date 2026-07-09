import { rateLimit } from 'express-rate-limit';

/**
 * Common handler to build uniform JSON error blocks on rate limits.
 */
function rateLimitErrorHandler(message) {
  return (req, res, next, options) => {
    res.status(options.statusCode).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message,
        timestamp: new Date().toISOString(),
      },
    });
  };
}

/**
 * General API Limiter. Limit each IP to 100 requests per 15 minutes.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitErrorHandler('Too many requests, please try again after 15 minutes.'),
});

/**
 * Authentication and Login Limiter. Limit each IP to 5 attempts per 15 minutes.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitErrorHandler('Too many login or authentication attempts, please try again after 15 minutes.'),
});

/**
 * File downloads and sensitive reporting downloads limiter. Limit to 20 per hour.
 */
export const downloadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitErrorHandler('Download limits exceeded. Please wait an hour before requesting exports.'),
});

export default {
  apiLimiter,
  authLimiter,
  downloadLimiter,
};
