import { Router } from 'express';
import { DocumentsController } from '../controllers/documents.controller.js';
import { requireAuth, requireSession } from '../middleware/index.js';
import { uploadMultiple } from '../middleware/upload.middleware.js';
import {
  createDocumentSchema,
  updateDocumentSchema,
  listDocumentsSchema,
  idParamSchema,
} from '../validations/documents.validation.js';

const router = Router();
const documentsController = new DocumentsController();

// Validation Middleware
const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (error) {
    next(error);
  }
};

// All endpoints require authentication and active session
router.use(requireAuth);
router.use(requireSession);

/**
 * @openapi
 * /documents:
 *   post:
 *     summary: Create document metadata
 *     description: Registers metadata for a new document.
 *     security:
 *       - BearerAuth: []
 */
router.post('/', validate(createDocumentSchema), documentsController.createDocument);

/**
 * @openapi
 * /documents:
 *   get:
 *     summary: List documents
 *     description: Retrieves list of documents matching pagination, sorting, and filter criteria.
 *     security:
 *       - BearerAuth: []
 */
router.get('/', validate(listDocumentsSchema), documentsController.listDocuments);

/**
 * @openapi
 * /documents/search:
 *   get:
 *     summary: Search documents
 *     description: Executes advanced searching against document properties and meta contexts.
 *     security:
 *       - BearerAuth: []
 */
router.get('/search', documentsController.searchDocuments);

/**
 * @openapi
 * /documents/expiring:
 *   get:
 *     summary: List expiring documents
 *     description: Retrieves list of documents that are expiring soon.
 *     security:
 *       - BearerAuth: []
 */
router.get('/expiring', documentsController.getExpiringDocuments);

/**
 * @openapi
 * /documents/expired:
 *   get:
 *     summary: List expired documents
 *     description: Retrieves list of documents that are currently expired.
 *     security:
 *       - BearerAuth: []
 */
router.get('/expired', documentsController.getExpiredDocuments);

/**
 * @openapi
 * /documents/{id}:
 *   get:
 *     summary: Get document details
 *     description: Fetch detailed metadata profiles of a document.
 *     security:
 *       - BearerAuth: []
 */
router.get('/:id', validate(idParamSchema), documentsController.getDocumentDetails);

/**
 * @openapi
 * /documents/{id}:
 *   patch:
 *     summary: Update document metadata
 *     description: Modifies metadata profiles of a writable document.
 *     security:
 *       - BearerAuth: []
 */
router.patch('/:id', validate(updateDocumentSchema), documentsController.updateDocumentMetadata);

/**
 * @openapi
 * /documents/{id}/archive:
 *   patch:
 *     summary: Archive document
 *     description: Moves the status of an active document to ARCHIVED.
 *     security:
 *       - BearerAuth: []
 */
router.patch('/:id/archive', validate(idParamSchema), documentsController.archiveDocument);

/**
 * @openapi
 * /documents/{id}/restore:
 *   patch:
 *     summary: Restore document
 *     description: Recovers a soft-deleted document back to its last active profile state.
 *     security:
 *       - BearerAuth: []
 */
router.patch('/:id/restore', validate(idParamSchema), documentsController.restoreDocument);

/**
 * @openapi
 * /documents/{id}/extend-expiry:
 *   patch:
 *     summary: Extend document expiry date
 *     description: Extends the compliance expiry date target for active/expired documents.
 *     security:
 *       - BearerAuth: []
 */
router.patch('/:id/extend-expiry', validate(idParamSchema), documentsController.extendDocumentExpiry);

/**
 * @openapi
 * /documents/{id}:
 *   delete:
 *     summary: Soft-delete document
 *     description: Marks a document metadata record as deleted.
 *     security:
 *       - BearerAuth: []
 */
router.delete('/:id', validate(idParamSchema), documentsController.softDeleteDocument);

/**
 * @openapi
 * /documents/upload:
 *   post:
 *     summary: Upload document files and metadata
 *     description: Uploads files to storage and registers metadata profiles inside postgres.
 *     security:
 *       - BearerAuth: []
 */
router.post('/upload', uploadMultiple, documentsController.uploadDocument);

/**
 * @openapi
 * /documents/{id}/preview:
 *   get:
 *     summary: Get document preview link
 *     description: Resolves temporary expiring link parameters to preview files inline.
 *     security:
 *       - BearerAuth: []
 */
router.get('/:id/preview', validate(idParamSchema), documentsController.getDocumentPreview);

/**
 * @openapi
 * /documents/{id}/download:
 *   get:
 *     summary: Download document file
 *     description: Resolves secure download link for latest or historical document versions.
 *     security:
 *       - BearerAuth: []
 */
router.get('/:id/download', validate(idParamSchema), documentsController.downloadDocument);

/**
 * @openapi
 * /documents/{id}/access-url:
 *   get:
 *     summary: Resolve general access URL
 *     description: Generates expiring access URL for third-party operations.
 *     security:
 *       - BearerAuth: []
 */
router.get('/:id/access-url', validate(idParamSchema), documentsController.getDocumentAccessUrl);

export default router;
