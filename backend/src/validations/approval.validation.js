import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid('Approval ID parameter must be a valid UUID format.'),
});

export const createApprovalSchema = z.object({
  body: z.object({
    referenceType: z.enum(['CHECKOUT', 'DOCUMENT', 'USER_ACCESS', 'EXTERNAL_SHARE']),
    referenceId: z.string().trim().min(1, 'Reference ID is required.'),
    title: z.string().trim().min(1, 'Title is required.').max(255),
    description: z.string().trim().max(1000).optional().nullable(),
    reason: z.string().trim().max(1000).optional().nullable(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
    approvalLevel: z.string().trim().max(50).optional().nullable(),
    steps: z.array(z.object({
      approverId: z.string().uuid('Approver ID must be a valid UUID.'),
      approverRole: z.string().trim().max(50).optional().nullable(),
      approverName: z.string().trim().max(255).optional().nullable(),
    })).min(1, 'At least one approval step is required.'),
  })
});

export const updateApprovalSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(1000).optional().nullable(),
    reason: z.string().trim().max(1000).optional().nullable(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  })
});

export const decisionSchema = z.object({
  body: z.object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    comments: z.string().trim().max(1000).optional().nullable(),
    rejectionReason: z.string().trim().max(1000).optional().nullable(),
  }).refine(data => {
    if (data.decision === 'REJECTED' && (!data.rejectionReason || data.rejectionReason.trim() === '')) {
      return false;
    }
    return true;
  }, {
    message: 'Rejection reason is required when the decision is REJECTED.',
    path: ['rejectionReason'],
  })
});

export const cancelSchema = z.object({
  body: z.object({
    remarks: z.string().trim().max(1000).optional().nullable(),
  })
});

export const listApprovalsSchema = z.object({
  query: z.object({
    page: z.union([z.string(), z.number()]).transform(val => parseInt(val, 10)).default(1),
    limit: z.union([z.string(), z.number()]).transform(val => parseInt(val, 10)).default(10),
    sort: z.string().trim().default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
    status: z.enum(['DRAFT', 'PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED']).optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    referenceType: z.enum(['CHECKOUT', 'DOCUMENT', 'USER_ACCESS', 'EXTERNAL_SHARE']).optional(),
    requesterId: z.string().uuid().optional(),
    currentApproverId: z.string().uuid().optional(),
    search: z.string().trim().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    department: z.string().trim().optional(),
  }).partial(),
});
