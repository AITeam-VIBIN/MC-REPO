import { AuditService } from '../services/audit.service.js';
import { ReportService } from '../services/report.service.js';

const auditService = new AuditService();
const reportService = new ReportService();

/**
 * Maps service-level exception errors to standard HTTP response errors.
 * 
 * @function mapServiceErrorToHttp
 * @param {Error} err - Caught exception
 * @param {Object} res - Express response context
 * @param {Function} next - Express next trigger handler
 */
function mapServiceErrorToHttp(err, res, next) {
  if (err.message.includes('Access denied') || err.message.includes('Unauthorized')) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'ACCESS_DENIED',
        message: err.message
      }
    });
  }

  if (err.message.includes('not found') || err.message.includes('No records found')) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: err.message
      }
    });
  }

  // CENTRAL ERROR MIDDLEWARE FALLBACK
  next(err);
}

/**
 * Controller class to handle all HTTP requests for Auditing and Timelines.
 */
export class AuditController {
  /**
   * GET /audit
   * Retrieve list of audit logs with filters and pagination.
   * Required Permission: AUDIT_VIEW
   */
  async listAuditLogs(req, res, next) {
    try {
      const { page, limit, sortBy, sortOrder, ...filters } = req.query;
      const options = { page, limit, sortBy, sortOrder };

      const result = await auditService.searchAuditLogs(filters, options, req.user);

      res.status(200).json({
        success: true,
        data: result.logs,
        meta: {
          page: options.page,
          limit: options.limit,
          total: result.total
        }
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * GET /audit/search
   * Search audit logs using keyword filter.
   * Required Permission: AUDIT_VIEW
   */
  async searchAuditLogs(req, res, next) {
    try {
      const { page, limit, sortBy, sortOrder, search, ...filters } = req.query;
      const options = { page, limit, sortBy, sortOrder };
      const searchFilters = { ...filters, search };

      const result = await auditService.searchAuditLogs(searchFilters, options, req.user);

      res.status(200).json({
        success: true,
        data: result.logs,
        meta: {
          page: options.page,
          limit: options.limit,
          total: result.total
        }
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * GET /audit/:id
   * Retrieve single audit log details.
   * Required Permission: AUDIT_VIEW
   */
  async getAuditDetails(req, res, next) {
    try {
      const { id } = req.params;
      const log = await auditService.getAuditDetails(id, req.user);

      if (!log) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'AUDIT_LOG_NOT_FOUND',
            message: `Audit log record not found for ID: ${id}`
          }
        });
      }

      res.status(200).json({
        success: true,
        data: log
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * GET /audit/users/:userId/activity
   * Retrieve timeline events for a user.
   * Required Permission: AUDIT_VIEW
   */
  async getUserActivity(req, res, next) {
    try {
      const { userId } = req.params;
      const { page, limit, sortBy, sortOrder, group, ...filters } = req.query;
      const options = { page, limit, sortBy, sortOrder };

      const result = await auditService.getUserTimeline(userId, filters, options, group, req.user);

      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          page: options.page,
          limit: options.limit,
          total: result.total
        }
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * GET /audit/my-activity
   * Retrieve timeline events for the active requesting user.
   * Required Permission: AUDIT_VIEW
   */
  async getMyActivity(req, res, next) {
    try {
      const { page, limit, sortBy, sortOrder, group, ...filters } = req.query;
      const options = { page, limit, sortBy, sortOrder };

      const result = await auditService.getUserTimeline(req.user.id, filters, options, group, req.user);

      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          page: options.page,
          limit: options.limit,
          total: result.total
        }
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * GET /audit/resource/:referenceType/:referenceId
   * Retrieve timeline events for a target resource.
   * Required Permission: AUDIT_VIEW
   */
  async getResourceTimeline(req, res, next) {
    try {
      const { referenceType, referenceId } = req.params;
      const { page, limit, sortBy, sortOrder, group, ...filters } = req.query;
      const options = { page, limit, sortBy, sortOrder };

      const result = await auditService.getResourceTimeline(referenceType, referenceId, filters, options, group, req.user);

      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          page: options.page,
          limit: options.limit,
          total: result.total
        }
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * GET /audit/security/events
   * Retrieve security events timeline.
   * Required Permission: AUDIT_SECURITY_VIEW
   */
  async getSecurityEvents(req, res, next) {
    try {
      const { page, limit, sortBy, sortOrder, group, ...filters } = req.query;
      const options = { page, limit, sortBy, sortOrder };

      const result = await auditService.getSecurityTimeline(filters, options, group, req.user);

      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          page: options.page,
          limit: options.limit,
          total: result.total
        }
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * GET /audit/security/failures
   * Retrieve security failures events timeline.
   * Required Permission: AUDIT_SECURITY_VIEW
   */
  async getSecurityFailures(req, res, next) {
    try {
      const { page, limit, sortBy, sortOrder, group, ...filters } = req.query;
      const options = { page, limit, sortBy, sortOrder };
      const failureFilters = { ...filters, result: 'FAILED' };

      const result = await auditService.getSecurityTimeline(failureFilters, options, group, req.user);

      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          page: options.page,
          limit: options.limit,
          total: result.total
        }
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * POST /audit/reports/generate
   * Trigger compliance audit report generation in background thread.
   * Required Permission: AUDIT_EXPORT
   */
  async generateReport(req, res, next) {
    try {
      const { reportType, format, filters } = req.body;
      const result = await reportService.requestReport(reportType, format, filters, req.user);

      res.status(202).json({
        success: true,
        message: 'Compliance report compilation job has been successfully scheduled.',
        data: result
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * GET /audit/reports/:id/download
   * Retrieve status or secure signed URL of compiled report.
   * Required Permission: AUDIT_EXPORT
   */
  async getReportStatus(req, res, next) {
    try {
      const { id } = req.params;
      const result = await reportService.getReportStatus(id);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * GET /audit/export
   * Fast COMPLETE report generation request shortcut.
   * Required Permission: AUDIT_EXPORT
   */
  async exportAuditLogs(req, res, next) {
    try {
      const format = req.query.format || 'PDF';
      const result = await reportService.requestReport('COMPLETE', format, req.query, req.user);

      res.status(202).json({
        success: true,
        message: 'Compliance export shortcut job has been successfully scheduled.',
        data: result
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }
}

export default AuditController;
