import { z } from 'zod';

const signatureTypeEnum = z.enum(['DRAWN', 'UPLOADED', 'CERTIFICATE']);
const referenceTypeEnum = z.enum(['CHECKOUT', 'RETURN', 'APPROVAL', 'DOCUMENT']);
const signatureStatusEnum = z.enum(['CREATED', 'PENDING_VERIFICATION', 'VERIFIED', 'FAILED', 'REVOKED']);

export const idParamSchema = z.object({
  id: z.string().uuid({ message: 'Signature ID must be a valid UUID.' })
});

export const referenceParamsSchema = z.object({
  referenceType: referenceTypeEnum,
  referenceId: z.string().min(1, { message: 'Reference ID is required.' })
});

export const createSignatureSchema = z.object({
  body: z.object({
    userId: z.string().uuid({ message: 'User ID must be a valid UUID.' }),
    signatureType: signatureTypeEnum,
    referenceType: referenceTypeEnum,
    referenceId: z.string().min(1, { message: 'Reference ID is required.' }),
    signaturePayload: z.string().optional(),
    fileReference: z.object({
      bucketName: z.string().optional(),
      storagePath: z.string().min(1),
      originalFilename: z.string().min(1),
      mimeType: z.string().min(1),
      fileSize: z.number().int().positive().optional(),
      checksum: z.string().optional(),
    }).optional()
  }).refine((data) => {
    if (data.signatureType === 'DRAWN' && !data.signaturePayload) {
      return false;
    }
    return true;
  }, {
    message: 'signaturePayload is required for DRAWN signature type.',
    path: ['signaturePayload']
  }).refine((data) => {
    if (data.signatureType === 'UPLOADED' && !data.fileReference) {
      return false;
    }
    return true;
  }, {
    message: 'fileReference details are required for UPLOADED signature type.',
    path: ['fileReference']
  })
});

export const verifySignatureSchema = z.object({
  body: z.object({
    notes: z.string().max(500, { message: 'Verification notes must not exceed 500 characters.' }).optional()
  })
});

export const rejectSignatureSchema = z.object({
  body: z.object({
    reason: z.string().min(1, { message: 'Rejection reason must be provided.' }).max(500)
  })
});

export const revokeSignatureSchema = z.object({
  body: z.object({
    reason: z.string().min(1, { message: 'Revocation reason must be provided.' }).max(500)
  })
});

export const listSignaturesSchema = z.object({
  query: z.object({
    userId: z.string().uuid().optional(),
    status: signatureStatusEnum.optional(),
    referenceType: referenceTypeEnum.optional(),
    referenceId: z.string().optional(),
    verificationStatus: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
    sort: z.enum(['createdAt', 'updatedAt', 'signatureRefNumber', 'status']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc')
  })
});

export const bindSignatureSchema = z.object({
  body: z.object({
    transactionType: referenceTypeEnum,
    transactionId: z.string().min(1, { message: 'Transaction ID is required.' })
  })
});
