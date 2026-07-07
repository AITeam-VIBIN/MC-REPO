import { Router } from 'express';
import { SignatureController } from '../controllers/signature.controller.js';
import { requireAuth, requireSession, requirePermission } from '../middleware/index.js';
import { uploadSignature } from '../middleware/upload.middleware.js';
import {
  createSignatureSchema,
  verifySignatureSchema,
  rejectSignatureSchema,
  revokeSignatureSchema,
  listSignaturesSchema,
  bindSignatureSchema,
  idParamSchema,
  referenceParamsSchema
} from '../validations/signature.validation.js';

const router = Router();
const controller = new SignatureController();

// Validation Middleware Helper
const validate = (schema) => (req, res, next) => {
  try {
    if (schema === idParamSchema) {
      schema.parse(req.params);
    } else if (schema === referenceParamsSchema) {
      schema.parse(req.params);
    } else {
      const bodyToParse = { ...req.body };
      if (req.file) {
        bodyToParse.fileReference = {
          bucketName: 'mc-signatures',
          storagePath: req.file.path || 'temp',
          originalFilename: req.file.originalname,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
        };
      }
      schema.parse({
        body: bodyToParse,
        query: req.query,
        params: req.params,
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};

// All signature routes require authentication and active session
router.use(requireAuth);
router.use(requireSession);

/**
 * @openapi
 * /signatures/my:
 *   get:
 *     summary: Retrieve digital signatures created by current user
 */
router.get('/my', requirePermission('SIGNATURE_VIEW'), validate(listSignaturesSchema), controller.getMy);

/**
 * @openapi
 * /signatures/reference/:referenceType/:referenceId:
 *   get:
 *     summary: Retrieve digital signatures matching target reference bounds
 */
router.get('/reference/:referenceType/:referenceId', requirePermission('SIGNATURE_VIEW'), validate(referenceParamsSchema), controller.getByReference);

/**
 * @openapi
 * /signatures:
 *   post:
 *     summary: Create new digital signature (handles JSON and form-data file uploads)
 */
router.post('/', requirePermission('SIGNATURE_CREATE'), uploadSignature, validate(createSignatureSchema), controller.create);

/**
 * @openapi
 * /signatures:
 *   get:
 *     summary: List all digital signatures (Admin query)
 */
router.get('/', requirePermission('SIGNATURE_VIEW'), validate(listSignaturesSchema), controller.listAll);

/**
 * @openapi
 * /signatures/:id:
 *   get:
 *     summary: Retrieve digital signature details profile
 */
router.get('/:id', requirePermission('SIGNATURE_VIEW'), validate(idParamSchema), controller.getById);

/**
 * @openapi
 * /signatures/:id:
 *   delete:
 *     summary: Soft delete a digital signature
 */
router.delete('/:id', requirePermission('SIGNATURE_REVOKE'), validate(idParamSchema), controller.delete);

/**
 * @openapi
 * /signatures/:id/verify:
 *   post:
 *     summary: Verify / Approve digital signature
 */
router.post('/:id/verify', requirePermission('SIGNATURE_VERIFY'), validate(idParamSchema), validate(verifySignatureSchema), controller.verify);

/**
 * @openapi
 * /signatures/:id/reject:
 *   post:
 *     summary: Reject digital signature verification
 */
router.post('/:id/reject', requirePermission('SIGNATURE_VERIFY'), validate(idParamSchema), validate(rejectSignatureSchema), controller.reject);

/**
 * @openapi
 * /signatures/:id/revoke:
 *   post:
 *     summary: Revoke verified digital signature
 */
router.post('/:id/revoke', requirePermission('SIGNATURE_REVOKE'), validate(idParamSchema), validate(revokeSignatureSchema), controller.revoke);

/**
 * @openapi
 * /signatures/:id/history:
 *   get:
 *     summary: Retrieve digital signature timeline history log
 */
router.get('/:id/history', requirePermission('SIGNATURE_VIEW'), validate(idParamSchema), controller.getHistory);

/**
 * @openapi
 * /signatures/:id/asset:
 *   get:
 *     summary: Download signature file binary asset payload
 */
router.get('/:id/asset', requirePermission('SIGNATURE_VIEW'), validate(idParamSchema), controller.getAsset);

/**
 * @openapi
 * /signatures/:id/access-url:
 *   get:
 *     summary: Generate temporary signed read access URL
 */
router.get('/:id/access-url', requirePermission('SIGNATURE_VIEW'), validate(idParamSchema), controller.getAccessUrl);

/**
 * @openapi
 * /signatures/:id/bind:
 *   post:
 *     summary: Bind digital signature to a transaction securely
 */
router.post('/:id/bind', requirePermission('SIGNATURE_CREATE'), validate(idParamSchema), validate(bindSignatureSchema), controller.bind);

export default router;
