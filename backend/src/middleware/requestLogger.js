import pinoHttp from 'pino-http';
import { logger } from '../config/logger.js';

/**
 * Express middleware for automatic, production-grade request logging.
 * Integrates pino-http with the centralized logger instance.
 * Extracts correlation IDs (req.id), measures response times, and logs request/response headers.
 * 
 * @type {import('express').Handler}
 */
export const requestLogger = pinoHttp({
  logger,
  // Bind standard correlation ID to log context
  genReqId: (req) => req.id,
  
  // Custom response serializer to append latency analytics
  customSuccessMessage: (req, res, responseTime) => {
    return `${req.method} ${req.url} completed successfully with status ${res.statusCode} in ${responseTime}ms`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} failed with status ${res.statusCode}: ${err.message}`;
  },

  // Redact parameters from default serializers
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: {
        host: req.headers.host,
        'user-agent': req.headers['user-agent'],
        'x-request-id': req.headers['x-request-id']
      }
    }),
    res: (res) => ({
      statusCode: res.statusCode
    }),
    err: pinoHttp.stdSerializers.err
  }
});

export default requestLogger;
