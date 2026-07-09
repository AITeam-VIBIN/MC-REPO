import { prisma } from '../config/database.js';

export class AnalyticsRepository {
  /**
   * Helper to build date range query object for Prisma.
   */
  buildDateRangeFilter(dateRange, field = 'createdAt') {
    if (!dateRange) return {};
    const { startDate, endDate } = dateRange;
    const filter = {};
    if (startDate) {
      filter.gte = new Date(startDate);
    }
    if (endDate) {
      filter.lte = new Date(endDate);
    }
    return Object.keys(filter).length > 0 ? { [field]: filter } : {};
  }

  // ==========================================
  // Document Aggregations
  // ==========================================

  async getDocumentCounts(dateRange, departmentId) {
    const dateFilter = this.buildDateRangeFilter(dateRange);
    const where = {
      ...dateFilter,
      ...(departmentId && { departmentId }),
    };

    const [total, active, archived, deleted] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.count({ where: { ...where, status: 'ACTIVE' } }),
      prisma.document.count({ where: { ...where, status: 'ARCHIVED' } }),
      prisma.document.count({ where: { ...where, isDeleted: true } }),
    ]);

    // Also get storage usage sum
    const storageSum = await prisma.document.aggregate({
      where,
      _sum: {
        fileSize: true
      }
    });

    return {
      total,
      active,
      archived,
      deleted,
      storageBytes: Number(storageSum._sum.fileSize || 0),
    };
  }

  async getDocumentsByClassification(dateRange, departmentId) {
    const dateFilter = this.buildDateRangeFilter(dateRange);
    const where = {
      ...dateFilter,
      ...(departmentId && { departmentId }),
    };

    return prisma.document.groupBy({
      by: ['classification'],
      where,
      _count: {
        _all: true
      }
    });
  }

  async getDocumentsByDepartment(dateRange) {
    const dateFilter = this.buildDateRangeFilter(dateRange);
    return prisma.document.groupBy({
      by: ['departmentId'],
      where: dateFilter,
      _count: {
        _all: true
      }
    });
  }

  // ==========================================
  // Checkout Aggregations
  // ==========================================

  async getCheckoutCounts(dateRange, userId, departmentName) {
    const dateFilter = this.buildDateRangeFilter(dateRange, 'checkoutDate');
    const where = {
      ...dateFilter,
      ...(userId && { requestedById: userId }),
      ...(departmentName && { department: departmentName })
    };

    const [active, pending, overdue, completed] = await Promise.all([
      prisma.checkout.count({ where: { ...where, status: 'CHECKED_OUT' } }),
      prisma.checkout.count({ where: { ...where, status: { in: ['PENDING_APPROVAL', 'PENDING_RETURN'] } } }),
      prisma.checkout.count({
        where: {
          ...where,
          status: 'CHECKED_OUT',
          expectedReturnDate: { lt: new Date() }
        }
      }),
      prisma.checkout.count({ where: { ...where, status: { in: ['RETURNED', 'CLOSED'] } } }),
    ]);

    return {
      active,
      pending,
      overdue,
      completed,
    };
  }

  // ==========================================
  // Approval Aggregations
  // ==========================================

  async getApprovalCounts(dateRange, userId) {
    const dateFilter = this.buildDateRangeFilter(dateRange);
    const where = {
      ...dateFilter,
      ...(userId && { requesterId: userId }),
    };

    const [pending, approved, rejected] = await Promise.all([
      prisma.approvalRequest.count({ where: { ...where, status: 'PENDING' } }),
      prisma.approvalRequest.count({ where: { ...where, status: 'APPROVED' } }),
      prisma.approvalRequest.count({ where: { ...where, status: 'REJECTED' } }),
    ]);

    return {
      pending,
      approved,
      rejected,
    };
  }

  async getCompletedApprovalTimes(dateRange, userId) {
    const dateFilter = this.buildDateRangeFilter(dateRange);
    const where = {
      ...dateFilter,
      ...(userId && { requesterId: userId }),
      status: { in: ['APPROVED', 'REJECTED'] },
    };

    return prisma.approvalRequest.findMany({
      where,
      select: {
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // ==========================================
  // Signature Aggregations
  // ==========================================

  async getSignatureCounts(dateRange, userId) {
    const dateFilter = this.buildDateRangeFilter(dateRange);
    const where = {
      ...dateFilter,
      ...(userId && { userId }),
    };

    const [total, verified, failed] = await Promise.all([
      prisma.digitalSignature.count({ where }),
      prisma.digitalSignature.count({ where: { ...where, status: 'VERIFIED' } }),
      prisma.digitalSignature.count({ where: { ...where, status: 'FAILED' } }),
    ]);

    return {
      total,
      verified,
      failed,
    };
  }

  // ==========================================
  // Audit Aggregations
  // ==========================================

  async getAuditCounts(dateRange) {
    const dateFilter = this.buildDateRangeFilter(dateRange);
    const where = dateFilter;

    const [total, securityAlerts, failedActions] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.count({ where: { ...where, category: 'SECURITY' } }),
      prisma.auditLog.count({ where: { ...where, result: 'FAILED' } }),
    ]);

    return {
      total,
      securityAlerts,
      failedActions,
    };
  }

  async getAuditEventsByCategory(dateRange) {
    const dateFilter = this.buildDateRangeFilter(dateRange);
    return prisma.auditLog.groupBy({
      by: ['category'],
      where: dateFilter,
      _count: {
        _all: true
      }
    });
  }

  // ==========================================
  // User Aggregations
  // ==========================================

  async getActiveUserCounts(dateRange) {
    const dateFilter = this.buildDateRangeFilter(dateRange);
    // count distinct users who wrote audit logs
    const result = await prisma.auditLog.groupBy({
      by: ['userId'],
      where: {
        ...dateFilter,
        userId: { not: null }
      },
      _count: {
        _all: true
      }
    });
    return result.length;
  }

  async getUserActivityRanking(dateRange, limit = 10) {
    const dateFilter = this.buildDateRangeFilter(dateRange);
    const ranking = await prisma.auditLog.groupBy({
      by: ['userId', 'userSnapshot'],
      where: {
        ...dateFilter,
        userId: { not: null }
      },
      _count: {
        _all: true
      },
      orderBy: {
        _count: {
          userId: 'desc'
        }
      },
      take: limit
    });
    return ranking;
  }
}
