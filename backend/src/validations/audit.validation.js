import { z } from 'zod';

/**
 * Zod validation schema for auditing queries and pagination.
 */
export const listAuditLogsSchema = z.object({
  query: z.object({
    page: z.union([z.string(), z.number()])
      .transform(val => {
        const parsed = parseInt(val, 10);
        return isNaN(parsed) || parsed < 1 ? 1 : parsed;
      })
      .default(1),
    limit: z.union([z.string(), z.number()])
      .transform(val => {
        const parsed = parseInt(val, 10);
        return isNaN(parsed) || parsed < 1 ? 10 : parsed;
      })
      .default(10),
    sortBy: z.string().trim().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    userId: z.string().uuid('User ID query must be a valid UUID.').optional(),
    category: z.enum([
      'AUTHENTICATION',
      'DOCUMENT',
      'CHECKOUT',
      'APPROVAL',
      'SIGNATURE',
      'USER_MANAGEMENT',
      'SYSTEM',
      'SECURITY'
    ]).optional(),
    action: z.enum([
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
    ]).optional(),
    result: z.enum(['SUCCESS', 'FAILED', 'DENIED']).optional(),
    referenceType: z.string().trim().optional(),
    referenceId: z.string().trim().optional(),
    ipAddress: z.string().trim().optional(),
    startDate: z.string().datetime({ message: 'Start date must be a valid ISO datetime format.' }).optional(),
    endDate: z.string().datetime({ message: 'End date must be a valid ISO datetime format.' }).optional(),
    dateFilter: z.enum(['today', 'this-week', 'this-month', 'custom']).optional(),
    search: z.string().trim().optional(),
    department: z.string().trim().optional(),
    role: z.string().trim().optional(),
  }).partial()
});

/**
 * Zod validation schema for audit record parameter lookup.
 */
export const idParamSchema = z.object({
  id: z.string().uuid('Audit log ID parameter must be a valid UUID format.')
});

/**
 * Zod validation schema for user activity parameters lookup.
 */
export const userIdParamSchema = z.object({
  userId: z.string().uuid('User ID parameter must be a valid UUID format.')
});

/**
 * Zod validation schema for polymorphic resource parameters.
 */
export const resourceParamsSchema = z.object({
  referenceType: z.string().trim().min(1, 'Reference type is required.'),
  referenceId: z.string().trim().min(1, 'Reference ID is required.')
});

/**
 * Zod validation schema for generating compliance report requests.
 */
export const generateReportSchema = z.object({
  body: z.object({
    reportType: z.enum(['COMPLETE', 'DOCUMENT', 'USER_ACTIVITY', 'SECURITY', 'COMPLIANCE']),
    format: z.enum(['PDF', 'EXCEL', 'CSV']).default('PDF'),
    filters: z.object({
      userId: z.string().uuid('Filter User ID must be a valid UUID.').optional(),
      category: z.enum([
        'AUTHENTICATION',
        'DOCUMENT',
        'CHECKOUT',
        'APPROVAL',
        'SIGNATURE',
        'USER_MANAGEMENT',
        'SYSTEM',
        'SECURITY'
      ]).optional(),
      action: z.enum([
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
      ]).optional(),
      result: z.enum(['SUCCESS', 'FAILED', 'DENIED']).optional(),
      referenceType: z.string().trim().optional(),
      referenceId: z.string().trim().optional(),
      ipAddress: z.string().trim().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      department: z.string().trim().optional(),
      role: z.string().trim().optional(),
    }).partial().optional(),
  })
});
export default {
  listAuditLogsSchema,
  idParamSchema,
  userIdParamSchema,
  resourceParamsSchema,
  generateReportSchema
};
