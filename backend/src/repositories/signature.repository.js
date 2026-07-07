import { prisma } from '../config/database.js';

export class SignatureRepositoryError extends Error {
  constructor(message, code = 'REPOSITORY_ERROR', originalError = null) {
    super(message);
    this.name = 'SignatureRepositoryError';
    this.code = code;
    this.originalError = originalError;
  }
}

function handlePrismaError(err, operationName) {
  console.error(`[SignatureRepository] Error in ${operationName}:`, err);
  
  if (err instanceof SignatureRepositoryError) {
    throw err;
  }

  if (err.code === 'P2002') {
    const fields = err.meta?.target ? err.meta.target.join(', ') : 'fields';
    throw new SignatureRepositoryError(
      `Unique constraint violation: A record with this value already exists on ${fields}.`,
      'DUPLICATE_RECORD',
      err
    );
  }
  
  if (err.code === 'P2025') {
    throw new SignatureRepositoryError(
      `Target signature record for operation was not found.`,
      'RECORD_NOT_FOUND',
      err
    );
  }

  throw new SignatureRepositoryError(
    `Database error occurred during ${operationName}: ${err.message}`,
    'DATABASE_ERROR',
    err
  );
}

export class SignatureRepository {
  _defaultIncludes = {
    user: {
      select: {
        id: true,
        email: true,
        role: true,
      }
    },
    verifier: {
      select: {
        id: true,
        email: true,
        role: true,
      }
    },
    history: {
      orderBy: {
        createdAt: 'asc'
      }
    }
  };

  /**
   * Create a new digital signature record.
   */
  async createSignature(data, tx = null) {
    const client = tx || prisma;
    try {
      return await client.digitalSignature.create({
        data: {
          id: data.id || undefined,
          signatureRefNumber: data.signatureRefNumber,
          signatureType: data.signatureType,
          status: data.status || 'CREATED',
          userId: data.userId,
          userSnapshot: data.userSnapshot || null,
          departmentSnapshot: data.departmentSnapshot || null,
          referenceType: data.referenceType,
          referenceId: data.referenceId,
          storageProvider: data.storageProvider || 'SUPABASE',
          bucketName: data.bucketName,
          storagePath: data.storagePath,
          fileHash: data.fileHash || null,
          signatureHash: data.signatureHash,
          originalFilename: data.originalFilename || null,
          mimeType: data.mimeType || null,
          fileSize: data.fileSize || null,
          checksum: data.checksum || null,
          encodingMetadata: data.encodingMetadata || null,
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'createSignature');
    }
  }

  /**
   * Update properties on a digital signature (status, verification, etc).
   */
  async updateSignature(id, updateData, tx = null) {
    const client = tx || prisma;
    try {
      return await client.digitalSignature.update({
        where: { id },
        data: {
          status: updateData.status,
          verificationStatus: updateData.verificationStatus,
          verificationHash: updateData.verificationHash,
          verifiedBy: updateData.verifiedBy,
          verifiedAt: updateData.verifiedAt ? new Date(updateData.verifiedAt) : undefined,
          verificationMethod: updateData.verificationMethod,
          verificationAttempts: updateData.verificationAttempts,
          lastVerificationAttemptAt: updateData.lastVerificationAttemptAt ? new Date(updateData.lastVerificationAttemptAt) : undefined,
          transactionId: updateData.transactionId,
          transactionType: updateData.transactionType,
          transactionSnapshot: updateData.transactionSnapshot,
          bindingHash: updateData.bindingHash,
          boundAt: updateData.boundAt ? new Date(updateData.boundAt) : undefined,
          boundBy: updateData.boundBy,
          bindingStatus: updateData.bindingStatus,
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'updateSignature');
    }
  }

  /**
   * Retrieve detailed signature record profile.
   */
  async findById(id, options = {}) {
    try {
      const record = await prisma.digitalSignature.findUnique({
        where: { id },
        include: options.include || this._defaultIncludes,
      });

      if (!record) return null;
      if (record.isDeleted && !options.includeDeleted) return null;

      return record;
    } catch (err) {
      handlePrismaError(err, 'findById');
    }
  }

  /**
   * Find signatures attached to a generic reference.
   */
  async findByReference(referenceType, referenceId, options = {}) {
    try {
      const where = {
        referenceType,
        referenceId,
        isDeleted: false,
      };

      if (options.includeDeleted) {
        delete where.isDeleted;
      }

      return await prisma.digitalSignature.findMany({
        where,
        include: options.include || this._defaultIncludes,
        orderBy: { createdAt: 'asc' },
      });
    } catch (err) {
      handlePrismaError(err, 'findByReference');
    }
  }

  /**
   * Soft-delete a signature.
   */
  async softDelete(id, deletedBy, tx = null) {
    const client = tx || prisma;
    try {
      return await client.digitalSignature.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy,
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'softDelete');
    }
  }

  /**
   * Retrieve list of signatures with pagination and filters.
   */
  async findAll(filters = {}, options = {}) {
    try {
      const where = { isDeleted: false };

      if (options.includeDeleted) {
        delete where.isDeleted;
      }

      if (filters.userId) where.userId = filters.userId;
      if (filters.status) where.status = filters.status;
      if (filters.referenceType) where.referenceType = filters.referenceType;
      if (filters.referenceId) where.referenceId = filters.referenceId;
      if (filters.verificationStatus) where.verificationStatus = filters.verificationStatus;

      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
        if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
      }

      const orderBy = {};
      const sortField = options.sort || 'createdAt';
      const sortOrder = options.order || 'desc';
      orderBy[sortField] = sortOrder;

      const page = parseInt(options.page || 1, 10);
      const limit = parseInt(options.limit || 20, 10);
      const skip = (page - 1) * limit;

      const [signatures, totalRecords] = await Promise.all([
        prisma.digitalSignature.findMany({
          where,
          include: options.include || this._defaultIncludes,
          orderBy,
          skip,
          take: limit,
        }),
        prisma.digitalSignature.count({ where }),
      ]);

      return {
        signatures,
        pagination: {
          totalRecords,
          page,
          limit,
          totalPages: Math.ceil(totalRecords / limit),
        }
      };
    } catch (err) {
      handlePrismaError(err, 'findAll');
    }
  }

  /**
   * Create a new immutable signature history event log.
   */
  async createHistoryEntry(historyData, tx = null) {
    const client = tx || prisma;
    try {
      return await client.signatureHistory.create({
        data: {
          signatureId: historyData.signatureId,
          action: historyData.action,
          performedBy: historyData.performedBy,
          metadata: historyData.metadata || null,
        }
      });
    } catch (err) {
      handlePrismaError(err, 'createHistoryEntry');
    }
  }

  /**
   * Retrieve timeline log.
   */
  async getTimeline(signatureId) {
    try {
      return await prisma.signatureHistory.findMany({
        where: { signatureId },
        orderBy: { createdAt: 'asc' },
      });
    } catch (err) {
      handlePrismaError(err, 'getTimeline');
    }
  }

  /**
   * Dashboard stats.
   */
  async getStats(options = {}) {
    try {
      const where = { isDeleted: false };
      if (options.userId) where.userId = options.userId;

      const [
        totalCount,
        createdCount,
        pendingCount,
        verifiedCount,
        failedCount,
        revokedCount,
        groupedByModule,
        groupedByUser
      ] = await Promise.all([
        prisma.digitalSignature.count({ where }),
        prisma.digitalSignature.count({ where: { ...where, status: 'CREATED' } }),
        prisma.digitalSignature.count({ where: { ...where, status: 'PENDING_VERIFICATION' } }),
        prisma.digitalSignature.count({ where: { ...where, status: 'VERIFIED' } }),
        prisma.digitalSignature.count({ where: { ...where, status: 'FAILED' } }),
        prisma.digitalSignature.count({ where: { ...where, status: 'REVOKED' } }),
        prisma.digitalSignature.groupBy({
          by: ['referenceType'],
          where,
          _count: { id: true }
        }),
        prisma.digitalSignature.groupBy({
          by: ['userId'],
          where,
          _count: { id: true }
        })
      ]);

      const signaturesByModule = {};
      groupedByModule.forEach(item => {
        signaturesByModule[item.referenceType] = item._count.id;
      });

      const signaturesByUser = {};
      groupedByUser.forEach(item => {
        signaturesByUser[item.userId] = item._count.id;
      });

      return {
        totalSignatures: totalCount,
        createdCount,
        pendingVerificationCount: pendingCount,
        verifiedCount,
        failedVerificationCount: failedCount,
        revokedCount,
        signaturesByModule,
        signaturesByUser,
      };
    } catch (err) {
      handlePrismaError(err, 'getStats');
    }
  }

  /**
   * Increments verification attempt counts.
   */
  async incrementVerificationAttempt(id, tx = null) {
    const client = tx || prisma;
    try {
      return await client.digitalSignature.update({
        where: { id },
        data: {
          verificationAttempts: { increment: 1 },
          lastVerificationAttemptAt: new Date(),
        },
        include: this._defaultIncludes,
      });
    } catch (err) {
      handlePrismaError(err, 'incrementVerificationAttempt');
    }
  }

  /**
   * Queries signatures by transaction type and transaction ID.
   */
  async findByTransaction(transactionType, transactionId, options = {}) {
    try {
      const where = {
        transactionType,
        transactionId,
        isDeleted: false,
      };

      if (options.includeDeleted) {
        delete where.isDeleted;
      }

      return await prisma.digitalSignature.findMany({
        where,
        include: options.include || this._defaultIncludes,
        orderBy: { createdAt: 'asc' },
      });
    } catch (err) {
      handlePrismaError(err, 'findByTransaction');
    }
  }
}
export default SignatureRepository;
