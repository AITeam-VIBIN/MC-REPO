import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { SignatureRepository } from '../repositories/signature.repository.js';
import { StorageService } from './storage/storage.service.js';
import {
  signatureCreated,
  signatureVerified,
  signatureRejected,
  signatureRevoked,
  signatureStored,
  signatureAccessed,
  signatureFileGenerated,
  signatureBound,
  bindingVerified,
  bindingFailed,
  generateSignatureReferenceNumber,
  generateSignatureHash,
  generateVerificationHash,
  generateBindingHash,
  generateSignatureStoragePath,
  compareHashesSecurely,
  isValidSignatureTransition
} from '../utils/signature.util.js';

export class SignatureServiceError extends Error {
  constructor(message, code, status = 400) {
    super(message);
    this.name = 'SignatureServiceError';
    this.code = code;
    this.status = status;
  }
}

export class SignatureService {
  constructor() {
    this.signatureRepo = new SignatureRepository();
  }

  /**
   * Create a generic signature attached to a transaction.
   * Handles base64 drawn signatures, file uploads, and digital certificates.
   */
  async createSignature(data, currentUser, filePayload = null) {
    // 1. Authorization & Owner validation
    if (data.userId !== currentUser.id) {
      throw new SignatureServiceError(
        'You can only create a digital signature for your own user account.',
        'UNAUTHORIZED_OWNER',
        403
      );
    }

    // 2. Validate parameters
    const allowedTypes = ['DRAWN', 'UPLOADED', 'CERTIFICATE'];
    if (!allowedTypes.includes(data.signatureType)) {
      throw new SignatureServiceError(
        `Invalid signature type: ${data.signatureType}. Allowed: DRAWN, UPLOADED, CERTIFICATE`,
        'INVALID_SIGNATURE_TYPE',
        400
      );
    }

    const allowedRefs = ['CHECKOUT', 'RETURN', 'APPROVAL', 'DOCUMENT'];
    if (!allowedRefs.includes(data.referenceType)) {
      throw new SignatureServiceError(
        `Invalid reference type: ${data.referenceType}. Allowed: CHECKOUT, RETURN, APPROVAL, DOCUMENT`,
        'INVALID_REFERENCE_TYPE',
        400
      );
    }

    if (!data.referenceId) {
      throw new SignatureServiceError(
        'Reference ID is required to bind a digital signature.',
        'INVALID_REFERENCE_ID',
        400
      );
    }

    // 3. Prevent duplicate active signatures for the same resource
    const existing = await this.signatureRepo.findByReference(data.referenceType, data.referenceId);
    const active = existing.find(sig => sig.status === 'VERIFIED' || sig.status === 'PENDING_VERIFICATION');
    if (active) {
      throw new SignatureServiceError(
        `An active signature reference (${active.signatureRefNumber}) already exists for this transaction.`,
        'DUPLICATE_SIGNATURE',
        400
      );
    }

    // 4. File uploads or Base64 decoding
    const bucketName = 'mc-signatures';
    let storagePath = '';
    let originalFilename = '';
    let mimeType = '';
    let fileSize = 0n;
    let checksum = '';
    let encodingMetadata = '';
    let buffer = null;

    const signatureId = crypto.randomUUID();

    if (data.signatureType === 'DRAWN') {
      if (!data.signaturePayload) {
        throw new SignatureServiceError('Base64 canvas payload is required for drawn signatures.', 'MISSING_PAYLOAD');
      }

      // Parse base64
      const matches = data.signaturePayload.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (!matches) {
        throw new SignatureServiceError('Invalid base64 signature encoding format.', 'INVALID_BASE64');
      }

      mimeType = matches[1];
      encodingMetadata = matches[1];
      const base64Data = matches[2];
      buffer = Buffer.from(base64Data, 'base64');
      
      fileSize = BigInt(buffer.length);
      originalFilename = `drawn_${data.referenceType.toLowerCase()}_${Date.now()}.png`;
      storagePath = generateSignatureStoragePath(currentUser.id, data.referenceType, data.referenceId, signatureId, originalFilename);
      checksum = cryptoHash(buffer);

    } else if (data.signatureType === 'UPLOADED') {
      if (!filePayload) {
        throw new SignatureServiceError('File payload is required for uploaded signatures.', 'MISSING_FILE');
      }

      buffer = filePayload.buffer;
      originalFilename = filePayload.originalname;
      mimeType = filePayload.mimetype;
      fileSize = BigInt(filePayload.size);
      checksum = cryptoHash(buffer);
      storagePath = generateSignatureStoragePath(currentUser.id, data.referenceType, data.referenceId, signatureId, originalFilename);

    } else {
      // CERTIFICATE
      if (filePayload) {
        buffer = filePayload.buffer;
        originalFilename = filePayload.originalname;
        mimeType = filePayload.mimetype;
        fileSize = BigInt(filePayload.size);
        checksum = cryptoHash(buffer);
      } else {
        // Fallback placeholder/stub certificate support
        buffer = Buffer.from(JSON.stringify({ note: 'Placeholder certificate metadata', timestamp: Date.now() }));
        originalFilename = `cert_${Date.now()}.json`;
        mimeType = 'application/json';
        fileSize = BigInt(buffer.length);
        checksum = cryptoHash(buffer);
      }
      storagePath = generateSignatureStoragePath(currentUser.id, data.referenceType, data.referenceId, signatureId, originalFilename);
    }

    // 5. Upload to storage first (prevent orphaned DB record if upload fails)
    try {
      await StorageService.uploadObject(bucketName, storagePath, buffer, { contentType: mimeType });
      await signatureStored({ id: signatureId });
    } catch (err) {
      throw new SignatureServiceError(`Failed uploading signature to storage: ${err.message}`, 'STORAGE_FAILURE', 500);
    }

    // 6. Generate signature hash
    const signatureHash = generateSignatureHash(currentUser.id, data.referenceType, data.referenceId, checksum, new Date());

    // 7. Create DB record. Clean up storage if database insert fails.
    try {
      return await prisma.$transaction(async (tx) => {
        const signature = await this.signatureRepo.createSignature({
          id: signatureId,
          signatureRefNumber: generateSignatureReferenceNumber(),
          signatureType: data.signatureType,
          status: data.signatureType === 'CERTIFICATE' ? 'VERIFIED' : 'PENDING_VERIFICATION',
          userId: currentUser.id,
          userSnapshot: currentUser.email,
          departmentSnapshot: currentUser.department?.name || 'Unassigned',
          referenceType: data.referenceType,
          referenceId: data.referenceId,
          bucketName,
          storagePath,
          signatureHash,
          originalFilename,
          mimeType,
          fileSize,
          checksum,
          encodingMetadata,
        }, tx);

        // Log Created History
        await this.signatureRepo.createHistoryEntry({
          signatureId: signature.id,
          action: 'CREATED',
          performedBy: currentUser.id,
        }, tx);

        if (data.signatureType === 'CERTIFICATE') {
          await this.signatureRepo.createHistoryEntry({
            signatureId: signature.id,
            action: 'VERIFIED',
            performedBy: 'SYSTEM',
          }, tx);
        }

        await signatureCreated(signature);
        return signature;
      });
    } catch (err) {
      // Rollback: Clean up uploaded physical file from Supabase Storage
      try {
        await StorageService.deleteObject(bucketName, storagePath);
      } catch (cleanupErr) {
        console.error('[SignatureService] Storage rollback cleanup failed:', cleanupErr);
      }
      throw err;
    }
  }

  /**
   * Retrieve signature raw binary file asset.
   */
  async getSignatureAsset(id, currentUser) {
    const signature = await this.signatureRepo.findById(id);
    if (!signature) {
      throw new SignatureServiceError(`Signature record with ID ${id} not found.`, 'SIGNATURE_NOT_FOUND', 404);
    }

    if (signature.userId !== currentUser.id && currentUser.role !== 'ADMIN') {
      throw new SignatureServiceError('Access denied: You are not authorized to retrieve this signature asset.', 'UNAUTHORIZED', 403);
    }

    try {
      const data = await StorageService.downloadObject(signature.bucketName, signature.storagePath);
      await signatureAccessed(signature);
      await signatureFileGenerated(signature);
      return data;
    } catch (err) {
      throw new SignatureServiceError(`Failed to download signature file from storage: ${err.message}`, 'STORAGE_FAILURE', 500);
    }
  }

  /**
   * Generate temporary signed read access URL.
   */
  async generateSignatureAccessUrl(id, currentUser, expiresInSeconds = 900) {
    const signature = await this.signatureRepo.findById(id);
    if (!signature) {
      throw new SignatureServiceError(`Signature record with ID ${id} not found.`, 'SIGNATURE_NOT_FOUND', 404);
    }

    if (signature.userId !== currentUser.id && currentUser.role !== 'ADMIN') {
      throw new SignatureServiceError('Access denied: You are not authorized to view this signature asset.', 'UNAUTHORIZED', 403);
    }

    try {
      const { signedUrl } = await StorageService.generateDownloadUrl(signature.bucketName, signature.storagePath, expiresInSeconds);
      await signatureAccessed(signature);
      return signedUrl;
    } catch (err) {
      throw new SignatureServiceError(`Failed to generate signed access URL: ${err.message}`, 'STORAGE_FAILURE', 500);
    }
  }

  /**
   * Validate signature owner authorization check.
   */
  async validateSignatureOwner(signature) {
    const { referenceType, referenceId, userId } = signature;
    if (referenceType === 'CHECKOUT' || referenceType === 'RETURN') {
      const checkout = await prisma.checkout.findUnique({ where: { id: referenceId } });
      if (!checkout) return false;
      return checkout.requestedById === userId || checkout.employeeId === userId;
    }
    if (referenceType === 'APPROVAL') {
      const approval = await prisma.approvalRequest.findUnique({ where: { id: referenceId } });
      if (!approval) return false;
      return approval.requesterId === userId;
    }
    if (referenceType === 'DOCUMENT') {
      const document = await prisma.document.findUnique({ where: { id: referenceId } });
      if (!document) return false;
      return document.ownerId === userId;
    }
    return false;
  }

  /**
   * Validate target transaction status check.
   */
  async validateTransactionBinding(signature) {
    const { referenceType, referenceId } = signature;
    if (referenceType === 'CHECKOUT' || referenceType === 'RETURN') {
      const checkout = await prisma.checkout.findUnique({ where: { id: referenceId } });
      if (!checkout) return false;
      return !checkout.isDeleted;
    }
    if (referenceType === 'APPROVAL') {
      const approval = await prisma.approvalRequest.findUnique({ where: { id: referenceId } });
      if (!approval) return false;
      return approval.status !== 'CANCELLED';
    }
    if (referenceType === 'DOCUMENT') {
      const document = await prisma.document.findUnique({ where: { id: referenceId } });
      if (!document) return false;
      return !document.isDeleted;
    }
    return false;
  }

  /**
   * Validate raw file checksum match.
   */
  async validateSignatureIntegrity(signature) {
    try {
      const blob = await StorageService.downloadObject(signature.bucketName, signature.storagePath);
      let buffer;
      if (blob && typeof blob.arrayBuffer === 'function') {
        const ab = await blob.arrayBuffer();
        buffer = Buffer.from(ab);
      } else {
        buffer = Buffer.isBuffer(blob) ? blob : Buffer.from(blob || '');
      }
      const checksum = cryptoHash(buffer);
      return checksum === signature.checksum;
    } catch (err) {
      console.error('[SignatureService] Integrity check failed:', err);
      return false;
    }
  }

  /**
   * Compare metadata hashes securely.
   */
  verifySignatureHash(signature) {
    const computed = generateSignatureHash(
      signature.userId,
      signature.referenceType,
      signature.referenceId,
      signature.checksum,
      signature.createdAt
    );
    return compareHashesSecurely(computed, signature.signatureHash);
  }

  /**
   * Verify signature authenticity, ownership, and transaction bindings.
   */
  async verifySignature(id, verifierUser, notes = '') {
    const signature = await this.signatureRepo.findById(id);
    if (!signature) {
      throw new SignatureServiceError(`Signature record with ID ${id} not found.`, 'SIGNATURE_NOT_FOUND', 404);
    }

    if (signature.userId === verifierUser.id && verifierUser.role !== 'ADMIN') {
      throw new SignatureServiceError('Users cannot verify or audit their own digital signatures.', 'UNAUTHORIZED_VERIFIER', 403);
    }

    if (signature.status === 'REVOKED') {
      throw new SignatureServiceError('Revoked signature cannot be verified.', 'REVOKED_SIGNATURE_VERIFICATION', 400);
    }

    if (!isValidSignatureTransition(signature.status, 'VERIFIED')) {
      throw new SignatureServiceError(`Cannot verify a signature in ${signature.status} state.`, 'INVALID_TRANSITION', 400);
    }

    // Limit verification retry thresholds
    if (signature.verificationAttempts >= 5) {
      throw new SignatureServiceError('Excessive verification retries. Signature is locked.', 'VERIFICATION_LOCKED', 400);
    }

    await this.signatureRepo.incrementVerificationAttempt(id);

    await this.signatureRepo.createHistoryEntry({
      signatureId: id,
      action: 'SIGNATURE_VERIFICATION_STARTED',
      performedBy: verifierUser.id,
    });

    let success = true;
    let reason = '';

    const [ownerValid, txValid] = await Promise.all([
      this.validateSignatureOwner(signature),
      this.validateTransactionBinding(signature)
    ]);

    if (!ownerValid) {
      success = false;
      reason = 'Ownership validation failed: user not authorized for transaction.';
    } else if (!txValid) {
      success = false;
      reason = 'Transaction validation failed: target transaction is inactive or not found.';
    }

    if (success) {
      const integrityValid = await this.validateSignatureIntegrity(signature);
      if (!integrityValid) {
        success = false;
        reason = 'Integrity validation failed: physical signature file is corrupted or tampered.';
      }
    }

    if (success) {
      const hashValid = this.verifySignatureHash(signature);
      if (!hashValid) {
        success = false;
        reason = 'Tamper detected: metadata signature hash does not match.';
      }
    }

    const timestamp = new Date();
    const method = signature.signatureType === 'CERTIFICATE' ? 'CERTIFICATE_VERIFICATION' : 'HASH_VERIFICATION';

    if (!success) {
      return await prisma.$transaction(async (tx) => {
        const updated = await this.signatureRepo.updateSignature(id, {
          status: 'FAILED',
          verificationStatus: 'FAILED',
        }, tx);

        await this.signatureRepo.createHistoryEntry({
          signatureId: id,
          action: 'SIGNATURE_VERIFICATION_FAILED',
          performedBy: verifierUser.id,
          metadata: { reason, verifierId: verifierUser.id },
        }, tx);

        await signatureRejected(updated);
        await bindingFailed(updated);

        return {
          signatureId: id,
          verificationStatus: 'FAILED',
          verificationMethod: method,
          verifiedBy: verifierUser.id,
          verifiedDate: timestamp,
          integrityResult: 'FAILED',
          ownershipResult: ownerValid ? 'PASSED' : 'FAILED',
          transactionResult: txValid ? 'PASSED' : 'FAILED',
          failureReason: reason
        };
      });
    }

    const verificationHash = generateVerificationHash(
      id,
      signature.userId,
      signature.referenceType,
      signature.referenceId,
      signature.checksum,
      signature.createdAt
    );

    return await prisma.$transaction(async (tx) => {
      const updated = await this.signatureRepo.updateSignature(id, {
        status: 'VERIFIED',
        verificationStatus: 'VERIFIED',
        verificationHash,
        verifiedBy: verifierUser.id,
        verifiedAt: timestamp,
        verificationMethod: method,
      }, tx);

      await this.signatureRepo.createHistoryEntry({
        signatureId: id,
        action: 'SIGNATURE_VERIFIED',
        performedBy: verifierUser.id,
        metadata: { notes, verifierId: verifierUser.id },
      }, tx);

      await signatureVerified(updated);
      await bindingVerified(updated);

      return {
        signatureId: id,
        verificationStatus: 'VERIFIED',
        verificationMethod: method,
        verifiedBy: verifierUser.id,
        verifiedDate: timestamp,
        integrityResult: 'PASSED',
        ownershipResult: 'PASSED',
        transactionResult: 'PASSED',
      };
    });
  }

  /**
   * Reject signature.
   */
  async rejectSignature(id, verifierUser, reason) {
    if (!reason) {
      throw new SignatureServiceError('Rejection reason must be provided to fail verification.', 'MISSING_REJECTION_REASON');
    }

    const signature = await this.signatureRepo.findById(id);
    if (!signature) {
      throw new SignatureServiceError(`Signature record with ID ${id} not found.`, 'SIGNATURE_NOT_FOUND', 404);
    }

    if (signature.userId === verifierUser.id && verifierUser.role !== 'ADMIN') {
      throw new SignatureServiceError('Users cannot verify or reject their own digital signatures.', 'UNAUTHORIZED_VERIFIER', 403);
    }

    if (!isValidSignatureTransition(signature.status, 'FAILED')) {
      throw new SignatureServiceError(`Cannot reject verification for a signature in ${signature.status} state.`, 'INVALID_TRANSITION', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await this.signatureRepo.updateSignature(id, {
        status: 'FAILED',
        verificationStatus: 'FAILED',
      }, tx);

      await this.signatureRepo.createHistoryEntry({
        signatureId: id,
        action: 'FAILED',
        performedBy: verifierUser.id,
        metadata: { reason },
      }, tx);

      await signatureRejected(updated);
      return updated;
    });
  }

  /**
   * Revoke verified signature.
   */
  async revokeSignature(id, user, reason) {
    if (!reason) {
      throw new SignatureServiceError('Reason is required to revoke a signature.', 'MISSING_REVOCATION_REASON');
    }

    const signature = await this.signatureRepo.findById(id);
    if (!signature) {
      throw new SignatureServiceError(`Signature record with ID ${id} not found.`, 'SIGNATURE_NOT_FOUND', 404);
    }

    if (signature.userId !== user.id && user.role !== 'ADMIN') {
      throw new SignatureServiceError('Only the signature owner or system administrator can revoke a signature.', 'UNAUTHORIZED', 403);
    }

    if (!isValidSignatureTransition(signature.status, 'REVOKED')) {
      throw new SignatureServiceError(`Cannot revoke a signature in ${signature.status} state.`, 'INVALID_TRANSITION', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await this.signatureRepo.updateSignature(id, {
        status: 'REVOKED',
        verificationStatus: 'REVOKED',
      }, tx);

      await this.signatureRepo.createHistoryEntry({
        signatureId: id,
        action: 'REVOKED',
        performedBy: user.id,
        metadata: { reason },
      }, tx);

      await signatureRevoked(updated);
      return updated;
    });
  }

  /**
   * Soft delete signature request.
   */
  async deleteSignature(id, user) {
    const signature = await this.signatureRepo.findById(id);
    if (!signature) {
      throw new SignatureServiceError(`Signature record with ID ${id} not found.`, 'SIGNATURE_NOT_FOUND', 404);
    }

    if (signature.userId !== user.id && user.role !== 'ADMIN') {
      throw new SignatureServiceError('Only the signature owner or system administrator can remove a signature record.', 'UNAUTHORIZED', 403);
    }

    return await this.signatureRepo.softDelete(id, user.id);
  }

  /**
   * Get signature details.
   */
  async getSignatureDetails(id, user) {
    const signature = await this.signatureRepo.findById(id);
    if (!signature) {
      throw new SignatureServiceError(`Signature record with ID ${id} not found.`, 'SIGNATURE_NOT_FOUND', 404);
    }

    if (signature.userId !== user.id && user.role !== 'ADMIN') {
      throw new SignatureServiceError('Access denied: You are not authorized to view this signature record.', 'UNAUTHORIZED', 403);
    }

    return signature;
  }

  /**
   * Get signatures linked to a transaction.
   */
  async getSignaturesByReference(referenceType, referenceId, user) {
    const signatures = await this.signatureRepo.findByReference(referenceType, referenceId);
    if (user.role !== 'ADMIN') {
      return signatures.filter(sig => sig.userId === user.id);
    }
    return signatures;
  }

  /**
   * List all user signatures.
   */
  async listUserSignatures(userId, filters = {}, options = {}) {
    return await this.signatureRepo.findAll({ ...filters, userId }, options);
  }

  /**
   * List all signatures (Admin query).
   */
  async listAllSignatures(filters = {}, options = {}) {
    return await this.signatureRepo.findAll(filters, options);
  }

  /**
   * Fetch timeline of events for a signature.
   */
  async getTimeline(signatureId, user) {
    const signature = await this.signatureRepo.findById(signatureId);
    if (!signature) {
      throw new SignatureServiceError(`Signature record with ID ${signatureId} not found.`, 'SIGNATURE_NOT_FOUND', 404);
    }

    if (signature.userId !== user.id && user.role !== 'ADMIN') {
      throw new SignatureServiceError('Access denied to signature timeline logs.', 'UNAUTHORIZED', 403);
    }

    return await this.signatureRepo.getTimeline(signatureId);
  }

  /**
   * Retrieve aggregated dashboard stats.
   */
  async getStats(user) {
    const options = {};
    if (user.role !== 'ADMIN') {
      options.userId = user.id;
    }
    return await this.signatureRepo.getStats(options);
  }

  /**
   * Bind digital signature to a transaction securely.
   */
  async bindSignatureToTransaction(signatureId, transactionType, transactionId, currentUser, context = {}) {
    const signature = await this.signatureRepo.findById(signatureId);
    if (!signature) {
      throw new SignatureServiceError(`Signature record with ID ${signatureId} not found.`, 'SIGNATURE_NOT_FOUND', 404);
    }

    if (signature.status !== 'VERIFIED') {
      throw new SignatureServiceError('Only verified signatures can be bound to transactions.', 'SIGNATURE_NOT_VERIFIED', 400);
    }

    if (signature.bindingStatus === 'BOUND') {
      throw new SignatureServiceError('Signature is already bound to a transaction.', 'ALREADY_BOUND', 400);
    }

    if (signature.userId !== currentUser.id && currentUser.role !== 'ADMIN') {
      throw new SignatureServiceError('You are not authorized to bind this signature.', 'UNAUTHORIZED', 403);
    }

    if (signature.referenceId !== transactionId || signature.referenceType !== transactionType) {
      throw new SignatureServiceError('Transaction mismatch with signature reference bindings.', 'TRANSACTION_MISMATCH', 400);
    }

    // Capture transaction data for snapshot
    let docInfo = { id: null, version: null, classification: null };
    if (transactionType === 'CHECKOUT' || transactionType === 'RETURN') {
      const checkout = await prisma.checkout.findUnique({
        where: { id: transactionId },
        include: { document: true }
      });
      if (!checkout) throw new SignatureServiceError('Target checkout transaction not found.', 'TRANSACTION_NOT_FOUND', 404);
      docInfo = {
        id: checkout.documentId,
        version: checkout.documentVersionId || null,
        classification: checkout.classificationSnapshot || null
      };
    } else if (transactionType === 'APPROVAL') {
      const approval = await prisma.approvalRequest.findUnique({ where: { id: transactionId } });
      if (!approval) throw new SignatureServiceError('Target approval transaction not found.', 'TRANSACTION_NOT_FOUND', 404);
    } else if (transactionType === 'DOCUMENT') {
      const doc = await prisma.document.findUnique({ where: { id: transactionId } });
      if (!doc) throw new SignatureServiceError('Target document resource not found.', 'TRANSACTION_NOT_FOUND', 404);
      docInfo = {
        id: doc.id,
        version: doc.version || null,
        classification: doc.classification || null
      };
    }

    const boundAt = new Date();

    const transactionSnapshot = {
      user: {
        id: currentUser.id,
        email: currentUser.email,
        role: currentUser.role,
        department: currentUser.department?.name || 'Unassigned'
      },
      action: {
        type: 'BINDING',
        module: transactionType,
        timestamp: boundAt.toISOString()
      },
      document: docInfo,
      context: {
        ipAddress: context.ipAddress || '127.0.0.1',
        userAgent: context.userAgent || 'unknown'
      }
    };

    const bindingHash = generateBindingHash(
      signatureId,
      signature.userId,
      transactionType,
      transactionId,
      transactionSnapshot,
      boundAt
    );

    return await prisma.$transaction(async (tx) => {
      const updated = await this.signatureRepo.updateSignature(signatureId, {
        transactionId,
        transactionType,
        transactionSnapshot,
        bindingHash,
        boundAt,
        boundBy: currentUser.id,
        bindingStatus: 'BOUND',
      }, tx);

      await this.signatureRepo.createHistoryEntry({
        signatureId,
        action: 'SIGNATURE_BOUND',
        performedBy: currentUser.id,
        metadata: { transactionId, transactionType }
      }, tx);

      await signatureBound(updated);

      return updated;
    });
  }

  /**
   * Verify binding integrity hash.
   */
  verifyBindingIntegrity(signature) {
    if (!signature.bindingHash || !signature.transactionSnapshot) {
      return 'NOT_BOUND';
    }
    const computed = generateBindingHash(
      signature.id,
      signature.userId,
      signature.transactionType,
      signature.transactionId,
      signature.transactionSnapshot,
      signature.boundAt
    );
    const match = compareHashesSecurely(computed, signature.bindingHash);
    return match ? 'PASSED' : 'TAMPER_DETECTED';
  }

  /**
   * Query signatures by transaction.
   */
  async getTransactionSignature(transactionType, transactionId, user) {
    const signatures = await this.signatureRepo.findByTransaction(transactionType, transactionId);
    if (user.role !== 'ADMIN') {
      return signatures.filter(sig => sig.userId === user.id);
    }
    return signatures;
  }
}

function cryptoHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
