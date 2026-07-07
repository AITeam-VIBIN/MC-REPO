import test from 'node:test';
import assert from 'node:assert';
import { prisma } from '../../src/config/database.js';
import { cleanupDb } from '../helpers/db.js';
import { lifecycleService } from '../../src/services/lifecycle.service.js';
import { mockDepartment, mockRegularUser, mockAdminUser, mockFolder, mockVault } from '../fixtures/documents.fixture.js';

test.describe('Lifecycle Service Unit Tests', () => {
  test.beforeEach(async () => {
    await cleanupDb();

    // Setup basic DB relations
    await prisma.department.create({ data: mockDepartment });
    await prisma.user.create({ data: mockRegularUser });
    await prisma.user.create({ data: mockAdminUser });
    await prisma.vault.create({ data: mockVault });
    await prisma.folder.create({ data: mockFolder });
  });

  test.after(async () => {
    await cleanupDb();
  });

  test('calculateExpiryDate based on classification rules', () => {
    const createdDate = new Date('2026-07-06T12:00:00Z');
    
    // PUBLIC should expire in 1 year
    const publicExpiry = lifecycleService.calculateExpiryDate(createdDate, 'PUBLIC');
    assert.strictEqual(publicExpiry.getFullYear(), 2027);

    // INTERNAL should expire in 3 years
    const internalExpiry = lifecycleService.calculateExpiryDate(createdDate, 'INTERNAL');
    assert.strictEqual(internalExpiry.getFullYear(), 2029);

    // CONFIDENTIAL should expire in 7 years
    const confidentialExpiry = lifecycleService.calculateExpiryDate(createdDate, 'CONFIDENTIAL');
    assert.strictEqual(confidentialExpiry.getFullYear(), 2033);
  });

  test('calculateDaysRemaining computes correct differences', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 15);
    
    const daysLeft = lifecycleService.calculateDaysRemaining(futureDate);
    assert.strictEqual(daysLeft, 15);
  });

  test('runDailyExpiryScan transitions states appropriately', async () => {
    // 1. Create document expiring in 5 days (should mark as EXPIRING_SOON)
    const expiringSoonDate = new Date();
    expiringSoonDate.setDate(expiringSoonDate.getDate() + 5);

    await prisma.document.create({
      data: {
        id: 'da000000-0000-0000-0000-000000000010',
        name: 'expiring_soon.pdf',
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
        expiryDate: expiringSoonDate,
      },
    });

    // 2. Create document already expired (should mark as EXPIRED)
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 2);

    await prisma.document.create({
      data: {
        id: 'da000000-0000-0000-0000-000000000011',
        name: 'already_expired.pdf',
        folderId: mockFolder.id,
        vaultId: mockVault.id,
        departmentId: mockDepartment.id,
        ownerId: mockRegularUser.id,
        storageBucket: 'documents',
        storagePath: 'path/2',
        mimeType: 'application/pdf',
        fileSize: 800n,
        classification: 'PUBLIC',
        status: 'ACTIVE',
        expiryDate: expiredDate,
      },
    });

    const summary = await lifecycleService.runDailyExpiryScan();
    assert.strictEqual(summary.expiringMarked, 1);
    assert.strictEqual(summary.expiredMarked, 1);

    const doc1 = await prisma.document.findUnique({ where: { id: 'da000000-0000-0000-0000-000000000010' } });
    assert.strictEqual(doc1.status, 'EXPIRING_SOON');

    const doc2 = await prisma.document.findUnique({ where: { id: 'da000000-0000-0000-0000-000000000011' } });
    assert.strictEqual(doc2.status, 'EXPIRED');
  });

  test('runRetentionProcessor auto-archives expired documents', async () => {
    // Create an EXPIRED document
    await prisma.document.create({
      data: {
        id: 'da000000-0000-0000-0000-000000000012',
        name: 'expired_to_archive.pdf',
        folderId: mockFolder.id,
        vaultId: mockVault.id,
        departmentId: mockDepartment.id,
        ownerId: mockRegularUser.id,
        storageBucket: 'documents',
        storagePath: 'path/3',
        mimeType: 'application/pdf',
        fileSize: 800n,
        classification: 'PUBLIC',
        status: 'EXPIRED',
        expiryDate: new Date(),
      },
    });

    const summary = await lifecycleService.runRetentionProcessor();
    assert.strictEqual(summary.archivedCount, 1);

    const doc = await prisma.document.findUnique({ where: { id: 'da000000-0000-0000-0000-000000000012' } });
    assert.strictEqual(doc.status, 'ARCHIVED');
  });

  test('extendExpiryDate updates expiry date and resets status to ACTIVE', async () => {
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 5);

    await prisma.document.create({
      data: {
        id: 'da000000-0000-0000-0000-000000000013',
        name: 'expired_to_extend.pdf',
        folderId: mockFolder.id,
        vaultId: mockVault.id,
        departmentId: mockDepartment.id,
        ownerId: mockRegularUser.id,
        storageBucket: 'documents',
        storagePath: 'path/4',
        mimeType: 'application/pdf',
        fileSize: 800n,
        classification: 'PUBLIC',
        status: 'EXPIRED',
        expiryDate: expiredDate,
      },
    });

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 90);

    const result = await lifecycleService.extendExpiryDate('da000000-0000-0000-0000-000000000013', futureDate, mockRegularUser);
    assert.strictEqual(result.currentStatus, 'ACTIVE');
    assert.strictEqual(result.daysRemaining > 0, true);

    const doc = await prisma.document.findUnique({ where: { id: 'da000000-0000-0000-0000-000000000013' } });
    assert.strictEqual(doc.status, 'ACTIVE');
  });
});
