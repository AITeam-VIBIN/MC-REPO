import { EventEmitter } from 'events';
import { AuditService } from '../services/audit.service.js';

export const eventBus = new EventEmitter();

const auditService = new AuditService();

// =========================================================================
// Document Events Listeners
// =========================================================================

eventBus.on('DOCUMENT_CREATED', async (payload) => {
  await auditService.recordDocumentEvent(payload.documentId, 'CREATE', payload.userId, payload.details, payload.tx);
});

eventBus.on('DOCUMENT_UPLOADED', async (payload) => {
  await auditService.recordDocumentEvent(payload.documentId, 'UPLOAD', payload.userId, payload.details, payload.tx);
});

eventBus.on('DOCUMENT_VIEWED', async (payload) => {
  await auditService.recordDocumentEvent(payload.documentId, 'VIEW', payload.userId, payload.details, payload.tx);
});

eventBus.on('DOCUMENT_DOWNLOADED', async (payload) => {
  await auditService.recordDocumentEvent(payload.documentId, 'DOWNLOAD', payload.userId, payload.details, payload.tx);
});

eventBus.on('DOCUMENT_UPDATED', async (payload) => {
  await auditService.recordDocumentEvent(payload.documentId, 'UPDATE', payload.userId, payload.details, payload.tx);
});

eventBus.on('DOCUMENT_ARCHIVED', async (payload) => {
  await auditService.recordDocumentEvent(payload.documentId, 'DELETE', payload.userId, payload.details, payload.tx);
});

eventBus.on('DOCUMENT_DELETED', async (payload) => {
  await auditService.recordDocumentEvent(payload.documentId, 'DELETE', payload.userId, payload.details, payload.tx);
});

eventBus.on('DOCUMENT_RESTORED', async (payload) => {
  await auditService.recordDocumentEvent(payload.documentId, 'CREATE', payload.userId, payload.details, payload.tx);
});

// =========================================================================
// Checkout Events Listeners
// =========================================================================

eventBus.on('CHECKOUT_REQUESTED', async (payload) => {
  await auditService.recordCheckoutEvent(payload.checkoutId, 'CREATE', payload.userId, payload.details, payload.tx);
});

eventBus.on('CHECKOUT_APPROVED', async (payload) => {
  await auditService.recordCheckoutEvent(payload.checkoutId, 'APPROVE', payload.userId, payload.details, payload.tx);
});

eventBus.on('CHECKOUT_REJECTED', async (payload) => {
  await auditService.recordCheckoutEvent(payload.checkoutId, 'REJECT', payload.userId, payload.details, payload.tx);
});

eventBus.on('DOCUMENT_CHECKED_OUT', async (payload) => {
  await auditService.recordCheckoutEvent(payload.checkoutId, 'UPDATE', payload.userId, payload.details, payload.tx);
});

eventBus.on('DOCUMENT_RETURNED', async (payload) => {
  await auditService.recordCheckoutEvent(payload.checkoutId, 'UPDATE', payload.userId, payload.details, payload.tx);
});

// =========================================================================
// Approval Events Listeners
// =========================================================================

eventBus.on('APPROVAL_CREATED', async (payload) => {
  await auditService.recordApprovalEvent(payload.approvalId, 'CREATE', payload.userId, payload.details, payload.tx);
});

eventBus.on('APPROVAL_SUBMITTED', async (payload) => {
  await auditService.recordApprovalEvent(payload.approvalId, 'UPDATE', payload.userId, payload.details, payload.tx);
});

eventBus.on('APPROVAL_GRANTED', async (payload) => {
  await auditService.recordApprovalEvent(payload.approvalId, 'APPROVE', payload.userId, payload.details, payload.tx);
});

eventBus.on('APPROVAL_REJECTED', async (payload) => {
  await auditService.recordApprovalEvent(payload.approvalId, 'REJECT', payload.userId, payload.details, payload.tx);
});

// =========================================================================
// Signature Events Listeners
// =========================================================================

eventBus.on('SIGNATURE_CREATED', async (payload) => {
  await auditService.recordSignatureEvent(payload.signatureId, 'CREATE', payload.userId, payload.details, payload.tx);
});

eventBus.on('SIGNATURE_VERIFIED', async (payload) => {
  await auditService.recordSignatureEvent(payload.signatureId, 'VERIFY', payload.userId, payload.details, payload.tx);
});

eventBus.on('SIGNATURE_FAILED', async (payload) => {
  await auditService.recordFailedAction('VERIFY', new Error(payload.error || 'Signature verification failed'), payload.userId, payload.details, payload.tx);
});

// =========================================================================
// Global General Error Listeners
// =========================================================================

eventBus.on('AUDIT_LOG_ERROR', (err) => {
  console.error('[EventBus] Operational logging failed:', err);
});

export default eventBus;
