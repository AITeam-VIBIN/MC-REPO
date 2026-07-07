import { Router } from 'express';
import { ApprovalController } from '../controllers/approval.controller.js';
import { requireAuth, requireSession, requirePermission } from '../middleware/index.js';
import {
  createApprovalSchema,
  updateApprovalSchema,
  decisionSchema,
  cancelSchema,
  listApprovalsSchema,
  idParamSchema
} from '../validations/approval.validation.js';

const router = Router();
const approvalController = new ApprovalController();

// Validation Middleware Helper
const validate = (schema) => (req, res, next) => {
  try {
    if (schema === idParamSchema) {
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

// All approval workflow endpoints require authentication and session verification
router.use(requireAuth);
router.use(requireSession);

/**
 * @openapi
 * /approvals/my-requests:
 *   get:
 *     summary: Retrieve approval requests created by current user
 */
router.get('/my-requests', requirePermission('APPROVAL_VIEW'), validate(listApprovalsSchema), approvalController.listMyRequests);

/**
 * @openapi
 * /approvals/my-pending:
 *   get:
 *     summary: Retrieve items pending current user approval decision
 */
router.get('/my-pending', requirePermission('APPROVAL_VIEW'), validate(listApprovalsSchema), approvalController.listMyPending);

/**
 * @openapi
 * /approvals/my-history:
 *   get:
 *     summary: Retrieve completed approval history involving current user
 */
router.get('/my-history', requirePermission('APPROVAL_VIEW'), validate(listApprovalsSchema), approvalController.listMyHistory);

/**
 * @openapi
 * /approvals:
 *   post:
 *     summary: Create new draft or pending approval request
 */
router.post('/', requirePermission('APPROVAL_CREATE'), validate(createApprovalSchema), approvalController.createApproval);

/**
 * @openapi
 * /approvals:
 *   get:
 *     summary: List all active approval requests with filters
 */
router.get('/', requirePermission('APPROVAL_VIEW'), validate(listApprovalsSchema), approvalController.listApprovals);

/**
 * @openapi
 * /approvals/:id:
 *   get:
 *     summary: Retrieve detailed approval request information
 */
router.get('/:id', requirePermission('APPROVAL_VIEW'), validate(idParamSchema), approvalController.getApprovalDetails);

/**
 * @openapi
 * /approvals/:id:
 *   patch:
 *     summary: Update draft approval request properties
 */
router.patch('/:id', requirePermission('APPROVAL_UPDATE'), validate(idParamSchema), validate(updateApprovalSchema), approvalController.updateApproval);

/**
 * @openapi
 * /approvals/:id:
 *   delete:
 *     summary: Soft delete approval request
 */
router.delete('/:id', requirePermission('APPROVAL_MANAGE'), validate(idParamSchema), approvalController.deleteApproval);

/**
 * @openapi
 * /approvals/:id/submit:
 *   post:
 *     summary: Submit draft request to start validation steps
 */
router.post('/:id/submit', requirePermission('APPROVAL_CREATE'), validate(idParamSchema), approvalController.submitApproval);

/**
 * @openapi
 * /approvals/:id/approve:
 *   post:
 *     summary: Approve current step of the request workflow
 */
router.post('/:id/approve', requirePermission('APPROVAL_APPROVE'), validate(idParamSchema), validate(decisionSchema), approvalController.approveRequest);

/**
 * @openapi
 * /approvals/:id/reject:
 *   post:
 *     summary: Reject current step and fail the workflow request
 */
router.post('/:id/reject', requirePermission('APPROVAL_REJECT'), validate(idParamSchema), validate(decisionSchema), approvalController.rejectRequest);

/**
 * @openapi
 * /approvals/:id/cancel:
 *   post:
 *     summary: Cancel approval request
 */
router.post('/:id/cancel', requirePermission('APPROVAL_CREATE'), validate(idParamSchema), validate(cancelSchema), approvalController.cancelRequest);

/**
 * @openapi
 * /approvals/:id/timeline:
 *   get:
 *     summary: Retrieve history log timeline for request
 */
router.get('/:id/timeline', requirePermission('APPROVAL_VIEW'), validate(idParamSchema), approvalController.getTimeline);

export default router;
