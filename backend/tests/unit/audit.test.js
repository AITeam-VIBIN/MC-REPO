import test from 'node:test';
import assert from 'node:assert';
import { prisma } from '../../src/config/database.js';
import { cleanupDb } from '../helpers/db.js';
import { AuditRepository, AuditRepositoryError } from '../../src/repositories/audit.repository.js';
import { AuditService } from '../../src/services/audit.service.js';
import * as auditUtil from '../../src/utils/audit.util.js';
import { eventBus } from '../../src/shared/event-bus.js';
import { mockDepartment, mockRegularUser, mockAdminUser, mockVault, mockFolder, mockDocument } from '../fixtures/documents.fixture.js';

test.describe('Audit Domain Unit Tests', () => {
  let auditRepository;
  let auditService;

  test.beforeEach(async () => {
    await cleanupDb();

    // Recreate DB relations needed for mock logs referencing users/departments
    await prisma.department.create({ data: mockDepartment });
    await prisma.user.create({ data: mockRegularUser });
    await prisma.vault.create({ data: mockVault });
    await prisma.folder.create({ data: mockFolder });
    await prisma.document.create({ data: mockDocument });

    auditRepository = new AuditRepository();
    auditService = new AuditService();
  });

  test.after(async () => {
    await cleanupDb();
  });

  // =========================================================================
  // 1. Audit Utilities Tests
  // =========================================================================

  test.describe('Audit Utilities', () => {
    test('generateEventReference generates formatted unique strings', () => {
      const ref1 = auditUtil.generateEventReference();
      const ref2 = auditUtil.generateEventReference();
      assert.ok(ref1.startsWith('AUDIT-'));
      assert.notStrictEqual(ref1, ref2);
    });

    test('maskSensitiveFields redacts target passwords and keys in nested objects', () => {
      const payload = {
        password: 'super-secret-password',
        user: {
          email: 'test@example.com',
          jwtToken: 'my-jwt-token-string',
        },
        otherData: 'safe-value',
      };

      const masked = auditUtil.maskSensitiveFields(payload);
      assert.strictEqual(masked.password, '[REDACTED]');
      assert.strictEqual(masked.user.jwtToken, '[REDACTED]');
      assert.strictEqual(masked.otherData, 'safe-value');
    });

    test('compareStateChanges detects transitions and lists changed properties', () => {
      const before = { status: 'ACTIVE', version: 1, tags: ['a', 'b'] };
      const after = { status: 'CHECKED_OUT', version: 1, tags: ['a', 'c'] };

      const diffs = auditUtil.compareStateChanges(before, after);
      assert.deepStrictEqual(diffs.previousState, { status: 'ACTIVE', tags: ['a', 'b'] });
      assert.deepStrictEqual(diffs.newState, { status: 'CHECKED_OUT', tags: ['a', 'c'] });
      assert.ok(diffs.changedFields.includes('status'));
      assert.ok(diffs.changedFields.includes('tags'));
      assert.ok(!diffs.changedFields.includes('version'));
    });
  });

  // =========================================================================
  // 2. Audit Repository Tests
  // =========================================================================

  test.describe('Audit Repository', () => {
    test('create adds record successfully and blocks updates/deletes to enforce immutability', async () => {
      const log = await auditRepository.create({
        eventRef: 'REF-REP-001',
        userId: mockRegularUser.id,
        eventType: 'LOGIN_SUCCESS',
        category: 'AUTHENTICATION',
        action: 'LOGIN',
        result: 'SUCCESS',
        description: 'Repository create test',
      });

      assert.strictEqual(log.eventRef, 'REF-REP-001');
      assert.strictEqual(log.userId, mockRegularUser.id);

      // Blocked Operations Verification
      await assert.rejects(
        () => auditRepository.update(log.id, { action: 'LOGOUT' }),
        (err) => err instanceof AuditRepositoryError && err.code === 'UNAUTHORIZED_MUTATION'
      );

      await assert.rejects(
        () => auditRepository.delete(log.id),
        (err) => err instanceof AuditRepositoryError && err.code === 'UNAUTHORIZED_MUTATION'
      );
    });

    test('lists records with pagination and date range filters', async () => {
      // Seed audit entries
      await auditRepository.create({
        eventRef: 'REF-REP-101',
        userId: mockRegularUser.id,
        eventType: 'DOCUMENT_UPLOADED',
        category: 'DOCUMENT',
        action: 'UPLOAD',
        result: 'SUCCESS',
      });

      await auditRepository.create({
        eventRef: 'REF-REP-102',
        userId: mockRegularUser.id,
        eventType: 'DOCUMENT_DOWNLOADED',
        category: 'DOCUMENT',
        action: 'DOWNLOAD',
        result: 'SUCCESS',
      });

      const { logs, total } = await auditRepository.list({ category: 'DOCUMENT' }, { page: 1, limit: 1 });
      assert.strictEqual(total, 2);
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].eventRef, 'REF-REP-102'); // Newer first by default
    });

    test('timeline and statistics helper methods', async () => {
      await auditRepository.create({
        eventRef: 'REF-REP-201',
        userId: mockRegularUser.id,
        eventType: 'DOCUMENT_VIEWED',
        category: 'DOCUMENT',
        action: 'VIEW',
        result: 'SUCCESS',
        referenceType: 'DOCUMENT',
        referenceId: mockDocument.id,
      });

      // Timeline check
      const { logs: resourceTimeline } = await auditRepository.getResourceTimeline('DOCUMENT', mockDocument.id);
      assert.strictEqual(resourceTimeline.length, 1);
      assert.strictEqual(resourceTimeline[0].eventRef, 'REF-REP-201');

      // Statistics check
      const total = await auditRepository.getTotalEventsCount();
      assert.strictEqual(total, 1);
    });
  });

  // =========================================================================
  // 3. Audit Service Tests
  // =========================================================================

  test.describe('Audit Service', () => {
    test('recordEvent performs validation, context enrichment, and links hashes in chains', async () => {
      const log1 = await auditService.recordEvent({
        userId: mockRegularUser.id,
        category: 'DOCUMENT',
        action: 'UPLOAD',
        eventType: 'DOCUMENT_UPLOADED',
        result: 'SUCCESS',
        description: 'Block 1',
      });

      assert.strictEqual(log1.userId, mockRegularUser.id);
      assert.strictEqual(log1.roleSnapshot, mockRegularUser.role);
      assert.strictEqual(log1.departmentSnapshot, mockDepartment.name);
      assert.ok(log1.prevRecordHash === '' || log1.prevRecordHash === null);
      assert.ok(log1.recordHash);

      const log2 = await auditService.recordEvent({
        userId: mockRegularUser.id,
        category: 'DOCUMENT',
        action: 'DOWNLOAD',
        eventType: 'DOCUMENT_DOWNLOADED',
        result: 'SUCCESS',
        description: 'Block 2',
      });

      assert.strictEqual(log2.prevRecordHash, log1.recordHash);
      assert.ok(log2.recordHash);

      // Verify overall chain validity
      const verification = await auditService.validateAuditIntegrity();
      if (!verification.isValid) {
        console.log('AUDIT INTEGRITY ANOMALIES:', JSON.stringify(verification.anomalies, null, 2));
      }
      assert.strictEqual(verification.isValid, true);
      assert.strictEqual(verification.anomalies.length, 0);
    });

    test('strict mode triggers error throws on validation failures', async () => {
      // Set strict mode temporarily
      process.env.AUDIT_STRICT_MODE = 'true';

      await assert.rejects(
        () => auditService.recordEvent({
          category: 'INVALID_CATEGORY',
          action: 'LOGIN',
        }),
        /Invalid or missing/
      );

      // Reset mode
      process.env.AUDIT_STRICT_MODE = 'false';
    });
  });

  // =========================================================================
  // 4. Event Bus Integration Tests
  // =========================================================================

  test.describe('Event Bus', () => {
    test('event listeners trigger auto audit captures successfully', async () => {
      let documentLogs = await auditService.searchAuditLogs({ category: 'DOCUMENT' }, {}, mockAdminUser);
      assert.strictEqual(documentLogs.total, 0);

      // Emit document upload trigger via bus
      eventBus.emit('DOCUMENT_UPLOADED', {
        documentId: mockDocument.id,
        userId: mockRegularUser.id,
        details: { size: '2048' },
      });

      // Wait a short duration to let the event listener promise resolve
      await new Promise((resolve) => setTimeout(resolve, 500));

      documentLogs = await auditService.searchAuditLogs({ category: 'DOCUMENT' }, {}, mockAdminUser);
      assert.strictEqual(documentLogs.total, 1);
      assert.strictEqual(documentLogs.logs[0].referenceType, 'DOCUMENT');
      assert.strictEqual(documentLogs.logs[0].referenceId, mockDocument.id);
    });
  });
});
