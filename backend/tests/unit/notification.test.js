import test from 'node:test';
import assert from 'node:assert';
import { prisma } from '../../src/config/database.js';
import { cleanupDb } from '../helpers/db.js';
import { NotificationRepository, NotificationRepositoryError } from '../../src/repositories/notification.repository.js';
import { NotificationService } from '../../src/services/notification.service.js';
import * as notificationUtil from '../../src/utils/notification.util.js';
import { eventBus } from '../../src/shared/event-bus.js';
import { mockDepartment, mockRegularUser, mockAdminUser, mockVault, mockFolder, mockDocument } from '../fixtures/documents.fixture.js';

test.describe('Notification Domain Unit Tests', { concurrency: 1 }, () => {
  let notificationRepository;
  let notificationService;

  test.beforeEach(async () => {
    await cleanupDb();
    eventBus.removeAllListeners();

    // Recreate DB relations needed for mock logs referencing users/departments
    await prisma.department.create({ data: mockDepartment });
    await prisma.user.create({ data: mockRegularUser });
    await prisma.user.create({ data: mockAdminUser });
    await prisma.vault.create({ data: mockVault });
    await prisma.folder.create({ data: mockFolder });
    await prisma.document.create({ data: mockDocument });

    notificationRepository = new NotificationRepository();
    notificationService = new NotificationService();
  });

  test.after(async () => {
    await cleanupDb();
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. Notification Utilities Tests
  // =========================================================================

  test.describe('Notification Utilities', () => {
    test('generateNotificationReference generates formatted unique strings', () => {
      const ref1 = notificationUtil.generateNotificationReference();
      const ref2 = notificationUtil.generateNotificationReference();
      assert.ok(ref1.startsWith('NOTIF-'));
      assert.notStrictEqual(ref1, ref2);
    });

    test('resolvePriority maps categories and events to correct priority level', () => {
      assert.strictEqual(notificationUtil.resolvePriority('SECURITY', 'LOGIN_ALERT'), 'CRITICAL');
      assert.strictEqual(notificationUtil.resolvePriority('APPROVAL', 'APPROVAL_REQUIRED'), 'HIGH');
      assert.strictEqual(notificationUtil.resolvePriority('DOCUMENT', 'DOCUMENT_EXPIRED'), 'HIGH');
      assert.strictEqual(notificationUtil.resolvePriority('DOCUMENT', 'DOCUMENT_UPLOADED'), 'NORMAL');
    });

    test('buildNotificationMessage builds correct title and message from templates', () => {
      const context = { documentName: 'NDA.pdf', userName: 'Alice' };
      const { title, message } = notificationUtil.buildNotificationMessage('DOCUMENT_UPLOADED', context);
      assert.strictEqual(title, 'Document Uploaded Successfully');
      assert.ok(message.includes('NDA.pdf'));
      assert.ok(message.includes('Alice'));
    });
  });

  // =========================================================================
  // 2. Notification Repository Tests
  // =========================================================================

  test.describe('Notification Repository', () => {
    test('create, findById, findByRefNumber, list, and status updates work successfully', async () => {
      // Setup preferences first to avoid constraints
      await notificationRepository.resetPreferences(mockRegularUser.id);

      const notif = await notificationRepository.create({
        refNumber: 'NOTIF-REF-101',
        userId: mockRegularUser.id,
        title: 'Test Notification',
        message: 'This is a test notification.',
        category: 'DOCUMENT',
        priority: 'NORMAL',
        status: 'PENDING',
      });

      assert.strictEqual(notif.refNumber, 'NOTIF-REF-101');
      assert.strictEqual(notif.userId, mockRegularUser.id);
      assert.strictEqual(notif.status, 'PENDING');

      // Find operations
      const foundById = await notificationRepository.findById(notif.id);
      assert.strictEqual(foundById.refNumber, 'NOTIF-REF-101');

      const foundByRef = await notificationRepository.findByRefNumber('NOTIF-REF-101');
      assert.strictEqual(foundByRef.id, notif.id);

      // Status mutations
      await notificationRepository.markAsDelivered(notif.id);
      let updated = await notificationRepository.findById(notif.id);
      assert.strictEqual(updated.status, 'DELIVERED');

      await notificationRepository.markAsRead(notif.id);
      updated = await notificationRepository.findById(notif.id);
      assert.strictEqual(updated.status, 'READ');

      await notificationRepository.archive(notif.id);
      updated = await notificationRepository.findById(notif.id);
      assert.strictEqual(updated.status, 'ARCHIVED');
      assert.ok(updated.archivedAt);

      // List & pagination
      const { logs, total } = await notificationRepository.list({ userId: mockRegularUser.id });
      assert.strictEqual(total, 1);
      assert.strictEqual(logs[0].id, notif.id);
    });

    test('preferences persistence creates, gets, updates, and resets user choices', async () => {
      // Reset preference
      let prefs = await notificationRepository.resetPreferences(mockRegularUser.id);
      assert.strictEqual(prefs.userId, mockRegularUser.id);
      assert.strictEqual(prefs.emailEnabled, true);

      // Retrieve preferences
      prefs = await notificationRepository.getPreferencesByUserId(mockRegularUser.id);
      assert.strictEqual(prefs.inAppEnabled, true);

      // Update preferences
      await notificationRepository.updatePreferences(mockRegularUser.id, {
        emailEnabled: false,
        inAppEnabled: false,
      });

      prefs = await notificationRepository.getPreferencesByUserId(mockRegularUser.id);
      assert.strictEqual(prefs.emailEnabled, false);
      assert.strictEqual(prefs.inAppEnabled, false);
    });

    test('deliveries log persistence creates and updates attempts', async () => {
      const notif = await notificationRepository.create({
        refNumber: 'NOTIF-REF-102',
        userId: mockRegularUser.id,
        title: 'Test Delivery Notification',
        message: 'Testing delivery records.',
        category: 'DOCUMENT',
        priority: 'NORMAL',
      });

      const delivery = await notificationRepository.createDelivery({
        notificationId: notif.id,
        channel: 'EMAIL',
        status: 'PENDING',
      });

      assert.strictEqual(delivery.notificationId, notif.id);
      assert.strictEqual(delivery.channel, 'EMAIL');
      assert.strictEqual(delivery.status, 'PENDING');

      // Update delivery attempt
      await notificationRepository.updateDeliveryAttempt(delivery.id, 'DELIVERED', 1, null);
      const updated = await prisma.notificationDelivery.findUnique({ where: { id: delivery.id } });
      assert.strictEqual(updated.status, 'DELIVERED');
      assert.strictEqual(updated.attemptCount, 1);
      assert.ok(updated.deliveredAt);
    });

    test('stats and counts queries compile aggregates correctly', async () => {
      await notificationRepository.create({
        refNumber: 'NOTIF-REF-103',
        userId: mockRegularUser.id,
        title: 'Unread Normal Notif',
        message: 'Unread Normal.',
        category: 'DOCUMENT',
        priority: 'NORMAL',
        status: 'PENDING',
      });

      await notificationRepository.create({
        refNumber: 'NOTIF-REF-104',
        userId: mockRegularUser.id,
        title: 'Unread Critical Notif',
        message: 'Unread Critical.',
        category: 'SECURITY',
        priority: 'CRITICAL',
        status: 'DELIVERED',
      });

      const unreadCount = await notificationRepository.getUnreadCount(mockRegularUser.id);
      assert.strictEqual(unreadCount, 2);

      const stats = await notificationRepository.getStats(mockRegularUser.id);
      assert.strictEqual(stats.total, 2);
      assert.strictEqual(stats.unread, 2);
      assert.strictEqual(stats.critical, 1);
      assert.strictEqual(stats.byCategory.DOCUMENT, 1);
      assert.strictEqual(stats.byCategory.SECURITY, 1);
    });
  });

  // =========================================================================
  // 3. Notification Service Tests
  // =========================================================================

  test.describe('Notification Service', () => {
    test('createNotification evaluates user preferences and sets up target delivery logs', async () => {
      // User allows all channels
      await notificationRepository.resetPreferences(mockRegularUser.id);

      const notif1 = await notificationService.createNotification({
        userId: mockRegularUser.id,
        category: 'DOCUMENT',
        eventType: 'DOCUMENT_UPLOADED',
        context: { documentName: 'ArchitectSpecs.docx', userName: 'Alice' },
      });

      assert.strictEqual(notif1.title, 'Document Uploaded Successfully');
      // Should create 3 deliveries since user has all 3 channels enabled
      assert.strictEqual(notif1.deliveries.length, 3);
      assert.ok(notif1.deliveries.some(d => d.channel === 'IN_APP'));
      assert.ok(notif1.deliveries.some(d => d.channel === 'EMAIL'));
      assert.ok(notif1.deliveries.some(d => d.channel === 'REAL_TIME'));

      // Now disable Email and Real-Time channels in preferences
      await notificationRepository.updatePreferences(mockRegularUser.id, {
        emailEnabled: false,
        realTimeEnabled: false,
      });

      const notif2 = await notificationService.createNotification({
        userId: mockRegularUser.id,
        category: 'DOCUMENT',
        eventType: 'DOCUMENT_UPLOADED',
        context: { documentName: 'Draft.pdf', userName: 'Alice' },
      });

      // Should only create 1 delivery for IN_APP
      assert.strictEqual(notif2.deliveries.length, 1);
      assert.strictEqual(notif2.deliveries[0].channel, 'IN_APP');

      // Critical alerts / Security warnings must bypass user preferences and force all channels
      const notif3 = await notificationService.createNotification({
        userId: mockRegularUser.id,
        category: 'SECURITY',
        eventType: 'LOGIN_ALERT',
        context: { ipAddress: '10.0.0.5' },
      });

      // Even with disabled channels, SECURITY forces all 3 channels
      assert.strictEqual(notif3.deliveries.length, 3);
    });

    test('event listeners successfully capture triggered system events and log alerts', async () => {
      await notificationRepository.resetPreferences(mockRegularUser.id);

      // Emit document download trigger via global event bus
      eventBus.emit('DOCUMENT_DOWNLOADED', {
        documentId: mockDocument.id,
        userId: mockRegularUser.id,
        details: { documentName: 'SecureSpecs.pdf', userName: 'John Doe', ipAddress: '192.168.1.5' },
      });

      // Poll database feed until the notification log is persisted
      let logs = [];
      for (let i = 0; i < 20; i++) {
        const feed = await notificationService.getUserFeed(mockRegularUser.id);
        logs = feed.logs;
        if (logs.length > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].category, 'DOCUMENT');
      assert.strictEqual(logs[0].title, 'Document Downloaded');
      assert.ok(logs[0].message.includes('John Doe'));
    });
  });
});
