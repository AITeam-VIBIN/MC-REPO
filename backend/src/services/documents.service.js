import { prisma } from '../config/database.js';
import DocumentRepository from '../repositories/documents.repository.js';
import { generateSlug } from '../utils/vault.util.js';

const documentRepository = new DocumentRepository();

/**
 * Standardized service-level exception class for Document Domain business rules.
 */
export class DocumentServiceError extends Error {
  /**
   * @param {string} message - Human-readable exception details
   * @param {string} [code='VALIDATION_FAILED'] - Service error code
   */
  constructor(message, code = 'VALIDATION_FAILED') {
    super(message);
    this.name = 'DocumentServiceError';
    this.code = code;
  }
}

/**
 * DTO representing sanitized document response schemas.
 */
export class DocumentResponseDto {
  constructor(docRecord) {
    this.id = docRecord.id;
    this.name = docRecord.name;
    this.documentNumber = docRecord.documentNumber;
    this.description = docRecord.description || null;
    this.tags = docRecord.tags || [];
    this.folderId = docRecord.folderId;
    this.vaultId = docRecord.vaultId;
    this.departmentId = docRecord.departmentId;
    this.ownerId = docRecord.ownerId;
    this.storageProvider = docRecord.storageProvider;
    this.storageBucket = docRecord.storageBucket;
    this.storagePath = docRecord.storagePath;
    this.mimeType = docRecord.mimeType;
    this.fileSize = docRecord.fileSize.toString(); // Map BigInt to standard string representation
    this.checksum = docRecord.checksum || null;
    this.classification = docRecord.classification;
    this.status = docRecord.status;
    this.version = docRecord.version;
    this.isLocked = docRecord.isLocked;
    this.lockedById = docRecord.lockedById || null;
    this.lockedAt = docRecord.lockedAt || null;
    this.createdAt = docRecord.createdAt;
    this.updatedAt = docRecord.updatedAt;

    if (docRecord.owner) {
      this.owner = {
        id: docRecord.owner.id,
        email: docRecord.owner.email,
      };
    }
    if (docRecord.department) {
      this.department = {
        id: docRecord.department.id,
        name: docRecord.department.name,
      };
    }
    if (docRecord.folder) {
      this.folder = {
        id: docRecord.folder.id,
        name: docRecord.folder.name,
      };
    }
    if (docRecord.vault) {
      this.vault = {
        id: docRecord.vault.id,
        name: docRecord.vault.name,
      };
    }
    if (docRecord.versions && docRecord.versions.length > 0) {
      this.currentVersionDetails = {
        id: docRecord.versions[0].id,
        version: docRecord.versions[0].version,
        filePath: docRecord.versions[0].filePath,
        changeLog: docRecord.versions[0].changeLog,
        createdAt: docRecord.versions[0].createdAt,
      };
    }
  }

  /**
   * Translate a single DB record to DocumentResponseDto.
   * @static
   */
  static fromRecord(docRecord) {
    return new DocumentResponseDto(docRecord);
  }
}

/**
 * Service orchestrating Document domain business rules.
 */
export class DocumentService {
  // =========================================================================
  // Business Rules & Validations
  // =========================================================================

  /**
   * Validate document name structure rules (restricts illegal characters).
   * @private
   */
  _validateDocumentName(name) {
    if (!name || typeof name !== 'string') {
      throw new DocumentServiceError('Document name must be a non-empty string.', 'VALIDATION_FAILED');
    }
    
    // Character exclusions for naming safety
    const illegalCharsRegex = /[\\/:*?"<>|]/;
    if (illegalCharsRegex.test(name)) {
      throw new DocumentServiceError(
        'Document name contains invalid characters (illegal: \\ / : * ? " < > |).',
        'VALIDATION_FAILED'
      );
    }
  }

  /**
   * Validate classifications enum.
   * @private
   */
  _validateClassification(classification) {
    const allowed = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'];
    if (!allowed.includes(classification)) {
      throw new DocumentServiceError(
        `Invalid classification: ${classification}. Allowed values: ${allowed.join(', ')}`,
        'VALIDATION_FAILED'
      );
    }
  }

  /**
   * Enforces BCD-FSS lifecycle status state machine rules.
   * @private
   */
  _validateStatusTransition(current, target) {
    if (current === target) return;

    if (current === 'INFECTED') {
      throw new DocumentServiceError(
        'Infected documents are quarantined and cannot transition to other states.',
        'INVALID_STATE_TRANSITION'
      );
    }

    const transitions = {
      PENDING_UPLOAD: ['DRAFT', 'ACTIVE', 'INFECTED'],
      DRAFT: ['ACTIVE', 'ARCHIVED', 'INFECTED'],
      ACTIVE: ['ARCHIVED', 'INFECTED', 'DRAFT'],
      ARCHIVED: ['ACTIVE', 'DRAFT'],
    };

    const allowed = transitions[current] || [];
    if (!allowed.includes(target)) {
      throw new DocumentServiceError(
        `Lifecycle status transition not permitted: from ${current} to ${target}.`,
        'INVALID_STATE_TRANSITION'
      );
    }
  }

  /**
   * Validates existences of relational constraints.
   * @private
   */
  async _validateRelationalConstraints(data) {
    // 1. Vault check
    if (data.vaultId) {
      const vault = await prisma.vault.findUnique({ where: { id: data.vaultId } });
      if (!vault) throw new DocumentServiceError('Target Vault record does not exist.', 'INVALID_VAULT');
      if (vault.isDeleted || vault.status === 'DISABLED') {
        throw new DocumentServiceError('Target Vault is currently archived or disabled.', 'INVALID_VAULT');
      }
    }

    // 2. Folder check
    if (data.folderId) {
      const folder = await prisma.folder.findUnique({ where: { id: data.folderId } });
      if (!folder) throw new DocumentServiceError('Target Folder record does not exist.', 'INVALID_FOLDER');
      if (folder.isDeleted || folder.status === 'DISABLED') {
        throw new DocumentServiceError('Target Folder is currently deleted or disabled.', 'INVALID_FOLDER');
      }
    }

    // 3. User / Owner check
    if (data.ownerId) {
      const owner = await prisma.user.findUnique({ where: { id: data.ownerId } });
      if (!owner) throw new DocumentServiceError('Target User / Owner does not exist.', 'INVALID_OWNER');
    }

    // 4. Department check
    if (data.departmentId) {
      const department = await prisma.department.findUnique({ where: { id: data.departmentId } });
      if (!department) throw new DocumentServiceError('Target Department does not exist.', 'INVALID_DEPARTMENT');
    }
  }

  /**
   * Checks uniqueness within folder boundaries.
   * @private
   */
  async _validateUniquenessInFolder(name, folderId, vaultId, excludeId = null) {
    const duplicate = await prisma.document.findFirst({
      where: {
        name,
        folderId: folderId || null,
        vaultId: vaultId || null,
        isDeleted: false,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });

    if (duplicate) {
      throw new DocumentServiceError(
        `A document named "${name}" already exists in this folder path.`,
        'DUPLICATE_DOCUMENT'
      );
    }
  }

  /**
   * Asserts document is not deleted or archived.
   * @private
   */
  _assertWritableState(doc) {
    if (doc.isDeleted) {
      throw new DocumentServiceError('Operations are restricted on soft-deleted documents.', 'VALIDATION_FAILED');
    }
    if (doc.status === 'ARCHIVED') {
      throw new DocumentServiceError('Operations are restricted on archived documents.', 'VALIDATION_FAILED');
    }
  }

  // =========================================================================
  // Document Operations Business Logic
  // =========================================================================

  /**
   * Create a new document metadata record.
   */
  async createDocument(data) {
    // 1. Core validations
    this._validateDocumentName(data.name);
    if (data.classification) this._validateClassification(data.classification);

    // 2. Validate existences of constraints
    await this._validateRelationalConstraints(data);

    // 3. Validate folder uniqueness
    await this._validateUniquenessInFolder(data.name, data.folderId, data.vaultId);

    // 4. Verify duplicate serial number
    const serialNumber = data.documentNumber || `DOC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const duplicateSerial = await prisma.document.findFirst({
      where: { documentNumber: serialNumber, isDeleted: false },
    });
    if (duplicateSerial) {
      throw new DocumentServiceError(`Document number "${serialNumber}" is already assigned to a record.`, 'DUPLICATE_DOCUMENT');
    }

    // 5. Tag normalization
    const normalizedTags = data.tags 
      ? data.tags.map(t => t.toString().trim().toLowerCase()).filter(Boolean)
      : [];

    const doc = await documentRepository.create({
      ...data,
      documentNumber: serialNumber,
      tags: normalizedTags,
      status: 'PENDING_UPLOAD',
    });

    return DocumentResponseDto.fromRecord(doc);
  }

  /**
   * Fetch a Document details.
   */
  async getDocumentDetails(id) {
    const doc = await documentRepository.findById(id);
    if (!doc) throw new DocumentServiceError('Document not found.', 'DOCUMENT_NOT_FOUND');
    return DocumentResponseDto.fromRecord(doc);
  }

  /**
   * List documents with filters.
   */
  async listDocuments(params) {
    const { documents, total } = await documentRepository.list(params);
    return {
      documents: documents.map(DocumentResponseDto.fromRecord),
      total,
    };
  }

  /**
   * Update metadata settings.
   */
  async updateDocumentMetadata(id, data) {
    const doc = await documentRepository.findById(id);
    if (!doc) throw new DocumentServiceError('Document not found.', 'DOCUMENT_NOT_FOUND');

    // Prevent modifying archived or deleted files
    this._assertWritableState(doc);

    // If updating name or directories, validate uniqueness
    if (data.name || data.folderId || data.vaultId) {
      const targetName = data.name || doc.name;
      const targetFolder = data.folderId !== undefined ? data.folderId : doc.folderId;
      const targetVault = data.vaultId !== undefined ? data.vaultId : doc.vaultId;
      
      if (data.name) this._validateDocumentName(targetName);
      await this._validateUniquenessInFolder(targetName, targetFolder, targetVault, id);
    }

    // Validate relational checks
    await this._validateRelationalConstraints(data);

    // Tag normalization
    let normalizedTags = undefined;
    if (data.tags) {
      normalizedTags = data.tags.map(t => t.toString().trim().toLowerCase()).filter(Boolean);
    }

    // Check status transition
    if (data.status) {
      this._validateStatusTransition(doc.status, data.status);
    }

    const updated = await documentRepository.update(id, {
      ...data,
      ...(normalizedTags && { tags: normalizedTags }),
    });

    return DocumentResponseDto.fromRecord(updated);
  }

  /**
   * Archive a document.
   */
  async archiveDocument(id) {
    const doc = await documentRepository.findById(id);
    if (!doc) throw new DocumentServiceError('Document not found.', 'DOCUMENT_NOT_FOUND');

    if (doc.isDeleted) {
      throw new DocumentServiceError('Quarantined or soft-deleted records cannot be archived.', 'VALIDATION_FAILED');
    }

    this._validateStatusTransition(doc.status, 'ARCHIVED');

    const updated = await documentRepository.archive(id);
    return DocumentResponseDto.fromRecord(updated);
  }

  /**
   * Restore a soft-deleted document.
   */
  async restoreDocument(id) {
    const doc = await prisma.document.findUnique({
      where: { id },
    });
    if (!doc) throw new DocumentServiceError('Document not found.', 'DOCUMENT_NOT_FOUND');

    if (!doc.isDeleted) return DocumentResponseDto.fromRecord(doc);

    const updated = await documentRepository.restore(id);
    return DocumentResponseDto.fromRecord(updated);
  }

  /**
   * Soft-delete a document record.
   */
  async softDeleteDocument(id) {
    const doc = await documentRepository.findById(id);
    if (!doc) throw new DocumentServiceError('Document not found.', 'DOCUMENT_NOT_FOUND');

    if (doc.isDeleted) return DocumentResponseDto.fromRecord(doc);

    const updated = await documentRepository.softDelete(id);
    return DocumentResponseDto.fromRecord(updated);
  }
}

export default DocumentService;
