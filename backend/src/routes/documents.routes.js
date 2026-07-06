import { Router } from 'express';
import { DocumentsController } from '../controllers/documents.controller.js';
import { requireAuth, requireSession } from '../middleware/index.js';
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
 * /documents/{id}:
 *   delete:
 *     summary: Soft-delete document
 *     description: Marks a document metadata record as deleted.
 *     security:
 *       - BearerAuth: []
 */
router.delete('/:id', validate(idParamSchema), documentsController.softDeleteDocument);

export default router;
