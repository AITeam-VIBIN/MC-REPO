import { prisma } from '../config/database.js';
import { ApprovalRepository } from '../repositories/approval.repository.js';
import {
  isValidApprovalTransition,
  approvalCreated,
  approvalSubmitted,
  approvalAccepted,
  approvalRejected,
  approvalCompleted
} from '../utils/approval.util.js';

export class ApprovalServiceError extends Error {
  constructor(message, code = 'SERVICE_ERROR') {
    super(message);
    this.name = 'ApprovalServiceError';
    this.code = code;
  }
}

export class ApprovalService {
  constructor() {
    this.approvalRepo = new ApprovalRepository();
  }

  /**
   * Create a new polymorphic approval request.
   */
  async createApprovalRequest(data, requesterUser) {
    if (!data.referenceType || !data.referenceId || !data.title) {
      throw new ApprovalServiceError('Missing required approval request fields (referenceType, referenceId, title).', 'VALIDATION_FAILED');
    }

    // Check for active duplicates
    const active = await this.approvalRepo.findActiveApproval(data.referenceType, data.referenceId);
    if (active) {
      throw new ApprovalServiceError('An active approval request already exists for this resource.', 'DUPLICATE_APPROVAL');
    }

    // Capture requester snapshot details from database
    const user = await prisma.user.findUnique({
      where: { id: requesterUser.id },
      include: { department: true },
    });
    if (!user) {
      throw new ApprovalServiceError('Requester user account was not found.', 'USER_NOT_FOUND');
    }

    const payload = {
      referenceType: data.referenceType,
      referenceId: data.referenceId,
      title: data.title,
      description: data.description || null,
      reason: data.reason || null,
      requesterId: user.id,
      requesterName: user.email.split('@')[0],
      requesterDepartment: user.department?.name || 'Unassigned',
      requesterDesignation: user.role,
      priority: data.priority || 'NORMAL',
      status: data.status || 'DRAFT',
      totalSteps: data.steps ? data.steps.length : 1,
      currentStep: 1,
    };

    // Determine current approver from steps
    if (data.steps && data.steps.length > 0) {
      payload.currentApproverId = data.steps[0].approverId;
    }

    // Create request and steps atomically
    const request = await prisma.$transaction(async (tx) => {
      const record = await this.approvalRepo.createApprovalRequest(payload, tx);

      if (data.steps && data.steps.length > 0) {
        const stepsPayload = data.steps.map((step, idx) => ({
          approvalRequestId: record.id,
          stepNumber: idx + 1,
          approverId: step.approverId,
          approverRole: step.approverRole || null,
          status: idx === 0 && record.status === 'PENDING' ? 'PENDING' : 'PENDING',
          approverName: step.approverName || null,
        }));
        await this.approvalRepo.createApprovalSteps(stepsPayload, tx);
      }

      // Add History Event
      await this.approvalRepo.createHistoryEntry({
        approvalRequestId: record.id,
        action: 'CREATED',
        performedBy: user.id,
        previousState: 'DRAFT',
        newState: record.status,
        remarks: 'Approval workflow request created.',
      }, tx);

      if (record.status === 'PENDING') {
        await this.approvalRepo.createHistoryEntry({
          approvalRequestId: record.id,
          action: 'SUBMITTED',
          performedBy: user.id,
          previousState: 'PENDING',
          newState: 'PENDING',
          remarks: 'Approval request submitted.',
        }, tx);
      }

      return record;
    });

    // Execute hooks
    await approvalCreated(request);
    if (request.status === 'PENDING') {
      await approvalSubmitted(request);
    }

    // Re-fetch to return with full loaded steps and history relations
    return await this.approvalRepo.findById(request.id);
  }

  /**
   * Submit draft approval request.
   */
  async submitApprovalRequest(id, userId) {
    const record = await this.approvalRepo.findById(id);
    if (!record) {
      throw new ApprovalServiceError('Approval request was not found.', 'APPROVAL_NOT_FOUND');
    }

    if (record.requesterId !== userId) {
      throw new ApprovalServiceError('You are not authorized to submit this approval request.', 'UNAUTHORIZED_ACCESS');
    }

    if (record.status !== 'DRAFT') {
      throw new ApprovalServiceError('Only draft requests can be submitted for approval.', 'INVALID_STATUS');
    }

    if (!record.steps || record.steps.length === 0) {
      throw new ApprovalServiceError('Workflow has no steps assigned.', 'INVALID_WORKFLOW');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const req = await this.approvalRepo.updateApprovalRequest(id, {
        status: 'PENDING',
        currentStep: 1,
        totalSteps: record.steps.length,
        currentApproverId: record.steps[0].approverId,
      }, tx);

      await this.approvalRepo.createHistoryEntry({
        approvalRequestId: id,
        action: 'SUBMITTED',
        performedBy: userId,
        previousState: 'DRAFT',
        newState: 'PENDING',
        remarks: 'Approval request submitted for processing.',
      }, tx);

      return req;
    });

    await approvalSubmitted(updated);

    return updated;
  }

  /**
   * Process approval step decision (APPROVE or REJECT).
   */
  async processApprovalDecision(id, approverUser, decision, comments, rejectionReason = null) {
    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      throw new ApprovalServiceError('Invalid approval decision parameter (must be APPROVED or REJECTED).', 'VALIDATION_FAILED');
    }

    const record = await this.approvalRepo.findById(id);
    if (!record) {
      throw new ApprovalServiceError('Approval request was not found.', 'APPROVAL_NOT_FOUND');
    }

    if (record.status === 'APPROVED' || record.status === 'REJECTED' || record.status === 'CANCELLED' || record.status === 'EXPIRED') {
      throw new ApprovalServiceError('Completed approval modification attempt.', 'ALREADY_COMPLETED');
    }

    // Find active step matching current step number
    const activeStep = record.steps.find(step => step.stepNumber === record.currentStep);
    if (!activeStep) {
      throw new ApprovalServiceError('Active workflow approval step was not found.', 'STEP_NOT_FOUND');
    }

    // Access check: only assigned approver can process step
    if (activeStep.approverId !== approverUser.id) {
      throw new ApprovalServiceError('You are not the assigned approver for this step.', 'UNAUTHORIZED_ACCESS');
    }

    // Policy check: requested owner cannot approve restricted workflows
    if (record.requesterId === approverUser.id && (record.approvalLevel === 'ADMIN' || record.approvalLevel === 'HIGHER_AUTHORITY')) {
      throw new ApprovalServiceError('Requester cannot approve their own restricted requests.', 'UNAUTHORIZED_APPROVER');
    }

    const nextStepNumber = record.currentStep + 1;
    const isFinalStep = record.currentStep === record.totalSteps;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Process APPROVE Decision
      if (decision === 'APPROVED') {
        // Update active step status
        await this.approvalRepo.updateStep(activeStep.id, {
          status: 'APPROVED',
          decisionDate: new Date(),
          comments: comments || null,
          actionTaken: 'APPROVED',
          approverId: approverUser.id,
          approverName: approverUser.email.split('@')[0],
        }, tx);

        if (isFinalStep) {
          // Complete the workflow
          const req = await this.approvalRepo.updateApprovalRequest(id, {
            status: 'APPROVED',
            currentApproverId: null,
          }, tx);

          await this.approvalRepo.createHistoryEntry({
            approvalRequestId: id,
            action: 'APPROVED',
            performedBy: approverUser.id,
            previousState: record.status,
            newState: 'APPROVED',
            remarks: comments || 'Workflow completed successfully.',
          }, tx);

          return req;
        } else {
          // Advance to next step
          const nextStep = record.steps.find(step => step.stepNumber === nextStepNumber);
          const req = await this.approvalRepo.updateApprovalRequest(id, {
            status: 'IN_PROGRESS',
            currentStep: nextStepNumber,
            currentApproverId: nextStep.approverId,
          }, tx);

          await this.approvalRepo.createHistoryEntry({
            approvalRequestId: id,
            action: 'APPROVED',
            performedBy: approverUser.id,
            previousState: record.status,
            newState: 'IN_PROGRESS',
            remarks: `Step ${record.currentStep} approved by ${approverUser.email.split('@')[0]}. Advancing to Step ${nextStepNumber}.`,
          }, tx);

          return req;
        }
      }

      // 2. Process REJECT Decision
      if (decision === 'REJECTED') {
        if (!rejectionReason || rejectionReason.trim() === '') {
          throw new ApprovalServiceError('Rejection reason comments are required for rejection action.', 'REJECTION_REASON_REQUIRED');
        }

        // Update active step status to rejected
        await this.approvalRepo.updateStep(activeStep.id, {
          status: 'REJECTED',
          decisionDate: new Date(),
          comments: comments || rejectionReason,
          actionTaken: 'REJECTED',
          approverId: approverUser.id,
          approverName: approverUser.email.split('@')[0],
        }, tx);

        // Cancel remaining pending steps
        const remainingSteps = record.steps.filter(step => step.stepNumber > record.currentStep);
        for (const step of remainingSteps) {
          await this.approvalRepo.updateStep(step.id, { status: 'CANCELLED' }, tx);
        }

        // Reject request
        const req = await this.approvalRepo.updateApprovalRequest(id, {
          status: 'REJECTED',
          currentApproverId: null,
        }, tx);

        await this.approvalRepo.createHistoryEntry({
          approvalRequestId: id,
          action: 'REJECTED',
          performedBy: approverUser.id,
          previousState: record.status,
          newState: 'REJECTED',
          remarks: rejectionReason,
        }, tx);

        return req;
      }
    });

    // Fire events
    if (result.status === 'APPROVED') {
      await approvalAccepted(result, activeStep);
      await approvalCompleted(result);
    } else if (result.status === 'REJECTED') {
      await approvalRejected(result, activeStep);
    } else {
      await approvalAccepted(result, activeStep);
    }

    return await this.approvalRepo.findById(id);
  }

  /**
   * Cancel a pending request.
   */
  async cancelApprovalRequest(id, userId, remarks = '') {
    const record = await this.approvalRepo.findById(id);
    if (!record) {
      throw new ApprovalServiceError('Approval request was not found.', 'APPROVAL_NOT_FOUND');
    }

    if (record.requesterId !== userId) {
      throw new ApprovalServiceError('You are not authorized to cancel this approval request.', 'UNAUTHORIZED_ACCESS');
    }

    if (record.status === 'APPROVED' || record.status === 'REJECTED' || record.status === 'CANCELLED' || record.status === 'EXPIRED') {
      throw new ApprovalServiceError('Completed approval modification attempt.', 'ALREADY_COMPLETED');
    }

    await prisma.$transaction(async (tx) => {
      await this.approvalRepo.updateApprovalRequest(id, {
        status: 'CANCELLED',
        currentApproverId: null,
      }, tx);

      // Cancel all steps
      for (const step of record.steps) {
        if (step.status === 'PENDING') {
          await this.approvalRepo.updateStep(step.id, { status: 'CANCELLED' }, tx);
        }
      }

      await this.approvalRepo.createHistoryEntry({
        approvalRequestId: id,
        action: 'CANCELLED',
        performedBy: userId,
        previousState: record.status,
        newState: 'CANCELLED',
        remarks: remarks || 'Cancelled by requester.',
      }, tx);
    });

    return await this.approvalRepo.findById(id);
  }

  /**
   * Expire an active request.
   */
  async expireApprovalRequest(id, remarks = '') {
    const record = await this.approvalRepo.findById(id);
    if (!record) {
      throw new ApprovalServiceError('Approval request was not found.', 'APPROVAL_NOT_FOUND');
    }

    if (record.status === 'APPROVED' || record.status === 'REJECTED' || record.status === 'CANCELLED' || record.status === 'EXPIRED') {
      throw new ApprovalServiceError('Completed approval modification attempt.', 'ALREADY_COMPLETED');
    }

    await prisma.$transaction(async (tx) => {
      await this.approvalRepo.updateApprovalRequest(id, {
        status: 'EXPIRED',
        currentApproverId: null,
      }, tx);

      // Expire all pending steps
      for (const step of record.steps) {
        if (step.status === 'PENDING') {
          await this.approvalRepo.updateStep(step.id, { status: 'EXPIRED' }, tx);
        }
      }

      await this.approvalRepo.createHistoryEntry({
        approvalRequestId: id,
        action: 'CANCELLED', // Maps to CANCELLED action enum
        performedBy: 'SYSTEM',
        previousState: record.status,
        newState: 'EXPIRED',
        remarks: remarks || 'Approval expired due to timeout.',
      }, tx);
    });

    return await this.approvalRepo.findById(id);
  }

  /**
   * Fetch details.
   */
  async getApprovalDetails(id, user) {
    const record = await this.approvalRepo.findById(id);
    if (!record) {
      throw new ApprovalServiceError('Approval request was not found.', 'APPROVAL_NOT_FOUND');
    }

    // Access control validation: requester, current step approver, or administrator
    const isRequester = record.requesterId === user.id;
    const isApprover = record.steps.some(step => step.approverId === user.id);
    const isAdmin = user.role === 'ADMIN';

    if (!isRequester && !isApprover && !isAdmin) {
      throw new ApprovalServiceError('You do not have access privileges to view this approval request.', 'UNAUTHORIZED_ACCESS');
    }

    return record;
  }

  /**
   * Fetch timeline.
   */
  async getTimeline(id) {
    const record = await this.approvalRepo.findById(id);
    if (!record) {
      throw new ApprovalServiceError('Approval request was not found.', 'APPROVAL_NOT_FOUND');
    }

    return await this.approvalRepo.getTimeline(id);
  }
  /**
   * List approvals.
   */
  async listApprovals(filters = {}, options = {}) {
    return await this.approvalRepo.findAll(filters, options);
  }

  /**
   * Get stats.
   */
  async getStats(options = {}) {
    return await this.approvalRepo.getStats(options);
  }

  /**
   * Soft delete approval.
   */
  async softDelete(id, deletedBy) {
    const record = await this.approvalRepo.findById(id);
    if (!record) {
      throw new ApprovalServiceError('Approval request was not found.', 'APPROVAL_NOT_FOUND');
    }
    return await this.approvalRepo.softDelete(id, deletedBy);
  }

  /**
   * Update draft approval request.
   */
  async updateApproval(id, updateData, userId) {
    const record = await this.approvalRepo.findById(id);
    if (!record) {
      throw new ApprovalServiceError('Approval request was not found.', 'APPROVAL_NOT_FOUND');
    }
    if (record.requesterId !== userId) {
      throw new ApprovalServiceError('You are not authorized to update this request.', 'UNAUTHORIZED_ACCESS');
    }
    if (record.status !== 'DRAFT') {
      throw new ApprovalServiceError('Only draft requests can be updated.', 'INVALID_STATUS');
    }
    return await this.approvalRepo.updateApprovalRequest(id, updateData);
  }
}
export default ApprovalService;
