import { SignatureService, SignatureServiceError } from '../services/signature.service.js';

const signatureService = new SignatureService();

function serializeSignature(signature) {
  if (!signature) return signature;
  const copy = { ...signature };
  if (copy.fileSize !== undefined && copy.fileSize !== null) {
    copy.fileSize = copy.fileSize.toString();
  }
  return copy;
}

function handleControllerError(err, res, next) {
  if (err instanceof SignatureServiceError) {
    return res.status(err.status).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      }
    });
  }
  next(err);
}

export class SignatureController {
  /**
   * Create digital signature.
   * Handles JSON payloads as well as multipart file uploads.
   */
  async create(req, res, next) {
    try {
      const signature = await signatureService.createSignature(req.body, req.user, req.file);
      return res.status(201).json({
        success: true,
        data: serializeSignature(signature)
      });
    } catch (err) {
      handleControllerError(err, res, next);
    }
  }

  /**
   * Fetch details.
   */
  async getById(req, res, next) {
    try {
      const signature = await signatureService.getSignatureDetails(req.params.id, req.user);
      return res.status(200).json({
        success: true,
        data: serializeSignature(signature)
      });
    } catch (err) {
      handleControllerError(err, res, next);
    }
  }

  /**
   * Soft-delete signature record.
   */
  async delete(req, res, next) {
    try {
      const signature = await signatureService.deleteSignature(req.params.id, req.user);
      return res.status(200).json({
        success: true,
        data: serializeSignature(signature)
      });
    } catch (err) {
      handleControllerError(err, res, next);
    }
  }

  /**
   * Get signatures linked to a transaction.
   */
  async getByReference(req, res, next) {
    try {
      const { referenceType, referenceId } = req.params;
      const signatures = await signatureService.getSignaturesByReference(referenceType, referenceId, req.user);
      return res.status(200).json({
        success: true,
        data: signatures.map(serializeSignature)
      });
    } catch (err) {
      handleControllerError(err, res, next);
    }
  }

  /**
   * Verify signature status (Admin/Audit workflow).
   */
  async verify(req, res, next) {
    try {
      const signature = await signatureService.verifySignature(req.params.id, req.user, req.body.notes);
      return res.status(200).json({
        success: true,
        data: serializeSignature(signature)
      });
    } catch (err) {
      handleControllerError(err, res, next);
    }
  }

  /**
   * Reject signature verification.
   */
  async reject(req, res, next) {
    try {
      const signature = await signatureService.rejectSignature(req.params.id, req.user, req.body.reason);
      return res.status(200).json({
        success: true,
        data: serializeSignature(signature)
      });
    } catch (err) {
      handleControllerError(err, res, next);
    }
  }

  /**
   * Revoke verified signature.
   */
  async revoke(req, res, next) {
    try {
      const signature = await signatureService.revokeSignature(req.params.id, req.user, req.body.reason);
      return res.status(200).json({
        success: true,
        data: serializeSignature(signature)
      });
    } catch (err) {
      handleControllerError(err, res, next);
    }
  }

  /**
   * Fetch chronological timeline.
   */
  async getHistory(req, res, next) {
    try {
      const history = await signatureService.getTimeline(req.params.id, req.user);
      return res.status(200).json({
        success: true,
        data: history
      });
    } catch (err) {
      handleControllerError(err, res, next);
    }
  }

  /**
   * Fetch current user's signatures.
   */
  async getMy(req, res, next) {
    try {
      const { signatures, pagination } = await signatureService.listUserSignatures(req.user.id, req.query, req.query);
      return res.status(200).json({
        success: true,
        data: signatures.map(serializeSignature),
        pagination
      });
    } catch (err) {
      handleControllerError(err, res, next);
    }
  }

  /**
   * List all signatures (Admin filter).
   */
  async listAll(req, res, next) {
    try {
      const { signatures, pagination } = await signatureService.listAllSignatures(req.query, req.query);
      return res.status(200).json({
        success: true,
        data: signatures.map(serializeSignature),
        pagination
      });
    } catch (err) {
      handleControllerError(err, res, next);
    }
  }

  /**
   * Download signature file binary asset payload.
   */
  async getAsset(req, res, next) {
    try {
      const fileData = await signatureService.getSignatureAsset(req.params.id, req.user);
      const signature = await signatureService.getSignatureDetails(req.params.id, req.user);
      res.setHeader('Content-Type', signature.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${signature.originalFilename}"`);
      return res.send(fileData);
    } catch (err) {
      handleControllerError(err, res, next);
    }
  }

  /**
   * Generate temporary signed access URL.
   */
  async getAccessUrl(req, res, next) {
    try {
      const url = await signatureService.generateSignatureAccessUrl(req.params.id, req.user);
      return res.status(200).json({
        success: true,
        data: { signedUrl: url }
      });
    } catch (err) {
      handleControllerError(err, res, next);
    }
  }

  /**
   * Bind signature to transaction.
   */
  async bind(req, res, next) {
    try {
      const { transactionType, transactionId } = req.body;
      const context = {
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      };
      const signature = await signatureService.bindSignatureToTransaction(
        req.params.id,
        transactionType,
        transactionId,
        req.user,
        context
      );
      return res.status(200).json({
        success: true,
        data: serializeSignature(signature)
      });
    } catch (err) {
      handleControllerError(err, res, next);
    }
  }
}
export default SignatureController;
