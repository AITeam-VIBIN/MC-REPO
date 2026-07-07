import { prisma } from '../config/database.js';

export class ApprovalRepositoryError extends Error {
  constructor(message, code = 'REPOSITORY_ERROR', originalError = null) {
    super(message);
    this.name = 'ApprovalRepositoryError';
    this.code = code;
    this.originalError = originalError;
  }
}

function handlePrismaError(err, operationName) {
  console.error(`[ApprovalRepository] Error in ${operationName}:`, err);
  
  if (err instanceof ApprovalRepositoryError) {
    throw err;
  }

  if (err.code === 'P2002') {
    const fields = err.meta?.target ? err.meta.target.join(', ') : 'fields';
    throw new ApprovalRepositoryError(
      `Unique constraint violation: A record with this value already exists on ${fields}.`,
      'DUPLICATE_RECORD',
      err
    );
  }
  
  if (err.code === 'P2025') {
    throw new ApprovalRepositoryError(
      `Target record for operation was not found.`,
      'RECORD_NOT_FOUND',
      err
    );
  }

  throw new ApprovalRepositoryError(
    `Database error occurred during ${operationName}: ${err.message}`,
    'DATABASE_ERROR',
    err
  );
}

export class ApprovalRepository {
  _defaultIncludes = {
    requester: {
      select: {
        id: true,
        email: true,
        role: true,
      }
    },
    currentApprover: {
      select: {
        id: true,
        email: true,
        role: true,
      }
    },
    steps: {
      include: {
        approver: {
          select: {
            id: true,
            email: true,
            role: true,
          }
        }
      },
      orderBy: {
        stepNumber: 'asc'
      }
    },
    history: {
      orderBy: {
        createdAt: 'asc'
      }
    }
  };

  /**
   * Create a new approval request.
   */
  async createApprovalRequest(data, tx = null) {
    const client = tx || prisma;
    try {
      return await client.approvalRequest.create({
        data: {
          id: data.id || undefined,
          referenceType: data.referenceType,
          referenceId: data.referenceId,
          title: data.title,
          description: data.description || null,
          reason: data.reason || null,
          requesterId: data.requesterId,
          requesterName: data.requesterName || null,
          requesterDepartment: data.requesterDepartment || null,
          requesterDesignation: data.requesterDesignation || null,
          currentStep: data.currentStep || 1,
          totalSteps: data.totalSteps || 1,
          currentApproverId: data.currentApproverId || null,
          approvalLevel: data.approvalLevel || null,
          priority: data.priority || 'NORMAL',
          status: data.status || 'DRAFT',
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'createApprovalRequest');
    }
  }

  /**
   * Update an existing approval request.
   */
  async updateApprovalRequest(id, updateData, tx = null) {
    const client = tx || prisma;
    try {
      return await client.approvalRequest.update({
        where: { id },
        data: {
          title: updateData.title,
          description: updateData.description,
          reason: updateData.reason,
          currentStep: updateData.currentStep,
          totalSteps: updateData.totalSteps,
          currentApproverId: updateData.currentApproverId,
          approvalLevel: updateData.approvalLevel,
          priority: updateData.priority,
          status: updateData.status,
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'updateApprovalRequest');
    }
  }

  /**
   * Find an approval request by ID.
   */
  async findById(id, options = {}) {
    try {
      const record = await prisma.approvalRequest.findUnique({
        where: { id },
        include: options.include || this._defaultIncludes,
      });

      if (!record) return null;
      if (record.isDeleted && !options.includeDeleted) return null;

      return record;
    } catch (err) {
      handlePrismaError(err, 'findById');
    }
  }

  /**
   * Find approvals by polymorphic reference.
   */
  async findByReference(referenceType, referenceId, options = {}) {
    try {
      const where = {
        referenceType,
        referenceId,
        isDeleted: false,
      };

      if (options.includeDeleted) {
        delete where.isDeleted;
      }

      return await prisma.approvalRequest.findMany({
        where,
        include: options.include || this._defaultIncludes,
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      handlePrismaError(err, 'findByReference');
    }
  }

  /**
   * Find active non-completed approval for a reference resource.
   */
  async findActiveApproval(referenceType, referenceId) {
    try {
      return await prisma.approvalRequest.findFirst({
        where: {
          referenceType,
          referenceId,
          isDeleted: false,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'findActiveApproval');
    }
  }

  /**
   * Soft-delete an approval request.
   */
  async softDelete(id, deletedBy, tx = null) {
    const client = tx || prisma;
    try {
      return await client.approvalRequest.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy,
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'softDelete');
    }
  }

  /**
   * Restore a soft-deleted approval request.
   */
  async restore(id, tx = null) {
    const client = tx || prisma;
    try {
      return await client.approvalRequest.update({
        where: { id },
        data: {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'restore');
    }
  }

  /**
   * Retrieve list of approvals with sorting, filtering and pagination.
   */
  async findAll(filters = {}, options = {}) {
    try {
      const where = { isDeleted: false };

      if (options.includeDeleted) {
        delete where.isDeleted;
      }

      if (filters.referenceType) where.referenceType = filters.referenceType;
      if (filters.referenceId) where.referenceId = filters.referenceId;
      if (filters.requesterId) where.requesterId = filters.requesterId;
      if (filters.currentApproverId) where.currentApproverId = filters.currentApproverId;
      if (filters.priority) where.priority = filters.priority;
      if (filters.OR) where.OR = filters.OR;

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          where.status = { in: filters.status };
        } else {
          where.status = filters.status;
        }
      }

      if (filters.department) {
        where.requesterDepartment = { contains: filters.department, mode: 'insensitive' };
      }

      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
          { requesterName: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
        if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
      }

      const orderBy = {};
      const sortField = options.sort || 'createdAt';
      const sortOrder = options.order || 'desc';
      orderBy[sortField] = sortOrder;

      const page = parseInt(options.page || 1, 10);
      const limit = parseInt(options.limit || 20, 10);
      const skip = (page - 1) * limit;

      const [approvals, totalRecords] = await Promise.all([
        prisma.approvalRequest.findMany({
          where,
          include: options.include || this._defaultIncludes,
          orderBy,
          skip,
          take: limit,
        }),
        prisma.approvalRequest.count({ where }),
      ]);

      return {
        approvals,
        pagination: {
          totalRecords,
          page,
          limit,
          totalPages: Math.ceil(totalRecords / limit),
        }
      };
    } catch (err) {
      handlePrismaError(err, 'findAll');
    }
  }

  /**
   * Create workflow approval steps.
   */
  async createApprovalSteps(stepsData, tx = null) {
    const client = tx || prisma;
    try {
      return await client.approvalStep.createMany({
        data: stepsData.map(step => ({
          id: step.id || undefined,
          approvalRequestId: step.approvalRequestId,
          stepNumber: step.stepNumber,
          approverId: step.approverId,
          approverRole: step.approverRole || null,
          status: step.status || 'PENDING',
          approverName: step.approverName || null,
        }))
      });
    } catch (err) {
      handlePrismaError(err, 'createApprovalSteps');
    }
  }

  /**
   * Update an individual step properties.
   */
  async updateStep(stepId, data, tx = null) {
    const client = tx || prisma;
    try {
      return await client.approvalStep.update({
        where: { id: stepId },
        data: {
          status: data.status,
          decisionDate: data.decisionDate ? new Date(data.decisionDate) : null,
          comments: data.comments,
          actionTaken: data.actionTaken,
          approverId: data.approverId,
          approverName: data.approverName,
        }
      });
    } catch (err) {
      handlePrismaError(err, 'updateStep');
    }
  }

  /**
   * Get steps sorted for a specific request.
   */
  async getStepsForRequest(requestId) {
    try {
      return await prisma.approvalStep.findMany({
        where: { approvalRequestId: requestId },
        include: {
          approver: {
            select: {
              id: true,
              email: true,
              role: true,
            }
          }
        },
        orderBy: { stepNumber: 'asc' },
      });
    } catch (err) {
      handlePrismaError(err, 'getStepsForRequest');
    }
  }

  /**
   * Immutable history record creation.
   */
  async createHistoryEntry(historyData, tx = null) {
    const client = tx || prisma;
    try {
      return await client.approvalHistory.create({
        data: {
          approvalRequestId: historyData.approvalRequestId,
          action: historyData.action,
          performedBy: historyData.performedBy,
          previousState: historyData.previousState,
          newState: historyData.newState,
          remarks: historyData.remarks || null,
        }
      });
    } catch (err) {
      handlePrismaError(err, 'createHistoryEntry');
    }
  }

  /**
   * Get timelines.
   */
  async getTimeline(requestId) {
    try {
      return await prisma.approvalHistory.findMany({
        where: { approvalRequestId: requestId },
        orderBy: { createdAt: 'asc' },
      });
    } catch (err) {
      handlePrismaError(err, 'getTimeline');
    }
  }

  /**
   * Aggregates counts and stats.
   */
  async getStats(options = {}) {
    try {
      const where = { isDeleted: false };
      if (options.requesterId) where.requesterId = options.requesterId;
      if (options.currentApproverId) where.currentApproverId = options.currentApproverId;

      const [
        totalRequests,
        pendingCount,
        inProgressCount,
        approvedCount,
        rejectedCount,
        cancelledCount,
        expiredCount,
        groupedByDept,
        groupedByStatus
      ] = await Promise.all([
        prisma.approvalRequest.count({ where }),
        prisma.approvalRequest.count({ where: { ...where, status: 'PENDING' } }),
        prisma.approvalRequest.count({ where: { ...where, status: 'IN_PROGRESS' } }),
        prisma.approvalRequest.count({ where: { ...where, status: 'APPROVED' } }),
        prisma.approvalRequest.count({ where: { ...where, status: 'REJECTED' } }),
        prisma.approvalRequest.count({ where: { ...where, status: 'CANCELLED' } }),
        prisma.approvalRequest.count({ where: { ...where, status: 'EXPIRED' } }),
        prisma.approvalRequest.groupBy({
          by: ['requesterDepartment'],
          where,
          _count: { id: true }
        }),
        prisma.approvalRequest.groupBy({
          by: ['status'],
          where,
          _count: { id: true }
        })
      ]);

      const requestsByDepartment = {};
      groupedByDept.forEach(item => {
        if (item.requesterDepartment) {
          requestsByDepartment[item.requesterDepartment] = item._count.id;
        }
      });

      const requestsByStatus = {};
      groupedByStatus.forEach(item => {
        requestsByStatus[item.status] = item._count.id;
      });

      return {
        totalRequests,
        pendingCount,
        inProgressCount,
        approvedCount,
        rejectedCount,
        cancelledCount,
        expiredCount,
        requestsByDepartment,
        requestsByStatus,
        averageApprovalTimeSeconds: 0, // Placeholder for future duration stats
      };
    } catch (err) {
      handlePrismaError(err, 'getStats');
    }
  }
}
export default ApprovalRepository;
