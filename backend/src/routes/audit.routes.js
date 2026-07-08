import { Router } from 'express';
import { AuditController } from '../controllers/audit.controller.js';
import { requireAuth, requireSession, requirePermission } from '../middleware/index.js';
import {
  listAuditLogsSchema,
  idParamSchema,
  userIdParamSchema,
  resourceParamsSchema,
  generateReportSchema
} from '../validations/audit.validation.js';

const router = Router();
const auditController = new AuditController();

// Validation Middleware Helper
const validate = (schema) => (req, res, next) => {
  try {
    if (schema === idParamSchema || schema === userIdParamSchema || schema === resourceParamsSchema) {
      schema.parse(req.params);
    } else {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};

// All audit trail endpoints require authentication and session verification
router.use(requireAuth);
router.use(requireSession);

/**
 * @openapi
 * /audit:
 *   get:
 *     summary: Retrieve list of audit logs with filters and pagination.
 *     permissions: [AUDIT_VIEW]
 */
router.get('/', requirePermission('AUDIT_VIEW'), validate(listAuditLogsSchema), auditController.listAuditLogs);

/**
 * @openapi
 * /audit/search:
 *   get:
 *     summary: Search audit logs using keyword filter.
 *     permissions: [AUDIT_VIEW]
 */
router.get('/search', requirePermission('AUDIT_VIEW'), validate(listAuditLogsSchema), auditController.searchAuditLogs);

/**
 * @openapi
 * /audit/my-activity:
 *   get:
 *     summary: Retrieve timeline events for the active requesting user.
 *     permissions: [AUDIT_VIEW]
 */
router.get('/my-activity', requirePermission('AUDIT_VIEW'), validate(listAuditLogsSchema), auditController.getMyActivity);

/**
 * @openapi
 * /audit/users/:userId/activity:
 *   get:
 *     summary: Retrieve timeline events for a user.
 *     permissions: [AUDIT_VIEW]
 */
router.get('/users/:userId/activity', requirePermission('AUDIT_VIEW'), validate(userIdParamSchema), validate(listAuditLogsSchema), auditController.getUserActivity);

/**
 * @openapi
 * /audit/resource/:referenceType/:referenceId:
 *   get:
 *     summary: Retrieve timeline events for a target resource.
 *     permissions: [AUDIT_VIEW]
 */
router.get('/resource/:referenceType/:referenceId', requirePermission('AUDIT_VIEW'), validate(resourceParamsSchema), validate(listAuditLogsSchema), auditController.getResourceTimeline);

/**
 * @openapi
 * /audit/security/events:
 *   get:
 *     summary: Retrieve security events timeline.
 *     permissions: [AUDIT_SECURITY_VIEW]
 */
router.get('/security/events', requirePermission('AUDIT_SECURITY_VIEW'), validate(listAuditLogsSchema), auditController.getSecurityEvents);

/**
 * @openapi
 * /audit/security/failures:
 *   get:
 *     summary: Retrieve security failures events timeline.
 *     permissions: [AUDIT_SECURITY_VIEW]
 */
router.get('/security/failures', requirePermission('AUDIT_SECURITY_VIEW'), validate(listAuditLogsSchema), auditController.getSecurityFailures);

/**
 * @openapi
 * /audit/export:
 *   get:
 *     summary: Fast COMPLETE report generation request shortcut.
 *     permissions: [AUDIT_EXPORT]
 */
router.get('/export', requirePermission('AUDIT_EXPORT'), validate(listAuditLogsSchema), auditController.exportAuditLogs);

/**
 * @openapi
 * /audit/reports/generate:
 *   post:
 *     summary: Trigger compliance audit report generation in background thread.
 *     permissions: [AUDIT_EXPORT]
 */
router.post('/reports/generate', requirePermission('AUDIT_EXPORT'), validate(generateReportSchema), auditController.generateReport);

/**
 * @openapi
 * /audit/reports/:id/download:
 *   get:
 *     summary: Retrieve status or secure signed URL of compiled report.
 *     permissions: [AUDIT_EXPORT]
 */
router.get('/reports/:id/download', requirePermission('AUDIT_EXPORT'), validate(idParamSchema), auditController.getReportStatus);

/**
 * @openapi
 * /audit/:id:
 *   get:
 *     summary: Retrieve single audit log details.
 *     permissions: [AUDIT_VIEW]
 */
router.get('/:id', requirePermission('AUDIT_VIEW'), validate(idParamSchema), auditController.getAuditDetails);

export default router;
