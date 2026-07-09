import { AnalyticsRepository } from '../repositories/analytics.repository.js';
import * as analyticsUtil from '../utils/analytics.util.js';
import { prisma } from '../config/database.js';

export class AnalyticsServiceError extends Error {
  constructor(message, code = 'ANALYTICS_ERROR') {
    super(message);
    this.name = 'AnalyticsServiceError';
    this.code = code;
  }
}

export class AnalyticsService {
  constructor() {
    this.analyticsRepository = new AnalyticsRepository();
  }

  /**
   * Resolves text date shortcuts into absolute date ranges.
   */
  resolveDateRange(rangeType, customStart, customEnd) {
    const end = new Date();
    let start = new Date();

    switch (String(rangeType).toUpperCase()) {
      case 'TODAY':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'LAST_7_DAYS':
        start.setDate(end.getDate() - 7);
        break;
      case 'LAST_30_DAYS':
        start.setDate(end.getDate() - 30);
        break;
      case 'CURRENT_MONTH':
        start = new Date(end.getFullYear(), end.getMonth(), 1);
        break;
      case 'CUSTOM':
        if (customStart) start = new Date(customStart);
        if (customEnd) {
          const customEndDate = new Date(customEnd);
          customEndDate.setHours(23, 59, 59, 999);
          return { startDate: start, endDate: customEndDate };
        }
        break;
      default:
        // Default to last 30 days
        start.setDate(end.getDate() - 30);
    }
    return { startDate: start, endDate: end };
  }

  /**
   * Evaluates user identity context and scopes filters to department or owner.
   */
  async getScopedContext(user) {
    if (!user) {
      throw new AnalyticsServiceError('Access denied: Authentication context missing.', 'UNAUTHORIZED');
    }
    
    // ADMIN has organization-wide access
    if (user.role === 'ADMIN') {
      return {};
    }

    // Fetch full user details from DB to get department
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { department: true }
    });

    if (!dbUser) {
      throw new AnalyticsServiceError('User profile not found.', 'NOT_FOUND');
    }

    // EDITOR has department-wide access
    if (user.role === 'EDITOR') {
      return { departmentId: dbUser.departmentId, departmentName: dbUser.department?.name };
    }

    // Regular USER (VIEWER) can only fetch own activity
    return { userId: user.id, departmentId: dbUser.departmentId };
  }

  /**
   * Computes the average processing duration for finalized approval requests.
   */
  async calculateAverageApprovalTime(range, userId) {
    const completedReqs = await this.analyticsRepository.getCompletedApprovalTimes(range, userId);
    let totalProcessingTime = 0;
    completedReqs.forEach(r => {
      const created = new Date(r.createdAt).getTime();
      const updated = new Date(r.updatedAt).getTime();
      totalProcessingTime += Math.max(0, updated - created);
    });
    return completedReqs.length > 0 ? Math.round(totalProcessingTime / completedReqs.length) : 0;
  }

  /**
   * GET /analytics/overview
   */
  async getDashboardOverview(query, user) {
    const range = this.resolveDateRange(query.range, query.startDate, query.endDate);
    const scope = await this.getScopedContext(user);

    // Fetch metric details in parallel
    const [docs, checkouts, approvals, signatures, audits, avgTimeMs] = await Promise.all([
      this.analyticsRepository.getDocumentCounts(range, scope.departmentId),
      this.analyticsRepository.getCheckoutCounts(range, scope.userId, scope.departmentName),
      this.analyticsRepository.getApprovalCounts(range, scope.userId),
      this.analyticsRepository.getSignatureCounts(range, scope.userId),
      this.analyticsRepository.getAuditCounts(range),
      this.calculateAverageApprovalTime(range, scope.userId),
    ]);

    // Calculate growth rates or dummy percentages for visualization
    const completedCheckoutRatio = checkouts.active > 0 
      ? Number(((checkouts.completed / (checkouts.active + checkouts.completed)) * 100).toFixed(2)) 
      : 100;

    return {
      overview: {
        range,
        lastUpdated: new Date().toISOString(),
      },
      metrics: {
        documents: docs,
        checkouts: {
          ...checkouts,
          complianceRate: completedCheckoutRatio,
        },
        approvals: {
          ...approvals,
          averageProcessingTimeMs: avgTimeMs,
        },
        signatures,
        auditLogs: audits,
      },
      charts: {
        documentDistribution: analyticsUtil.formatPieChart([
          { category: 'Active', count: docs.active },
          { category: 'Archived', count: docs.archived },
          { category: 'Deleted', count: docs.deleted },
        ]),
      },
      trends: {
        storageGrowthPercent: 0,
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * GET /analytics/documents
   */
  async getDocumentAnalytics(query, user) {
    const range = this.resolveDateRange(query.range, query.startDate, query.endDate);
    const scope = await this.getScopedContext(user);

    const [byClassification, byDepartment, counts] = await Promise.all([
      this.analyticsRepository.getDocumentsByClassification(range, scope.departmentId),
      this.analyticsRepository.getDocumentsByDepartment(range),
      this.analyticsRepository.getDocumentCounts(range, scope.departmentId),
    ]);

    const classificationsFormatted = byClassification.map(c => ({
      category: c.classification || 'UNCLASSIFIED',
      count: c._count._all,
    }));

    // Fetch department names for labels
    const depts = await prisma.department.findMany({ select: { id: true, name: true } });
    const deptMap = {};
    depts.forEach(d => { deptMap[d.id] = d.name; });

    const departmentFormatted = byDepartment.map(d => ({
      label: deptMap[d.departmentId] || 'Unknown',
      count: d._count._all,
    }));

    return {
      overview: { range },
      metrics: counts,
      charts: {
        byClassification: analyticsUtil.formatPieChart(classificationsFormatted),
        byDepartment: analyticsUtil.formatBarChart(departmentFormatted),
        uploadTrends: analyticsUtil.formatLineChart([
          { date: new Date().toISOString().split('T')[0], value: counts.total }
        ]),
      },
      trends: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * GET /analytics/checkouts
   */
  async getCheckoutAnalytics(query, user) {
    const range = this.resolveDateRange(query.range, query.startDate, query.endDate);
    const scope = await this.getScopedContext(user);

    const counts = await this.analyticsRepository.getCheckoutCounts(range, scope.userId, scope.departmentName);

    return {
      overview: { range },
      metrics: counts,
      charts: {
        checkoutDistribution: analyticsUtil.formatPieChart([
          { category: 'Active', count: counts.active },
          { category: 'Overdue', count: counts.overdue },
          { category: 'Completed', count: counts.completed },
        ]),
      },
      trends: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * GET /analytics/approvals
   */
  async getApprovalAnalytics(query, user) {
    const range = this.resolveDateRange(query.range, query.startDate, query.endDate);
    const scope = await this.getScopedContext(user);

    const [counts, avgTimeMs] = await Promise.all([
      this.analyticsRepository.getApprovalCounts(range, scope.userId),
      this.calculateAverageApprovalTime(range, scope.userId),
    ]);

    return {
      overview: { range },
      metrics: {
        ...counts,
        averageProcessingTimeMs: avgTimeMs,
      },
      charts: {
        approvalStatus: analyticsUtil.formatPieChart([
          { category: 'Pending', count: counts.pending },
          { category: 'Approved', count: counts.approved },
          { category: 'Rejected', count: counts.rejected },
        ]),
      },
      trends: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * GET /analytics/signatures
   */
  async getSignatureAnalytics(query, user) {
    const range = this.resolveDateRange(query.range, query.startDate, query.endDate);
    const scope = await this.getScopedContext(user);

    const counts = await this.analyticsRepository.getSignatureCounts(range, scope.userId);

    return {
      overview: { range },
      metrics: counts,
      charts: {
        signatureVerification: analyticsUtil.formatPieChart([
          { category: 'Verified', count: counts.verified },
          { category: 'Failed', count: counts.failed },
        ]),
      },
      trends: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * GET /analytics/audit
   */
  async getAuditAnalytics(query, user) {
    const range = this.resolveDateRange(query.range, query.startDate, query.endDate);
    // Audit analytics requires ADMIN role due to compliance policies
    if (user.role !== 'ADMIN') {
      throw new AnalyticsServiceError('Access denied: Audit log dashboard requires ADMIN privileges.', 'FORBIDDEN');
    }

    const [counts, byCategory] = await Promise.all([
      this.analyticsRepository.getAuditCounts(range),
      this.analyticsRepository.getAuditEventsByCategory(range),
    ]);

    const categoriesFormatted = byCategory.map(c => ({
      category: c.category,
      count: c._count._all,
    }));

    return {
      overview: { range },
      metrics: counts,
      charts: {
        eventsByCategory: analyticsUtil.formatPieChart(categoriesFormatted),
      },
      trends: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * GET /analytics/users
   */
  async getUserAnalytics(query, user) {
    const range = this.resolveDateRange(query.range, query.startDate, query.endDate);
    if (user.role !== 'ADMIN') {
      throw new AnalyticsServiceError('Access denied: User analytics require ADMIN privileges.', 'FORBIDDEN');
    }

    const [activeCount, rankings] = await Promise.all([
      this.analyticsRepository.getActiveUserCounts(range),
      this.analyticsRepository.getUserActivityRanking(range, 10),
    ]);

    const rankingFormatted = rankings.map(r => ({
      label: r.userSnapshot || r.userId,
      count: r._count._all,
    }));

    return {
      overview: { range },
      metrics: {
        activeUsersCount: activeCount,
      },
      charts: {
        activityRanking: analyticsUtil.formatBarChart(rankingFormatted),
      },
      trends: {},
      lastUpdated: new Date().toISOString(),
    };
  }
}
