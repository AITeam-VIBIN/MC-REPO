import express from 'express';
import { requestIdMiddleware } from './shared/request-id.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorLogger } from './middleware/errorLogger.js';

// Placeholders for security and routing modules to be imported in future phases
// import helmet from 'helmet';
// import cors from 'cors';
// import { apiLimiter } from './middleware/rateLimit.mw.js';
// import rootRouter from './routes/index.js';

const app = express();

// ==========================================
// 1. Global Pre-Routing Middleware Chain
// ==========================================

// PLACEHOLDER: Security Headers (Helmet)
// app.use(helmet());

// PLACEHOLDER: Cross-Origin Resource Sharing (CORS)
// app.use(cors());

// Inject correlation identifier
app.use(requestIdMiddleware);

// Structured API request logging
app.use(requestLogger);

// PLACEHOLDER: Global API Rate Limiter
// app.use('/api', apiLimiter);

// Payload parsing middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==========================================
// 2. Routes Routing Mounts
// ==========================================

// PLACEHOLDER: Mount main modular application router
// app.use('/api/v1', rootRouter);

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
