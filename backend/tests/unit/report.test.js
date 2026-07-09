process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert';
import { prisma } from '../../src/config/database.js';
import { cleanupDb } from '../helpers/db.js';
import { ReportRepository, ReportRepositoryError } from '../../src/repositories/report.repository.js';
import { ReportService } from '../../src/services/report.service.js';
import * as reportUtil from '../../src/utils/report.util.js';
import { mockDepartment, mockRegularUser, mockAdminUser } from '../fixtures/documents.fixture.js';
import { setupStorageMock, restoreStorageMock } from '../mocks/storage.mock.js';

test.describe('Report Domain Unit Tests', { concurrency: 1 }, () => {
  let reportRepository;
  let reportService;

  test.beforeEach(async () => {
    await cleanupDb();
    setupStorageMock();

    // Recreate DB relations needed for mock logs referencing users/departments
    await prisma.department.create({ data: mockDepartment });
    await prisma.user.create({ data: mockRegularUser });
    await prisma.user.create({ data: mockAdminUser });

    reportRepository = new ReportRepository();
    reportService = new ReportService();
  });

  test.after(async () => {
    restoreStorageMock();
    await cleanupDb();
    await prisma.$disconnect();
  });

  test.describe('Report Utilities', () => {
    test('generateReportReference generates formatted unique strings', () => {
      const ref1 = reportUtil.generateReportReference();
      const ref2 = reportUtil.generateReportReference();
      assert.ok(ref1.startsWith('REP-'));
      assert.notStrictEqual(ref1, ref2);
    });

    test('isValidReportType validates report types correctly', () => {
      assert.strictEqual(reportUtil.isValidReportType('DOCUMENT_ACTIVITY'), true);
      assert.strictEqual(reportUtil.isValidReportType('INVALID_TYPE'), false);
    });

    test('isValidReportFormat validates report formats correctly', () => {
      assert.strictEqual(reportUtil.isValidReportFormat('PDF'), true);
      assert.strictEqual(reportUtil.isValidReportFormat('EXCEL'), true);
      assert.strictEqual(reportUtil.isValidReportFormat('CSV'), true);
      assert.strictEqual(reportUtil.isValidReportFormat('PNG'), false);
    });
  });

  test.describe('Report Repository', () => {
    test('create, get, list, status updates, and history work', async () => {
      const report = await reportRepository.createReport({
        refNumber: 'REP-REF-101',
        name: 'Document Activity Report Test',
        type: 'DOCUMENT_ACTIVITY',
        format: 'PDF',
        status: 'QUEUED',
        userId: mockRegularUser.id,
        departmentSnapshot: 'Engineering',
      });

      assert.strictEqual(report.refNumber, 'REP-REF-101');
      assert.strictEqual(report.status, 'QUEUED');

      const foundById = await reportRepository.getReportById(report.id);
      assert.strictEqual(foundById.refNumber, 'REP-REF-101');

      const foundByRef = await reportRepository.getReportByRef('REP-REF-101');
      assert.strictEqual(foundByRef.id, report.id);

      // Status updates
      await reportRepository.updateReportStatus(report.id, 'PROCESSING', {
        startedAt: new Date(),
      });
      let updated = await reportRepository.getReportById(report.id);
      assert.strictEqual(updated.status, 'PROCESSING');

      // Generated File info updates
      await reportRepository.updateGeneratedFileInfo(report.id, {
        storageProvider: 'SUPABASE',
        bucketName: 'documents',
        filePath: 'reports/test.pdf',
        fileName: 'test.pdf',
        fileSize: 500,
        fileHash: 'abcdef',
      });
      updated = await reportRepository.getReportById(report.id);
      assert.strictEqual(updated.filePath, 'reports/test.pdf');
      assert.strictEqual(updated.fileHash, 'abcdef');

      // History entries
      await reportRepository.createHistoryEntry({
        reportId: report.id,
        action: 'GENERATED',
        performedBy: 'System',
      });
      const timeline = await reportRepository.getReportTimeline(report.id);
      assert.strictEqual(timeline.length, 1);
      assert.strictEqual(timeline[0].action, 'GENERATED');
    });

    test('scheduled reports operations work', async () => {
      const schedule = await reportRepository.createSchedule({
        name: 'Weekly Security Scan',
        reportType: 'SECURITY_REPORT',
        format: 'PDF',
        frequency: 'WEEKLY',
        ownerId: mockAdminUser.id,
        nextExecutionTime: new Date(Date.now() - 1000), // due now
      });

      assert.strictEqual(schedule.name, 'Weekly Security Scan');

      const activeSchedules = await reportRepository.listActiveSchedules();
      assert.ok(activeSchedules.length > 0);

      const dueSchedules = await reportRepository.listDueSchedules();
      assert.ok(dueSchedules.length > 0);

      await reportRepository.disableSchedule(schedule.id);
      const activeSchedulesPostDisable = await reportRepository.listActiveSchedules();
      assert.strictEqual(activeSchedulesPostDisable.find(s => s.id === schedule.id), undefined);
    });
  });

  test.describe('Report Service', () => {
    test('createReport validates parameters and enforces RBAC', async () => {
      // Create a VIEWER request
      const viewerPayload = {
        name: 'My User Report',
        type: 'USER_ACTIVITY',
        format: 'PDF',
        filters: { userId: mockRegularUser.id },
      };

      const result = await reportService.createReport(viewerPayload, {
        id: mockRegularUser.id,
        email: mockRegularUser.email,
        role: 'USER', // mapped to VIEWER
      });

      assert.strictEqual(result.status, 'QUEUED');
      assert.ok(result.refNumber.startsWith('REP-'));

      // Check that unauthorized filters are rejected
      await assert.rejects(
        reportService.createReport({
          ...viewerPayload,
          filters: { userId: mockAdminUser.id }, // viewing other user's data
        }, {
          id: mockRegularUser.id,
          email: mockRegularUser.email,
          role: 'USER',
        }),
        /Access denied/
      );
    });
  });
});
