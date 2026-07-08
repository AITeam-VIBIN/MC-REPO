import { prisma } from '../config/database.js';

/**
 * Standardized repository error class for Audit Domain operations.
 */
export class AuditRepositoryError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {string} [code='AUDIT_REPOSITORY_ERROR'] - Error categorization code
   * @param {Error} [originalError] - The underlying Prisma/DB exception
   */
  constructor(message, code = 'AUDIT_REPOSITORY_ERROR', originalError = null) {
    super(message);
    this.name = 'AuditRepositoryError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * Maps Prisma errors to standard AuditRepositoryError.
 * 
 * @function handlePrismaError
 * @param {Error} err - Caught exception
 * @param {string} operationName - Name of the repository operation
 * @returns {never} Always throws AuditRepositoryError
 */
function handlePrismaError(err, operationName) {
  console.error(`[AuditRepository] Error in ${operationName}:`, err);
  
  if (err instanceof AuditRepositoryError) {
    throw err;
  }

  if (err.code === 'P2002') {
    const fields = err.meta?.target ? err.meta.target.join(', ') : 'fields';
    throw new AuditRepositoryError(
      `Unique constraint violation: A record with this value already exists on ${fields}.`,
      'DUPLICATE_RECORD',
      err
    );
  }
  
  if (err.code === 'P2025') {
    throw new AuditRepositoryError(
      `Target audit record was not found.`,
      'RECORD_NOT_FOUND',
      err
    );
  }

  throw new AuditRepositoryError(
    `Database error occurred during audit ${operationName}: ${err.message}`,
    'DATABASE_ERROR',
    err
  );
}

/**
 * Database repository implementation for Audit operations.
 * Abstractions of queries utilizing Prisma client singletons.
 */
export class AuditRepository {
  /**
   * Default relations loaded with AuditLog profiles.
   * @private
   */
  _defaultIncludes = {
    user: {
      select: {
        id: true,
        email: true,
        role: true,
        departmentId: true,
      }
    }
  };

  /**
   * Helper to select the database client context (transaction-aware).
   * @private
   * @param {Object} [tx] - Optional Prisma transactional context
   * @returns {Object} Prisma database client instance
   */
  _getClient(tx) {
    return tx || prisma;
  }

  // =========================================================================
  // Append Only Audit Creation
  // =========================================================================

  /**
   * Persist a new immutable audit log record.
   * Enforces that only INSERT operations are allowed.
   * 
   * @async
   * @method create
   * @param {Object} data - Audit log payload
   * @param {Object} [tx] - Optional transaction client context
   * @returns {Promise<Object>} The created audit record
   * @throws {AuditRepositoryError}
   */
  async create(data, tx) {
    try {
      const client = this._getClient(tx);
      return await client.auditLog.create({
        data: {
          eventRef: data.eventRef,
          userId: data.userId || null,
          userSnapshot: data.userSnapshot || null,
          roleSnapshot: data.roleSnapshot || null,
          departmentSnapshot: data.departmentSnapshot || null,
          eventType: data.eventType,
          category: data.category,
          action: data.action,
          description: data.description || null,
          referenceType: data.referenceType || null,
          referenceId: data.referenceId || null,
          previousState: data.previousState || null,
          newState: data.newState || null,
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null,
          device: data.device || null,
          browser: data.browser || null,
          os: data.os || null,
          sessionId: data.sessionId || null,
          authMethod: data.authMethod || null,
          mfaStatus: data.mfaStatus || null,
          permissionUsed: data.permissionUsed || null,
          result: data.result,
          metadata: data.metadata || null,
          recordHash: data.recordHash || null,
          prevRecordHash: data.prevRecordHash || null,
          retentionPeriod: data.retentionPeriod || null,
          archiveStatus: data.archiveStatus || 'ACTIVE',
          archivedAt: data.archivedAt || null,
          createdAt: data.createdAt || undefined, // use default @default(now()) if not set
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'create');
    }
  }

  /**
   * Block updating existing audit log records to preserve immutability.
   * @throws {AuditRepositoryError} Always throws because updates are blocked
   */
  async update() {
    throw new AuditRepositoryError('Audit log records are immutable and cannot be updated.', 'UNAUTHORIZED_MUTATION');
  }

  /**
   * Block deleting audit logs.
   * @throws {AuditRepositoryError} Always throws because deletes are blocked
   */
  async delete() {
    throw new AuditRepositoryError('Audit log records cannot be deleted. History must be preserved.', 'UNAUTHORIZED_MUTATION');
  }

  // =========================================================================
  // Audit Retrieval & Queries
  // =========================================================================

  /**
   * Find a single audit log record by its ID.
   * 
   * @async
   * @method findById
   * @param {string} id - Audit primary UUID
   * @returns {Promise<Object|null>} Resolved record or null
   */
  async findById(id) {
    try {
      return await prisma.auditLog.findUnique({
        where: { id },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'findById');
    }
  }

  /**
   * Find a single audit log record by its Event Reference Number.
   * 
   * @async
   * @method findByEventRef
   * @param {string} eventRef - Unique Event reference code
   * @returns {Promise<Object|null>} Resolved record or null
   */
  async findByEventRef(eventRef) {
    try {
      return await prisma.auditLog.findUnique({
        where: { eventRef },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'findByEventRef');
    }
  }

  /**
   * List audit logs with dynamic advanced filtering, pagination, and sorting.
   * 
   * @async
   * @method list
   * @param {Object} [filters={}] - Query filtering parameters
   * @param {Object} [options={}] - Pagination and sorting options
   * @returns {Promise<{logs: Array<Object>, total: number}>} Resolved list and count
   */
  async list(filters = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = options;

      const skip = (page - 1) * limit;

      const whereClause = this._buildWhereClause(filters);

      const [logs, total] = await prisma.$transaction([
        prisma.auditLog.findMany({
          where: whereClause,
          include: this._defaultIncludes,
          orderBy: { [sortBy]: sortOrder },
          take: limit,
          skip,
        }),
        prisma.auditLog.count({
          where: whereClause,
        }),
      ]);

      return { logs, total };
    } catch (err) {
      handlePrismaError(err, 'list');
    }
  }

  /**
   * Private helper to build Prisma where clause dynamically.
   * 
   * @private
   * @param {Object} filters
   * @returns {Object} Prisma where structure
   */
  _buildWhereClause(filters) {
    const where = {};

    if (filters.id) where.id = filters.id;
    if (filters.eventRef) where.eventRef = filters.eventRef;
    if (filters.userId) where.userId = filters.userId;
    if (filters.referenceType) where.referenceType = filters.referenceType;
    if (filters.referenceId) where.referenceId = filters.referenceId;
    if (filters.category) where.category = filters.category;
    if (filters.action) where.action = filters.action;
    if (filters.result) where.result = filters.result;
    if (filters.ipAddress) where.ipAddress = filters.ipAddress;
    if (filters.sessionId) where.sessionId = filters.sessionId;
    if (filters.archiveStatus) where.archiveStatus = filters.archiveStatus;

    // Snapshot criteria matching (Role/Department)
    if (filters.role) {
      where.roleSnapshot = { contains: filters.role, mode: 'insensitive' };
    }
    if (filters.department) {
      where.departmentSnapshot = { contains: filters.department, mode: 'insensitive' };
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      where.createdAt = {
        ...(filters.startDate && { gte: new Date(filters.startDate) }),
        ...(filters.endDate && { lte: new Date(filters.endDate) }),
      };
    }

    // Search query mapping across descriptive properties
    if (filters.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { eventType: { contains: filters.search, mode: 'insensitive' } },
        { eventRef: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  // =========================================================================
  // Timeline Queries
  // =========================================================================

  /**
   * Retrieve activity logs bound to a specific resource (ordered chronologically newest first).
   * 
   * @async
   * @method getResourceTimeline
   * @param {string} referenceType - Target resource domain (e.g. 'DOCUMENT')
   * @param {string} referenceId - UUID of the target resource
   * @returns {Promise<Array<Object>>} List of matching audit records
   */
  /**
   * Retrieve activity logs bound to a specific resource (ordered chronologically newest first).
   * 
   * @async
   * @method getResourceTimeline
   * @param {string} referenceType - Target resource domain (e.g. 'DOCUMENT')
   * @param {string} referenceId - UUID of the target resource
   * @param {Object} [filters={}] - Optional additional filters
   * @param {Object} [options={}] - Pagination and sorting options
   * @returns {Promise<{logs: Array<Object>, total: number}>} List of matching audit records and count
   */
  async getResourceTimeline(referenceType, referenceId, filters = {}, options = {}) {
    return this.list({ ...filters, referenceType, referenceId }, options);
  }

  /**
   * Retrieve activity logs generated by a specific user.
   * 
   * @async
   * @method getUserActivityTimeline
   * @param {string} userId - User identifier
   * @param {Object} [filters={}] - Optional additional filters
   * @param {Object} [options={}] - Pagination and sorting options
   * @returns {Promise<{logs: Array<Object>, total: number}>} List of matching audit records and count
   */
  async getUserActivityTimeline(userId, filters = {}, options = {}) {
    return this.list({ ...filters, userId }, options);
  }

  /**
   * Retrieve logs categorized as system administration and operational configuration changes.
   * 
   * @async
   * @method getSystemTimeline
   * @param {Object} [filters={}] - Optional additional filters
   * @param {Object} [options={}] - Pagination and sorting options
   * @returns {Promise<{logs: Array<Object>, total: number}>} List of matching audit records and count
   */
  async getSystemTimeline(filters = {}, options = {}) {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = options;
      const skip = (page - 1) * limit;
      const baseWhere = this._buildWhereClause(filters);
      
      const whereClause = {
        ...baseWhere,
        category: { in: ['SYSTEM', 'USER_MANAGEMENT'] }
      };

      const [logs, total] = await prisma.$transaction([
        prisma.auditLog.findMany({
          where: whereClause,
          include: this._defaultIncludes,
          orderBy: { [sortBy]: sortOrder },
          take: limit,
          skip,
        }),
        prisma.auditLog.count({
          where: whereClause,
        })
      ]);

      return { logs, total };
    } catch (err) {
      handlePrismaError(err, 'getSystemTimeline');
    }
  }

  /**
   * Retrieve logs for a specific document.
   * 
   * @async
   * @method getDocumentTimeline
   * @param {string} documentId - Document UUID
   * @param {Object} [filters={}] - Additional filters
   * @param {Object} [options={}] - Pagination and sorting
   * @returns {Promise<{logs: Array<Object>, total: number}>}
   */
  async getDocumentTimeline(documentId, filters = {}, options = {}) {
    return this.getResourceTimeline('DOCUMENT', documentId, filters, options);
  }

  /**
   * Retrieve security events.
   * 
   * @async
   * @method getSecurityTimeline
   * @param {Object} [filters={}] - Additional filters
   * @param {Object} [options={}] - Pagination and sorting
   * @returns {Promise<{logs: Array<Object>, total: number}>}
   */
  async getSecurityTimeline(filters = {}, options = {}) {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = options;
      const skip = (page - 1) * limit;
      const baseWhere = this._buildWhereClause(filters);
      
      const whereClause = {
        ...baseWhere,
        OR: [
          { category: 'SECURITY' },
          { result: { in: ['FAILED', 'DENIED'] } }
        ]
      };

      const [logs, total] = await prisma.$transaction([
        prisma.auditLog.findMany({
          where: whereClause,
          include: this._defaultIncludes,
          orderBy: { [sortBy]: sortOrder },
          take: limit,
          skip,
        }),
        prisma.auditLog.count({
          where: whereClause,
        })
      ]);

      return { logs, total };
    } catch (err) {
      handlePrismaError(err, 'getSecurityTimeline');
    }
  }

  // =========================================================================
  // Compliance Pre-set Queries
  // =========================================================================

  /**
   * Queries auditing records for a specific Document.
   */
  async getDocumentActivity(documentId) {
    return this.getResourceTimeline('DOCUMENT', documentId);
  }

  /**
   * Queries activity logs generated by a user.
   */
  async getUserActivity(userId) {
    return this.getUserActivityTimeline(userId);
  }

  /**
   * Queries security-critical audit trails (e.g. login failures, permission breaches).
   */
  async getSecurityEvents() {
    try {
      return await prisma.auditLog.findMany({
        where: {
          OR: [
            { category: 'SECURITY' },
            { result: { in: ['FAILED', 'DENIED'] } }
          ]
        },
        include: this._defaultIncludes,
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      handlePrismaError(err, 'getSecurityEvents');
    }
  }

  /**
   * Queries audit logs with failed status results.
   */
  async getFailedActions() {
    try {
      return await prisma.auditLog.findMany({
        where: { result: 'FAILED' },
        include: this._defaultIncludes,
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      handlePrismaError(err, 'getFailedActions');
    }
  }

  /**
   * Queries audit logs where action was denied due to permission constraints.
   */
  async getPermissionDenials() {
    try {
      return await prisma.auditLog.findMany({
        where: { result: 'DENIED' },
        include: this._defaultIncludes,
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      handlePrismaError(err, 'getPermissionDenials');
    }
  }

  /**
   * Queries authentication history (logins and logouts).
   */
  async getAuthenticationHistory() {
    try {
      return await prisma.auditLog.findMany({
        where: { category: 'AUTHENTICATION' },
        include: this._defaultIncludes,
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      handlePrismaError(err, 'getAuthenticationHistory');
    }
  }

  /**
   * Queries downloads history.
   */
  async getDownloadHistory() {
    try {
      return await prisma.auditLog.findMany({
        where: { category: 'DOCUMENT', action: 'DOWNLOAD' },
        include: this._defaultIncludes,
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      handlePrismaError(err, 'getDownloadHistory');
    }
  }

  /**
   * Queries checkout history.
   */
  async getCheckoutHistory() {
    try {
      return await prisma.auditLog.findMany({
        where: { category: 'CHECKOUT' },
        include: this._defaultIncludes,
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      handlePrismaError(err, 'getCheckoutHistory');
    }
  }

  /**
   * Queries approval workflows history.
   */
  async getApprovalHistory() {
    try {
      return await prisma.auditLog.findMany({
        where: { category: 'APPROVAL' },
        include: this._defaultIncludes,
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      handlePrismaError(err, 'getApprovalHistory');
    }
  }

  /**
   * Queries digital signatures bind/verification events.
   */
  async getSignatureHistory() {
    try {
      return await prisma.auditLog.findMany({
        where: { category: 'SIGNATURE' },
        include: this._defaultIncludes,
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      handlePrismaError(err, 'getSignatureHistory');
    }
  }

  // =========================================================================
  // Statistics Queries (Dashboards)
  // =========================================================================

  /**
   * Counts the total number of events recorded in the system.
   */
  async getTotalEventsCount() {
    try {
      return await prisma.auditLog.count();
    } catch (err) {
      handlePrismaError(err, 'getTotalEventsCount');
    }
  }

  /**
   * Counts the total number of events registered today.
   */
  async getEventsTodayCount() {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return await prisma.auditLog.count({
        where: {
          createdAt: { gte: todayStart },
        },
      });
    } catch (err) {
      handlePrismaError(err, 'getEventsTodayCount');
    }
  }

  /**
   * Group audit logs and fetch counters grouped by Event Category.
   */
  async getEventsCountByCategory() {
    try {
      return await prisma.auditLog.groupBy({
        by: ['category'],
        _count: { id: true },
      });
    } catch (err) {
      handlePrismaError(err, 'getEventsCountByCategory');
    }
  }

  /**
   * Group audit logs and fetch counters grouped by Action.
   */
  async getEventsCountByAction() {
    try {
      return await prisma.auditLog.groupBy({
        by: ['action'],
        _count: { id: true },
      });
    } catch (err) {
      handlePrismaError(err, 'getEventsCountByAction');
    }
  }

  /**
   * Counts the number of failed execution events.
   */
  async getFailedEventsCount() {
    try {
      return await prisma.auditLog.count({
        where: { result: 'FAILED' },
      });
    } catch (err) {
      handlePrismaError(err, 'getFailedEventsCount');
    }
  }

  /**
   * Counts security logs (failures or explicit security category).
   */
  async getSecurityEventsCount() {
    try {
      return await prisma.auditLog.count({
        where: {
          OR: [
            { category: 'SECURITY' },
            { result: { in: ['FAILED', 'DENIED'] } }
          ],
        },
      });
    } catch (err) {
      handlePrismaError(err, 'getSecurityEventsCount');
    }
  }

  /**
   * Retrieve counts of events grouped by User.
   */
  async getUserActivityCount() {
    try {
      return await prisma.auditLog.groupBy({
        by: ['userId'],
        where: { userId: { not: null } },
        _count: { id: true },
      });
    } catch (err) {
      handlePrismaError(err, 'getUserActivityCount');
    }
  }

  // =========================================================================
  // Integrity Chain Support
  // =========================================================================

  /**
   * Retrieve the latest record added to the audit logs to extract the previous hash chain node.
   * 
   * @async
   * @method getLatestRecord
   * @returns {Promise<Object|null>} Newest audit record
   */
  async getLatestRecord() {
    try {
      const records = await prisma.auditLog.findMany({
        orderBy: { sequenceNumber: 'desc' },
        take: 1,
      });
      return records[0] || null;
    } catch (err) {
      handlePrismaError(err, 'getLatestRecord');
    }
  }

  // =========================================================================
  // Retention & Archival Support
  // =========================================================================

  /**
   * Retrieve audit records that have passed their retention period (in days) relative to current date.
   * 
   * @async
   * @method findExpiredRecords
   * @returns {Promise<Array<Object>>} Expired logs
   */
  async findExpiredRecords() {
    try {
      const now = new Date();
      const logsWithRetention = await prisma.auditLog.findMany({
        where: {
          archiveStatus: 'ACTIVE',
          retentionPeriod: { not: null },
        },
      });

      return logsWithRetention.filter(log => {
        const expiryDate = new Date(log.createdAt);
        expiryDate.setDate(expiryDate.getDate() + log.retentionPeriod);
        return expiryDate <= now;
      });
    } catch (err) {
      handlePrismaError(err, 'findExpiredRecords');
    }
  }

  /**
   * Administrative exception: Mark records as archived.
   * This is the only allowed state update to satisfy compliance requirements.
   * 
   * @async
   * @method markArchived
   * @param {Array<string>} ids - Audit log IDs
   * @returns {Promise<Object>} Prisma update response
   */
  async markArchived(ids) {
    try {
      return await prisma.auditLog.updateMany({
        where: {
          id: { in: ids },
        },
        data: {
          archiveStatus: 'ARCHIVED',
          archivedAt: new Date(),
        },
      });
    } catch (err) {
      handlePrismaError(err, 'markArchived');
    }
  }

  /**
   * Fetch a user record with department info to build audit user snapshots.
   * 
   * @async
   * @method fetchUserSnapshot
   * @param {string} userId - User identifier
   * @returns {Promise<Object|null>} User record with department info
   */
  async fetchUserSnapshot(userId) {
    try {
      return await prisma.user.findUnique({
        where: { id: userId },
        include: { department: true },
      });
    } catch (err) {
      handlePrismaError(err, 'fetchUserSnapshot');
    }
  }
}

export default AuditRepository;
