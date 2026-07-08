import { AuditRepository } from '../repositories/audit.repository.js';
import * as auditUtil from '../utils/audit.util.js';
import { prisma } from '../config/database.js';

const VALID_CATEGORIES = [
  'AUTHENTICATION',
  'DOCUMENT',
  'CHECKOUT',
  'APPROVAL',
  'SIGNATURE',
  'USER_MANAGEMENT',
  'SYSTEM',
  'SECURITY'
];

const VALID_ACTIONS = [
  'CREATE',
  'VIEW',
  'UPDATE',
  'DELETE',
  'DOWNLOAD',
  'UPLOAD',
  'LOGIN',
  'LOGOUT',
  'APPROVE',
  'REJECT',
  'VERIFY',
  'EXPORT'
];

const VALID_RESULTS = ['SUCCESS', 'FAILED', 'DENIED'];

/**
 * Service Layer implementation for Audit orchestration.
 */
export class AuditService {
  constructor() {
    this.auditRepository = new AuditRepository();
  }

  /**
   * Helper validator verifying fields and size limits.
   * 
   * @param {Object} payload 
   * @throws {Error} If fields or payload size violates compliance requirements
   */
  validatePayload(payload) {
    if (!payload) {
      throw new Error('Audit payload is required');
    }
    
    if (!payload.category || !VALID_CATEGORIES.includes(payload.category)) {
      throw new Error(`Invalid or missing audit category: ${payload.category}`);
    }
    
    if (!payload.action || !VALID_ACTIONS.includes(payload.action)) {
      throw new Error(`Invalid or missing audit action: ${payload.action}`);
    }
    
    if (payload.result && !VALID_RESULTS.includes(payload.result)) {
      throw new Error(`Invalid audit result: ${payload.result}`);
    }

    // Limit payload size to prevent database bloatedness (64KB payload limits)
    try {
      const serialized = JSON.stringify(payload);
      const byteSize = Buffer.byteLength(serialized);
      if (byteSize > 65536) {
        throw new Error(`Audit payload size limit exceeded (${byteSize} bytes). Maximum allowed is 65536 bytes.`);
      }
    } catch (err) {
      throw new Error(`Failed to validate payload size: ${err.message}`);
    }
  }

  /**
   * Internal generic log writer orchestrating context capture, hash chaining, and repository storage.
   * Supports normal and strict failure handling policies.
   * 
   * @async
   * @private
   * @param {Object} payload - Audit context options
   * @param {Object} [tx] - Optional transaction context
   * @returns {Promise<Object|null>} Sanitized response or null
   */
  async createAuditLog(payload, tx) {
    try {
      this.validatePayload(payload);

      // Generate unique event reference number
      const eventRef = payload.eventRef || auditUtil.generateEventReference();

      // Mask sensitive fields in values before saving
      const previousState = auditUtil.maskSensitiveFields(payload.previousState);
      const newState = auditUtil.maskSensitiveFields(payload.newState);
      const metadata = auditUtil.maskSensitiveFields(payload.metadata);

      // Snapshot user identity parameters
      let userSnapshot = payload.userSnapshot || null;
      let roleSnapshot = payload.roleSnapshot || null;
      let departmentSnapshot = payload.departmentSnapshot || null;

      // Extract user context details if userId is present and snapshot lacks fields
      if (payload.userId && (!userSnapshot || !roleSnapshot || !departmentSnapshot)) {
        try {
          const userObj = await this.auditRepository.fetchUserSnapshot(payload.userId);
          if (userObj) {
            userSnapshot = userSnapshot || { id: userObj.id, email: userObj.email };
            roleSnapshot = roleSnapshot || userObj.role || null;
            departmentSnapshot = departmentSnapshot || userObj.department?.name || null;
          }
        } catch (dbErr) {
          console.warn(`[AuditService] User snapshot enrichment warning for User ID ${payload.userId}: ${dbErr.message}`);
        }
      }

      // Link event to preceding log record's hash
      let prevRecordHash = '';
      try {
        const latestRecord = await this.auditRepository.getLatestRecord();
        if (latestRecord) {
          prevRecordHash = latestRecord.recordHash || '';
        }
      } catch (hashErr) {
        console.warn(`[AuditService] Preceding hash retrieval warning: ${hashErr.message}`);
      }

      const eventType = payload.eventType || `${payload.category}_${payload.action}`;
      const result = payload.result || 'SUCCESS';

      // Build target hash fields structure
      const hashPayload = {
        eventRef,
        userId: payload.userId || null,
        eventType,
        category: payload.category,
        action: payload.action,
        description: payload.description || null,
        referenceType: payload.referenceType || null,
        referenceId: payload.referenceId || null,
        previousState,
        newState,
        ipAddress: payload.ipAddress || null,
        userAgent: payload.userAgent || null,
        result,
      };

      const recordHash = auditUtil.generateAuditHash(hashPayload, prevRecordHash);

      const dbData = {
        eventRef,
        userId: payload.userId || null,
        userSnapshot,
        roleSnapshot,
        departmentSnapshot,
        eventType,
        category: payload.category,
        action: payload.action,
        description: payload.description || null,
        referenceType: payload.referenceType || null,
        referenceId: payload.referenceId || null,
        previousState,
        newState,
        ipAddress: payload.ipAddress || null,
        userAgent: payload.userAgent || null,
        device: payload.device || null,
        browser: payload.browser || null,
        os: payload.os || null,
        sessionId: payload.sessionId || null,
        authMethod: payload.authMethod || null,
        mfaStatus: payload.mfaStatus || null,
        permissionUsed: payload.permissionUsed || null,
        result,
        metadata,
        recordHash,
        prevRecordHash,
        retentionPeriod: payload.retentionPeriod || null,
        archiveStatus: 'ACTIVE',
        createdAt: payload.createdAt || undefined,
      };

      const created = await this.auditRepository.create(dbData, tx);
      return auditUtil.formatAuditResponse(created);

    } catch (err) {
      console.error('[AuditService] Centralized audit log capture failed:', err);
      
      const strictMode = process.env.AUDIT_STRICT_MODE === 'true';
      if (strictMode) {
        throw new Error(`Audit Failure [Strict Mode]: ${err.message}`);
      }
      
      return null;
    }
  }

  // =========================================================================
  // Public Recording Methods
  // =========================================================================

  /**
   * Main generic audit registration workflow.
   */
  async recordEvent(payload, tx) {
    return this.createAuditLog(payload, tx);
  }

  /**
   * Logs a standard user action.
   */
  async recordUserAction(userId, action, description, category, details = {}, tx) {
    return this.createAuditLog({
      userId,
      action,
      description,
      category,
      metadata: details,
    }, tx);
  }

  /**
   * Logs administrative configuration updates.
   */
  async recordSystemAction(action, description, details = {}, tx) {
    return this.createAuditLog({
      userId: null,
      action,
      description,
      category: 'SYSTEM',
      metadata: details,
    }, tx);
  }

  /**
   * Logs explicit security events (e.g. MFA status toggle, credentials modification).
   */
  async recordSecurityEvent(userId, eventType, action, result, details = {}, tx) {
    return this.createAuditLog({
      userId,
      eventType,
      action,
      category: 'SECURITY',
      result,
      description: details.description || `Security action ${action} on event ${eventType}`,
      metadata: details,
      authMethod: details.authMethod || null,
      mfaStatus: details.mfaStatus || null,
      permissionUsed: details.permissionUsed || null,
      ipAddress: details.ipAddress || null,
      userAgent: details.userAgent || null,
      browser: details.browser || null,
      os: details.os || null,
      device: details.device || null,
      sessionId: details.sessionId || null,
    }, tx);
  }

  /**
   * Logs value differences and updates on key domain modules.
   */
  async recordResourceChange(referenceType, referenceId, action, before, after, userId, tx) {
    const { previousState, newState } = auditUtil.compareStateChanges(before, after);

    let category = 'SYSTEM';
    if (referenceType === 'DOCUMENT') category = 'DOCUMENT';
    else if (referenceType === 'CHECKOUT') category = 'CHECKOUT';
    else if (referenceType === 'APPROVAL') category = 'APPROVAL';
    else if (referenceType === 'SIGNATURE') category = 'SIGNATURE';

    return this.createAuditLog({
      userId,
      action,
      category,
      eventType: `${referenceType}_UPDATED`,
      referenceType,
      referenceId,
      previousState,
      newState,
      description: `${referenceType} resource modification action: ${action}`,
    }, tx);
  }

  /**
   * Logs failures occurring during business execution.
   */
  async recordFailedAction(action, error, userId, details = {}, tx) {
    const category = details.category || 'SYSTEM';
    return this.createAuditLog({
      userId,
      action,
      category,
      eventType: `${action}_FAILED`,
      result: 'FAILED',
      description: `Action ${action} failed: ${error?.message || String(error)}`,
      metadata: { ...details, error: error?.message || String(error) },
    }, tx);
  }

  // =========================================================================
  // Future Component Integrations (Helpers)
  // =========================================================================

  async recordDocumentEvent(documentId, action, userId, details = {}, tx) {
    return this.createAuditLog({
      userId,
      action,
      category: 'DOCUMENT',
      eventType: `DOCUMENT_${action}`,
      referenceType: 'DOCUMENT',
      referenceId: documentId,
      description: details.description || `Document event: ${action}`,
      metadata: details,
    }, tx);
  }

  async recordCheckoutEvent(checkoutId, action, userId, details = {}, tx) {
    return this.createAuditLog({
      userId,
      action,
      category: 'CHECKOUT',
      eventType: `CHECKOUT_${action}`,
      referenceType: 'CHECKOUT',
      referenceId: checkoutId,
      description: details.description || `Checkout event: ${action}`,
      metadata: details,
    }, tx);
  }

  async recordApprovalEvent(approvalId, action, userId, details = {}, tx) {
    return this.createAuditLog({
      userId,
      action,
      category: 'APPROVAL',
      eventType: `APPROVAL_${action}`,
      referenceType: 'APPROVAL',
      referenceId: approvalId,
      description: details.description || `Approval workflow event: ${action}`,
      metadata: details,
    }, tx);
  }

  async recordSignatureEvent(signatureId, action, userId, details = {}, tx) {
    return this.createAuditLog({
      userId,
      action,
      category: 'SIGNATURE',
      eventType: `SIGNATURE_${action}`,
      referenceType: 'SIGNATURE',
      referenceId: signatureId,
      description: details.description || `Signature event: ${action}`,
      metadata: details,
    }, tx);
  }

  // =========================================================================
  // Query Integration Methods
  // =========================================================================

  async getScopedFilters(user) {
    if (!user) return { userId: 'none' };
    if (user.role === 'ADMIN') {
      return {}; // complete visibility
    }
    if (user.role === 'EDITOR') {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: { department: true }
      });
      if (!dbUser || !dbUser.department) {
        return { userId: user.id };
      }
      return { departmentSnapshot: dbUser.department.name };
    }
    return { userId: user.id };
  }

  async getAuditDetails(id, requestUser) {
    const log = await this.auditRepository.findById(id);
    if (!log) return null;

    const scopeFilters = await this.getScopedFilters(requestUser);
    if (scopeFilters.userId && log.userId !== scopeFilters.userId) {
      throw new Error('Access denied: Unauthorized log view.');
    }
    if (scopeFilters.departmentSnapshot && log.departmentSnapshot !== scopeFilters.departmentSnapshot) {
      throw new Error('Access denied: Unauthorized log view for different department.');
    }

    const formatted = auditUtil.formatAuditResponse(log);
    if (requestUser && requestUser.role !== 'ADMIN') {
      delete formatted.recordHash;
      delete formatted.prevRecordHash;
    }
    return formatted;
  }

  async searchAuditLogs(filters, options, requestUser) {
    const scopeFilters = await this.getScopedFilters(requestUser);
    const combinedFilters = { ...filters, ...scopeFilters };
    const { logs, total } = await this.auditRepository.list(combinedFilters, options);
    return {
      logs: logs.map(auditUtil.formatAuditResponse),
      total,
    };
  }

  async getUserActivity(userId) {
    const { logs } = await this.auditRepository.getUserActivityTimeline(userId);
    return logs.map(auditUtil.formatAuditResponse);
  }

  async getResourceHistory(refType, refId) {
    const { logs } = await this.auditRepository.getResourceTimeline(refType, refId);
    return logs.map(auditUtil.formatAuditResponse);
  }

  async getSecurityEvents() {
    const { logs } = await this.auditRepository.getSecurityTimeline();
    return logs.map(auditUtil.formatAuditResponse);
  }

  // =========================================================================
  // Timeline Orchestrators
  // =========================================================================

  async getUserTimeline(userId, filters = {}, options = {}, groupingType = null, requestUser = null) {
    const scopeFilters = await this.getScopedFilters(requestUser);
    if (scopeFilters.userId && scopeFilters.userId !== userId) {
      throw new Error('Access denied: Unauthorized timeline request.');
    }
    if (scopeFilters.departmentSnapshot) {
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        include: { department: true }
      });
      if (!targetUser || !targetUser.department || targetUser.department.name !== scopeFilters.departmentSnapshot) {
        throw new Error('Access denied: Unauthorized timeline request for different department.');
      }
    }

    const { logs, total } = await this.auditRepository.getUserActivityTimeline(userId, { ...filters, ...scopeFilters }, options);
    const events = logs.map(auditUtil.buildTimelineEvent);
    const data = groupingType ? auditUtil.groupTimelineEvents(events, groupingType) : events;
    return { data, total };
  }

  async getResourceTimeline(referenceType, referenceId, filters = {}, options = {}, groupingType = null, requestUser = null) {
    const scopeFilters = await this.getScopedFilters(requestUser);
    const { logs, total } = await this.auditRepository.getResourceTimeline(referenceType, referenceId, { ...filters, ...scopeFilters }, options);
    const events = logs.map(auditUtil.buildTimelineEvent);
    const data = groupingType ? auditUtil.groupTimelineEvents(events, groupingType) : events;
    return { data, total };
  }

  async getDocumentTimeline(documentId, filters = {}, options = {}, groupingType = null, requestUser = null) {
    const scopeFilters = await this.getScopedFilters(requestUser);
    const { logs, total } = await this.auditRepository.getDocumentTimeline(documentId, { ...filters, ...scopeFilters }, options);
    const events = logs.map(auditUtil.buildTimelineEvent);
    const data = groupingType ? auditUtil.groupTimelineEvents(events, groupingType) : events;
    return { data, total };
  }

  async getSecurityTimeline(filters = {}, options = {}, groupingType = null, requestUser = null) {
    const scopeFilters = await this.getScopedFilters(requestUser);
    const { logs, total } = await this.auditRepository.getSecurityTimeline({ ...filters, ...scopeFilters }, options);
    const events = logs.map(auditUtil.buildTimelineEvent);
    const data = groupingType ? auditUtil.groupTimelineEvents(events, groupingType) : events;
    return { data, total };
  }

  async getSystemTimeline(filters = {}, options = {}, groupingType = null, requestUser = null) {
    const scopeFilters = await this.getScopedFilters(requestUser);
    const { logs, total } = await this.auditRepository.getSystemTimeline({ ...filters, ...scopeFilters }, options);
    const events = logs.map(auditUtil.buildTimelineEvent);
    const data = groupingType ? auditUtil.groupTimelineEvents(events, groupingType) : events;
    return { data, total };
  }

  // =========================================================================
  // Integrity Chain Validation Workflow
  // =========================================================================

  /**
   * Performs chronological validation of the audit database log table.
   * Walks the hash links to verify block chain continuity.
   * 
   * @async
   * @method validateAuditIntegrity
   * @returns {Promise<{isValid: boolean, anomalies: Array<Object>}>}
   */
  async validateAuditIntegrity() {
    try {
      // Fetch all records ordered chronologically by sequenceNumber
      const { logs } = await this.auditRepository.list({}, {
        limit: 1000000,
        sortBy: 'sequenceNumber',
        sortOrder: 'asc'
      });

      let prevHash = '';
      const anomalies = [];

      for (const log of logs) {
        // Re-construct the hash parameters payload
        const hashPayload = {
          eventRef: log.eventRef,
          userId: log.userId,
          eventType: log.eventType,
          category: log.category,
          action: log.action,
          description: log.description,
          referenceType: log.referenceType,
          referenceId: log.referenceId,
          previousState: log.previousState,
          newState: log.newState,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          result: log.result,
        };

        const calculated = auditUtil.generateAuditHash(hashPayload, prevHash);

        if (log.prevRecordHash !== prevHash) {
          anomalies.push({
            id: log.id,
            eventRef: log.eventRef,
            type: 'CHAIN_LINK_MISMATCH',
            expected: prevHash,
            actual: log.prevRecordHash,
          });
        }

        if (log.recordHash !== calculated) {
          anomalies.push({
            id: log.id,
            eventRef: log.eventRef,
            type: 'HASH_VERIFICATION_FAILURE',
            expected: calculated,
            actual: log.recordHash,
          });
        }

        prevHash = log.recordHash || '';
      }

      return {
        isValid: anomalies.length === 0,
        anomalies,
      };
    } catch (err) {
      console.error('[AuditService] Integrity check critical error:', err);
      throw new Error(`Audit validation failed: ${err.message}`);
    }
  }
}

export default AuditService;
