import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller.js';
import { requireAuth, requireSession, requirePermission } from '../middleware/index.js';

const router = Router();
const controller = new AnalyticsController();

// All analytics endpoints require auth and session verification
router.use(requireAuth);
router.use(requireSession);

/**
 * @openapi
 * /analytics/overview
 */
router.get('/overview', requirePermission('ANALYTICS_VIEW'), controller.getDashboardOverview);

/**
 * @openapi
 * /analytics/documents
 */
router.get('/documents', requirePermission('ANALYTICS_VIEW'), controller.getDocumentAnalytics);

/**
 * @openapi
 * /analytics/checkouts
 */
router.get('/checkouts', requirePermission('ANALYTICS_VIEW'), controller.getCheckoutAnalytics);

/**
 * @openapi
 * /analytics/approvals
 */
router.get('/approvals', requirePermission('ANALYTICS_VIEW'), controller.getApprovalAnalytics);

/**
 * @openapi
 * /analytics/signatures
 */
router.get('/signatures', requirePermission('ANALYTICS_VIEW'), controller.getSignatureAnalytics);

/**
 * @openapi
 * /analytics/audit
 */
router.get('/audit', requirePermission('ANALYTICS_VIEW'), controller.getAuditAnalytics);

/**
 * @openapi
 * /analytics/users
 */
router.get('/users', requirePermission('ANALYTICS_VIEW'), controller.getUserAnalytics);

export default router;
