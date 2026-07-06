import DocumentService from '../services/documents.service.js';

const documentService = new DocumentService();

/**
 * Maps service exception errors to corresponding HTTP status code envelopes.
 * 
 * @function mapServiceErrorToHttp
 * @param {Error} err - Service level exception error
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next handler
 */
function mapServiceErrorToHttp(err, res, next) {
  if (err.name === 'DocumentServiceError') {
    const errorMapping = {
      DOCUMENT_NOT_FOUND: 404,
      DUPLICATE_DOCUMENT: 409,
      INVALID_FOLDER: 400,
      INVALID_VAULT: 400,
      INVALID_DEPARTMENT: 400,
      INVALID_OWNER: 400,
      INVALID_STATE_TRANSITION: 400,
      VALIDATION_FAILED: 400,
    };

    const statusCode = errorMapping[err.code] || 400;
    return res.status(statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  next(err);
}

/**
 * Controller class executing REST integrations for Document endpoints.
 */
export class DocumentsController {
  /**
   * Create a new document metadata profile.
   * 
   * @async
   * @method createDocument
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async createDocument(req, res, next) {
    try {
      const ownerId = req.user?.id;
      const result = await documentService.createDocument({
        ...req.body,
        ownerId,
      });

      res.status(201).json({
        success: true,
        message: 'Document metadata created successfully.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Get detail profile metadata for a document.
   * 
   * @async
   * @method getDocumentDetails
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async getDocumentDetails(req, res, next) {
    try {
      const { id } = req.params;
      const result = await documentService.getDocumentDetails(id);

      res.status(200).json({
        success: true,
        message: 'Document details retrieved successfully.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * List non-deleted documents with filtering and search.
   * 
   * @async
   * @method listDocuments
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async listDocuments(req, res, next) {
    try {
      const result = await documentService.listDocuments(req.query);

      res.status(200).json({
        success: true,
        message: 'Documents listed successfully.',
        data: result.documents,
        meta: {
          total: result.total,
          page: Number(req.query?.page || 1),
          limit: Number(req.query?.limit || 10),
        },
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Update metadata modifications.
   * 
   * @async
   * @method updateDocumentMetadata
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async updateDocumentMetadata(req, res, next) {
    try {
      const { id } = req.params;
      const result = await documentService.updateDocumentMetadata(id, req.body);

      res.status(200).json({
        success: true,
        message: 'Document metadata updated successfully.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Archive an active document.
   * 
   * @async
   * @method archiveDocument
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async archiveDocument(req, res, next) {
    try {
      const { id } = req.params;
      const result = await documentService.archiveDocument(id);

      res.status(200).json({
        success: true,
        message: 'Document archived successfully.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Restore a soft-deleted document.
   * 
   * @async
   * @method restoreDocument
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async restoreDocument(req, res, next) {
    try {
      const { id } = req.params;
      const result = await documentService.restoreDocument(id);

      res.status(200).json({
        success: true,
        message: 'Document restored successfully.',
        data: result,
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }

  /**
   * Soft-delete a document record.
   * 
   * @async
   * @method softDeleteDocument
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   */
  async softDeleteDocument(req, res, next) {
    try {
      const { id } = req.params;
      await documentService.softDeleteDocument(id);

      res.status(200).json({
        success: true,
        message: 'Document deleted successfully.',
      });
    } catch (err) {
      mapServiceErrorToHttp(err, res, next);
    }
  }
}

export default DocumentsController;
