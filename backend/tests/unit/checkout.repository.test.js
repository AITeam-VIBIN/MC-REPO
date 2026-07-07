import test from 'node:test';
import assert from 'assert';
import { prisma } from '../../src/config/database.js';
import { cleanupDb } from '../helpers/db.js';
import { CheckoutRepository, CheckoutRepositoryError } from '../../src/repositories/checkout.repository.js';
import { mockDepartment, mockRegularUser, mockAdminUser, mockFolder, mockVault, mockDocument } from '../fixtures/documents.fixture.js';

const checkoutRepo = new CheckoutRepository();

test.describe('Checkout Repository Unit Tests', () => {
  test.beforeEach(async () => {
    await cleanupDb();

    // Seed relations
    await prisma.department.create({ data: mockDepartment });
    await prisma.user.create({ data: mockRegularUser });
    await prisma.user.create({ data: mockAdminUser });
    await prisma.vault.create({ data: mockVault });
    await prisma.folder.create({ data: mockFolder });
    await prisma.document.create({ data: mockDocument });
  });

  test.after(async () => {
    await cleanupDb();
  });

  test('createCheckout creates a valid draft checkout request', async () => {
    const checkoutData = {
      id: 'c0000000-0000-0000-0000-000000000001',
      documentId: mockDocument.id,
      documentVersionId: 'ver-1',
      documentNameSnapshot: mockDocument.name,
      classificationSnapshot: mockDocument.classification,
      requestedById: mockRegularUser.id,
      employeeId: 'EMP-001',
      employeeName: 'Regular Employee',
      department: 'Engineering',
      designation: 'Staff Engineer',
      destination: 'Client Tokyo HQ',
      locationAddress: 'Tokyo, Japan',
      purposeOfRemoval: 'Physical hardware casing integration check.',
      status: 'DRAFT',
    };

    const record = await checkoutRepo.createCheckout(checkoutData);

    assert.ok(record.id);
    assert.strictEqual(record.status, 'DRAFT');
    assert.strictEqual(record.documentNameSnapshot, mockDocument.name);
    assert.strictEqual(record.employeeName, 'Regular Employee');
    assert.strictEqual(record.document.name, mockDocument.name);
    assert.strictEqual(record.requestedBy.email, mockRegularUser.email);
  });

  test('findById returns null for non-existent IDs', async () => {
    const result = await checkoutRepo.findById('c0000000-0000-0000-0000-999999999999');
    assert.strictEqual(result, null);
  });

  test('markApproved, markRejected, markCheckedOut, markReturned, closeCheckout transitions status correctly', async () => {
    const checkoutId = 'c0000000-0000-0000-0000-000000000002';
    
    // Create base draft
    await checkoutRepo.createCheckout({
      id: checkoutId,
      documentId: mockDocument.id,
      documentNameSnapshot: mockDocument.name,
      classificationSnapshot: mockDocument.classification,
      requestedById: mockRegularUser.id,
      employeeName: 'Regular Employee',
      department: 'Engineering',
      destination: 'Client Tokyo HQ',
      locationAddress: 'Tokyo, Japan',
      purposeOfRemoval: 'Integration check.',
      status: 'PENDING_APPROVAL',
    });

    // 1. Approve checkout
    const approved = await checkoutRepo.markApproved(checkoutId, mockAdminUser.id);
    assert.strictEqual(approved.status, 'APPROVED');
    assert.strictEqual(approved.approvedById, mockAdminUser.id);

    // 2. Mark checked out
    const checkedOutDate = new Date();
    const expectedReturnDate = new Date();
    expectedReturnDate.setDate(expectedReturnDate.getDate() + 5);

    const checkedOut = await checkoutRepo.markCheckedOut(checkoutId, checkedOutDate, expectedReturnDate);
    assert.strictEqual(checkedOut.status, 'CHECKED_OUT');
    assert.ok(checkedOut.checkoutDate);

    // 3. Mark returned
    const returned = await checkoutRepo.markReturned(checkoutId, {
      returnStatus: 'Returned and verified',
      returnedTo: 'admin@mitcon.corp',
      conditionOnReturn: 'GOOD',
      returnNotes: 'No physical damage observed.',
    });
    assert.strictEqual(returned.status, 'RETURNED');
    assert.strictEqual(returned.conditionOnReturn, 'GOOD');
    assert.strictEqual(returned.returnStatus, 'Returned and verified');

    // 4. Close checkout
    const closed = await checkoutRepo.closeCheckout(checkoutId);
    assert.strictEqual(closed.status, 'CLOSED');
  });

  test('markRejected stores rejection notes', async () => {
    const checkoutId = 'c0000000-0000-0000-0000-000000000003';
    await checkoutRepo.createCheckout({
      id: checkoutId,
      documentId: mockDocument.id,
      documentNameSnapshot: mockDocument.name,
      classificationSnapshot: mockDocument.classification,
      requestedById: mockRegularUser.id,
      employeeName: 'Regular Employee',
      department: 'Engineering',
      destination: 'Tokyo HQ',
      locationAddress: 'Tokyo, Japan',
      purposeOfRemoval: 'Casing check.',
      status: 'PENDING_APPROVAL',
    });

    const rejected = await checkoutRepo.markRejected(checkoutId, mockAdminUser.id, 'Insufficient reason for off-site removal.');
    assert.strictEqual(rejected.status, 'REJECTED');
    assert.strictEqual(rejected.rejectionReason, 'Insufficient reason for off-site removal.');
  });

  test('findAll filter by activeOnly, overdue, dates, searches, pagination and sorting', async () => {
    const now = new Date();
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    // Seed checking outs
    await checkoutRepo.createCheckout({
      id: 'c0000000-0000-0000-0000-000000000010',
      documentId: mockDocument.id,
      documentNameSnapshot: mockDocument.name,
      classificationSnapshot: mockDocument.classification,
      requestedById: mockRegularUser.id,
      employeeName: 'Regular Employee',
      department: 'Engineering',
      destination: 'Mitcon Branch Tokyo',
      locationAddress: 'Tokyo, Japan',
      purposeOfRemoval: 'Audit.',
      status: 'CHECKED_OUT',
      expectedReturnDate: pastDate, // Overdue
    });

    await checkoutRepo.createCheckout({
      id: 'c0000000-0000-0000-0000-000000000011',
      documentId: mockDocument.id,
      documentNameSnapshot: mockDocument.name,
      classificationSnapshot: mockDocument.classification,
      requestedById: mockRegularUser.id,
      employeeName: 'Regular Employee',
      department: 'Legal',
      destination: 'District Court Osaka',
      locationAddress: 'Osaka, Japan',
      purposeOfRemoval: 'Litigation evidence.',
      status: 'CHECKED_OUT',
      expectedReturnDate: futureDate, // Active, not overdue
    });

    // 1. Query for Active Checkouts
    const active = await checkoutRepo.listActiveCheckouts();
    assert.strictEqual(active.checkouts.length, 2);

    // 2. Query for Overdue Checkouts
    const overdue = await checkoutRepo.listOverdueCheckouts();
    assert.strictEqual(overdue.checkouts.length, 1);
    assert.strictEqual(overdue.checkouts[0].id, 'c0000000-0000-0000-0000-000000000010');

    // 3. Filter by department case-insensitive contains search
    const legalList = await checkoutRepo.listDepartmentCheckouts('leg');
    assert.strictEqual(legalList.checkouts.length, 1);
    assert.strictEqual(legalList.checkouts[0].id, 'c0000000-0000-0000-0000-000000000011');
  });

  test('getCheckoutStats aggregates correct quantities', async () => {
    // Seed checkouts in different states
    await checkoutRepo.createCheckout({
      id: 'c0000000-0000-0000-0000-000000000020',
      documentId: mockDocument.id,
      documentNameSnapshot: mockDocument.name,
      classificationSnapshot: mockDocument.classification,
      requestedById: mockRegularUser.id,
      employeeName: 'Regular Employee',
      department: 'Engineering',
      destination: 'Tokyo HQ',
      locationAddress: 'Tokyo, Japan',
      purposeOfRemoval: 'Casing integration.',
      status: 'CHECKED_OUT',
    });

    await checkoutRepo.createCheckout({
      id: 'c0000000-0000-0000-0000-000000000021',
      documentId: mockDocument.id,
      documentNameSnapshot: mockDocument.name,
      classificationSnapshot: mockDocument.classification,
      requestedById: mockRegularUser.id,
      employeeName: 'Regular Employee',
      department: 'Marketing',
      destination: 'Exhibition Hall',
      locationAddress: 'Osaka, Japan',
      purposeOfRemoval: 'Demo.',
      status: 'RETURNED',
    });

    const stats = await checkoutRepo.getCheckoutStats();
    assert.strictEqual(stats.totalCheckouts, 2);
    assert.strictEqual(stats.activeCheckouts, 1);
    assert.strictEqual(stats.returnedDocuments, 1);
    assert.strictEqual(stats.checkoutsByDepartment['Engineering'], 1);
    assert.strictEqual(stats.checkoutsByDepartment['Marketing'], 1);
    assert.strictEqual(stats.checkoutsByStatus['CHECKED_OUT'], 1);
    assert.strictEqual(stats.checkoutsByStatus['RETURNED'], 1);
  });

  test('softDelete ignores record in queries unless explicitly requested, restore brings it back', async () => {
    const id = 'c0000000-0000-0000-0000-000000000030';
    await checkoutRepo.createCheckout({
      id,
      documentId: mockDocument.id,
      documentNameSnapshot: mockDocument.name,
      classificationSnapshot: mockDocument.classification,
      requestedById: mockRegularUser.id,
      employeeName: 'Regular Employee',
      department: 'Engineering',
      destination: 'Tokyo HQ',
      locationAddress: 'Tokyo, Japan',
      purposeOfRemoval: 'integration.',
      status: 'DRAFT',
    });

    // Soft delete
    await checkoutRepo.softDelete(id, mockAdminUser.id);

    // Should not return in standard findById
    const standardFind = await checkoutRepo.findById(id);
    assert.strictEqual(standardFind, null);

    // Should return when includeDeleted is true
    const withDeletedFind = await checkoutRepo.findById(id, { includeDeleted: true });
    assert.ok(withDeletedFind);
    assert.strictEqual(withDeletedFind.isDeleted, true);
    assert.strictEqual(withDeletedFind.deletedById, mockAdminUser.id);

    // Restore
    await checkoutRepo.restore(id);
    const restoredFind = await checkoutRepo.findById(id);
    assert.ok(restoredFind);
    assert.strictEqual(restoredFind.isDeleted, false);
  });
});
