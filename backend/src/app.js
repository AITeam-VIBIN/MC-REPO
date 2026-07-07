import express from 'express';
import { requestIdMiddleware } from './shared/request-id.js';
import {
  corsMiddleware,
  helmetMiddleware,
  requestLogger,
  cookieParserMiddleware,
  jsonParser,
  urlEncodedParser,
  compressionMiddleware,
  apiLimiter,
  errorLogger
} from './middleware/index.js';
import authRouter from './auth/auth.routes.js';
import securityRouter from './routes/security.routes.js';
import vaultRouter from './routes/vault.routes.js';
import documentsRouter from './routes/documents.routes.js';
import checkoutRouter from './routes/checkout.routes.js';

const app = express();

// ==========================================
// 1. Global Pre-Routing Middleware Chain
// ==========================================

// CORS must be evaluated first to properly handle cross-origin preflight requests
app.use(corsMiddleware);

// Register Helmet early to secure headers on all downstream responses
app.use(helmetMiddleware);

// Inject correlation identifier for tracing
app.use(requestIdMiddleware);

// Structured HTTP request logging
app.use(requestLogger);

// Cookie parsing
app.use(cookieParserMiddleware);

// JSON and URL-encoded request body parsing with size limits
app.use(jsonParser);
app.use(urlEncodedParser);

// Gzip response compression
app.use(compressionMiddleware);

// Global API rate limiting
app.use(apiLimiter);

// ==========================================
// 2. Routes Routing Mounts
// ==========================================

// Mount Authentication router
app.use('/api/v1/auth', authRouter);

// Mount Consolidated Security router (Sessions, Devices, Roles, Permissions, Identity Activity)
app.use('/api/v1', securityRouter);

// Mount Vault and Folder router
app.use('/api/v1', vaultRouter);

// Mount Document router
app.use('/api/v1/documents', documentsRouter);

// Mount Checkout router
app.use('/api/v1/checkouts', checkoutRouter);

// Base health probe check route
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// 3. Post-Routing Fallback & Error Boundaries
// ==========================================

// 404 Not Found Middleware Handler
app.use((req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.path}`);
  error.statusCode = 404;
  error.code = 'NOT_FOUND';
  next(error);
});

// Intercept and structure system error logs
app.use(errorLogger);

// Global Centralized Error Handler Middleware (Response Formatter)
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: err.message || 'An unexpected internal error occurred'
    }
  });
});

export default app;
