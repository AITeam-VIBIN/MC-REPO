import { ApprovalService, ApprovalServiceError } from '../services/approval.service.js';

const approvalService = new ApprovalService();

function mapServiceErrorToHttp(err, res, next) {
  if (err instanceof ApprovalServiceError) {
    const errorMapping = {
      APPROVAL_NOT_FOUND: 404,
      USER_NOT_FOUND: 404,
      DUPLICATE_APPROVAL: 409,
      UNAUTHORIZED_ACCESS: 403,
      UNAUTHORIZED_APPROVER: 403,
      INVALID_STATUS: 400,
      INVALID_WORKFLOW: 400,
      STEP_NOT_FOUND: 400,
      ALREADY_COMPLETED: 400,
      REJECTION_REASON_REQUIRED: 400,
      VALIDATION_FAILED: 400,
    };

    const statusCode = errorMapping[err.code] || 400;
    return res.status(statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  next(err);
}

export class ApprovalController {
  /**
   * Create a new approval request.
   */
  async createApproval(req, res, next) {
    try {
      const result = await approvalService.createApprovalRequest(req.body, req.user);

      res.status(201).json({
        success: true,
        message: 'Approval request successfully created.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * List approval requests with filters.
   */
  async listApprovals(req, res, next) {
    try {
      const { page, limit, sort, order, includeDeleted, ...filters } = req.query;
      const options = { page, limit, sort, order, includeDeleted };
      const result = await approvalService.listApprovals(filters, options);

      res.status(200).json({
        success: true,
        data: result.approvals,
        meta: result.pagination,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Fetch details of an approval request.
   */
  async getApprovalDetails(req, res, next) {
    try {
      const { id } = req.params;
      const result = await approvalService.getApprovalDetails(id, req.user);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Update properties on a draft approval request.
   */
  async updateApproval(req, res, next) {
    try {
      const { id } = req.params;
      const result = await approvalService.updateApproval(id, req.body, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Approval request successfully updated.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Soft delete an approval request.
   */
  async deleteApproval(req, res, next) {
    try {
      const { id } = req.params;
      await approvalService.softDelete(id, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Approval request successfully deleted.',
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Submit draft approval request.
   */
  async submitApproval(req, res, next) {
    try {
      const { id } = req.params;
      const result = await approvalService.submitApprovalRequest(id, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Approval request successfully submitted.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Approve current step.
   */
  async approveRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { comments } = req.body;
      const result = await approvalService.processApprovalDecision(id, req.user, 'APPROVED', comments);

      res.status(200).json({
        success: true,
        message: 'Approval step successfully approved.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Reject current step / request.
   */
  async rejectRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { comments, rejectionReason } = req.body;
      const result = await approvalService.processApprovalDecision(id, req.user, 'REJECTED', comments, rejectionReason);

      res.status(200).json({
        success: true,
        message: 'Approval request successfully rejected.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Cancel approval request.
   */
  async cancelRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { remarks } = req.body;
      const result = await approvalService.cancelApprovalRequest(id, req.user.id, remarks);

      res.status(200).json({
        success: true,
        message: 'Approval request successfully cancelled.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * List requests created by the current user.
   */
  async listMyRequests(req, res, next) {
    try {
      const { page, limit, sort, order } = req.query;
      const options = { page, limit, sort, order };
      const filters = { requesterId: req.user.id };
      const result = await approvalService.listApprovals(filters, options);

      res.status(200).json({
        success: true,
        data: result.approvals,
        meta: result.pagination,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * List requests waiting for the current user's approval.
   */
  async listMyPending(req, res, next) {
    try {
      const { page, limit, sort, order } = req.query;
      const options = { page, limit, sort, order };
      const filters = {
        currentApproverId: req.user.id,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      };
      const result = await approvalService.listApprovals(filters, options);

      res.status(200).json({
        success: true,
        data: result.approvals,
        meta: result.pagination,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * List completed approval history involving the user.
   */
  async listMyHistory(req, res, next) {
    try {
      const { page, limit, sort, order } = req.query;
      const options = { page, limit, sort, order };
      const filters = {
        status: ['APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
        OR: [
          { requesterId: req.user.id },
          { steps: { some: { approverId: req.user.id } } }
        ]
      };
      const result = await approvalService.listApprovals(filters, options);

      res.status(200).json({
        success: true,
        data: result.approvals,
        meta: result.pagination,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Fetch history timeline logs.
   */
  async getTimeline(req, res, next) {
    try {
      const { id } = req.params;
      const result = await approvalService.getTimeline(id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }
}
export default ApprovalController;
