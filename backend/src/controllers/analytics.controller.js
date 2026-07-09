import { AnalyticsService } from '../services/analytics.service.js';

const analyticsService = new AnalyticsService();

function mapErrorToHttp(err, res, next) {
  if (err.message.includes('Access denied') || err.code === 'FORBIDDEN') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'ACCESS_DENIED',
        message: err.message,
      },
    });
  }
  if (err.code === 'UNAUTHORIZED') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: err.message,
      },
    });
  }
  next(err);
}

export class AnalyticsController {
  /**
   * GET /analytics/overview
   */
  async getDashboardOverview(req, res, next) {
    try {
      const data = await analyticsService.getDashboardOverview(req.query, req.user);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      mapErrorToHttp(err, res, next);
    }
  }

  /**
   * GET /analytics/documents
   */
  async getDocumentAnalytics(req, res, next) {
    try {
      const data = await analyticsService.getDocumentAnalytics(req.query, req.user);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      mapErrorToHttp(err, res, next);
    }
  }

  /**
   * GET /analytics/checkouts
   */
  async getCheckoutAnalytics(req, res, next) {
    try {
      const data = await analyticsService.getCheckoutAnalytics(req.query, req.user);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      mapErrorToHttp(err, res, next);
    }
  }

  /**
   * GET /analytics/approvals
   */
  async getApprovalAnalytics(req, res, next) {
    try {
      const data = await analyticsService.getApprovalAnalytics(req.query, req.user);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      mapErrorToHttp(err, res, next);
    }
  }

  /**
   * GET /analytics/signatures
   */
  async getSignatureAnalytics(req, res, next) {
    try {
      const data = await analyticsService.getSignatureAnalytics(req.query, req.user);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      mapErrorToHttp(err, res, next);
    }
  }

  /**
   * GET /analytics/audit
   */
  async getAuditAnalytics(req, res, next) {
    try {
      const data = await analyticsService.getAuditAnalytics(req.query, req.user);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      mapErrorToHttp(err, res, next);
    }
  }

  /**
   * GET /analytics/users
   */
  async getUserAnalytics(req, res, next) {
    try {
      const data = await analyticsService.getUserAnalytics(req.query, req.user);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      mapErrorToHttp(err, res, next);
    }
  }
}

export default AnalyticsController;
