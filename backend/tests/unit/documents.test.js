import test from 'node:test';
import assert from 'node:assert';
import { prisma } from '../../src/config/database.js';
import { cleanupDb } from '../helpers/db.js';
import DocumentService from '../../src/services/documents.service.js';
import { setupStorageMock, restoreStorageMock } from '../mocks/storage.mock.js';
import { mockDepartment, mockRegularUser, mockAdminUser, mockFolder, mockVault } from '../fixtures/documents.fixture.js';

const documentService = new DocumentService();

test.describe('Document Service Unit Tests', () => {
  test.before(() => {
    setupStorageMock();
  });

  test.after(() => {
    restoreStorageMock();
  });

  test.beforeEach(async () => {
    await cleanupDb();

    // Seed dependencies
    await prisma.department.create({ data: mockDepartment });
    await prisma.user.create({ data: mockRegularUser });
    await prisma.user.create({ data: mockAdminUser });
    await prisma.vault.create({ data: mockVault });
    await prisma.folder.create({ data: mockFolder });
  });

  test.afterEach(async () => {
    await cleanupDb();
  });

  test('uploadDocument creates document record and uploads to Supabase', async () => {
    const fileMock = {
      originalname: 'report_2026.pdf',
      buffer: Buffer.from('mock report file data content'),
      mimetype: 'application/pdf',
      size: 1024,
    };

    const metadata = {
      name: 'annual_report.pdf',
      classification: 'INTERNAL',
      folderId: mockFolder.id,
      vaultId: mockVault.id,
      departmentId: mockDepartment.id,
    };

    const doc = await documentService.uploadDocument(fileMock, metadata, mockRegularUser.id);
    
    assert.ok(doc.id);
    assert.strictEqual(doc.name, 'annual_report.pdf');
    assert.strictEqual(doc.classification, 'INTERNAL');
    assert.strictEqual(doc.status, 'ACTIVE');

    const dbRecord = await prisma.document.findUnique({ where: { id: doc.id } });
    assert.ok(dbRecord);
    assert.strictEqual(dbRecord.fileSize.toString(), '1024');
  });

  test('uploadDocument rejects identical checksum contents in same folder path', async () => {
    const fileMock = {
      originalname: 'dup.pdf',
      buffer: Buffer.from('content-for-checksum-matching'),
      mimetype: 'application/pdf',
      size: 500,
    };

    const metadata = {
      name: 'dup1.pdf',
      folderId: mockFolder.id,
      vaultId: mockVault.id,
    };

    // First upload
    await documentService.uploadDocument(fileMock, metadata, mockRegularUser.id);

    // Second upload (same content/checksum, same folder)
    await assert.rejects(
      async () => {
        await documentService.uploadDocument(fileMock, { ...metadata, name: 'dup2.pdf' }, mockRegularUser.id);
      },
      (err) => {
        return err.name === 'DocumentServiceError' && err.code === 'DUPLICATE_DOCUMENT';
      }
    );
  });

  test('searchDocuments returns matching items and pagination metadata', async () => {
    // Insert some search target documents
    await prisma.document.create({
      data: {
        id: 'da000000-0000-0000-0000-000000000010',
        name: 'structural_report.pdf',
        folderId: mockFolder.id,
        vaultId: mockVault.id,
        departmentId: mockDepartment.id,
        ownerId: mockRegularUser.id,
        storageBucket: 'documents',
        storagePath: 'path/1',
        mimeType: 'application/pdf',
        fileSize: 500n,
        classification: 'INTERNAL',
        status: 'ACTIVE',
        tags: ['structure', 'engineering'],
      },
    });

    await prisma.document.create({
      data: {
        id: 'da000000-0000-0000-0000-000000000011',
        name: 'invoice_july.pdf',
        folderId: mockFolder.id,
        vaultId: mockVault.id,
        departmentId: mockDepartment.id,
        ownerId: mockRegularUser.id,
        storageBucket: 'documents',
        storagePath: 'path/2',
        mimeType: 'application/pdf',
        fileSize: 1200n,
        classification: 'PUBLIC',
        status: 'ACTIVE',
        tags: ['finance', 'invoice'],
      },
    });

    // Search by name query
    const results = await documentService.searchDocuments({ search: 'structural' }, mockRegularUser);
    assert.strictEqual(results.documents.length, 1);
    assert.strictEqual(results.documents[0].id, 'da000000-0000-0000-0000-000000000010');
    assert.strictEqual(results.pagination.totalRecords, 1);

    // Search by tag query
    const resultsByTag = await documentService.searchDocuments({ tags: 'finance' }, mockRegularUser);
    assert.strictEqual(resultsByTag.documents.length, 1);
    assert.strictEqual(resultsByTag.documents[0].id, 'da000000-0000-0000-0000-000000000011');
  });

  test('getSecurePreview generates signed link if eligible', async () => {
    await prisma.document.create({
      data: {
        id: 'da000000-0000-0000-0000-000000000012',
        name: 'blueprint.png',
        folderId: mockFolder.id,
        vaultId: mockVault.id,
        departmentId: mockDepartment.id,
        ownerId: mockRegularUser.id,
        storageBucket: 'documents',
        storagePath: 'path/preview',
        mimeType: 'image/png',
        fileSize: 400n,
        classification: 'PUBLIC',
        status: 'ACTIVE',
      },
    });

    const result = await documentService.getSecurePreview('da000000-0000-0000-0000-000000000012', mockRegularUser);
    assert.strictEqual(result.previewType, 'IMAGE');
    assert.ok(result.temporaryAccessUrl.includes('mock-signed-token'));
  });

  test('getSecureDownloadUrl retrieves version specific direct path links', async () => {
    const docId = 'da000000-0000-0000-0000-000000000013';
    await prisma.document.create({
      data: {
        id: docId,
        name: 'financials.docx',
        folderId: mockFolder.id,
        vaultId: mockVault.id,
        departmentId: mockDepartment.id,
        ownerId: mockRegularUser.id,
        storageBucket: 'documents',
        storagePath: 'path/latest',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: 600n,
        classification: 'PUBLIC',
        status: 'ACTIVE',
        version: 2,
      },
    });

    // Create an older version record
    await prisma.fileVersion.create({
      data: {
        id: 'fa000000-0000-0000-0000-000000000001',
        documentId: docId,
        version: 1,
        filePath: 'path/version-1',
        changeLog: 'Initial release',
        createdBy: mockRegularUser.id,
      },
    });

    // 1. Fetch latest version URL
    const latestLink = await documentService.getSecureDownloadUrl(docId, undefined, mockRegularUser);
    assert.ok(latestLink.temporaryAccessUrl.includes('path/latest'));

    // 2. Fetch specific version 1 URL
    const version1Link = await documentService.getSecureDownloadUrl(docId, 1, mockRegularUser);
    assert.ok(version1Link.temporaryAccessUrl.includes('path/version-1'));
  });
});
