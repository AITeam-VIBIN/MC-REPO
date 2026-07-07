import { logger } from '../config/logger.js';

export const APPROVAL_TRANSITIONS = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  IN_PROGRESS: ['APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  APPROVED: [],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: []
};

/**
 * Validates whether a state transition for an approval request is valid.
 * 
 * @param {string} current - Current status
 * @param {string} target - Target status
 * @returns {boolean} True if transition is valid
 */
export function isValidApprovalTransition(current, target) {
  const allowed = APPROVAL_TRANSITIONS[current];
  if (!allowed) return false;
  return allowed.includes(target);
}

/**
 * Generates a unique reference tracking number.
 * 
 * @param {string} [prefix='APR'] - The prefix string
 * @returns {string} The unique reference string
 */
export function generateApprovalReferenceNumber(prefix = 'APR') {
  const timestamp = Date.now();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Calculates time elapsed in seconds.
 * 
 * @param {Date|string} startTime 
 * @param {Date|string} endTime 
 * @returns {number} duration in seconds
 */
export function calculateApprovalDuration(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const diff = new Date(endTime).getTime() - new Date(startTime).getTime();
  return Math.max(0, Math.floor(diff / 1000));
}

/**
 * Hook triggered when a workflow approval request is created.
 */
export async function approvalCreated(request) {
  logger.info({ approvalId: request.id }, '[Approval Workflow Hook] Request created.');
}

/**
 * Hook triggered when a request is submitted.
 */
export async function approvalSubmitted(request) {
  logger.info({ approvalId: request.id }, '[Approval Workflow Hook] Request submitted.');
}

/**
 * Hook triggered when an approval step is accepted/approved.
 */
export async function approvalAccepted(request, step) {
  logger.info({ approvalId: request.id, stepId: step?.id }, '[Approval Workflow Hook] Step approved.');
}

/**
 * Hook triggered when a request step is rejected.
 */
export async function approvalRejected(request, step) {
  logger.info({ approvalId: request.id, stepId: step?.id }, '[Approval Workflow Hook] Step/Request rejected.');
}

/**
 * Hook triggered when the entire approval workflow completes.
 */
export async function approvalCompleted(request) {
  logger.info({ approvalId: request.id }, '[Approval Workflow Hook] Workflow completed successfully.');
}
