import test from 'node:test';
import assert from 'assert';
import app from '../../src/app.js';
import { prisma } from '../../src/config/database.js';
import { cleanupDb } from '../helpers/db.js';
import { setupStorageMock, restoreStorageMock } from '../mocks/storage.mock.js';
import { supabaseAnon } from '../../src/config/supabase.js';
import { mockDepartment, mockRegularUser, mockAdminUser, mockFolder, mockVault, mockDocument } from '../fixtures/documents.fixture.js';

let server;
const PORT = 5002;
const BASE_URL = `http://localhost:${PORT}/api/v1/checkouts`;

test.describe('Checkout API Integration Tests', () => {
  test.before(async () => {
    setupStorageMock();
    server = app.listen(PORT);

    // Mock Supabase getUser call
    supabaseAnon.auth.getUser = async (token) => {
      if (token === 'admin-token') {
        return { data: { user: { id: mockAdminUser.id, email: mockAdminUser.email } }, error: null };
      }
      return { data: { user: { id: mockRegularUser.id, email: mockRegularUser.email } }, error: null };
    };
  });

  test.after(async () => {
    restoreStorageMock();
    server.close();
    await cleanupDb();
  });

  test.beforeEach(async () => {
    await cleanupDb();

    // Seed relations
    await prisma.department.create({ data: mockDepartment });
    await prisma.user.create({ data: mockRegularUser });
    await prisma.user.create({ data: mockAdminUser });
    await prisma.vault.create({ data: mockVault });
    await prisma.folder.create({ data: mockFolder });
    await prisma.document.create({ data: mockDocument });

    const sessionExpiry = new Date(Date.now() + 24 * 3600 * 1000);

    // Seed sessions
    await prisma.session.create({
      data: {
        id: 's0000000-0000-0000-0000-000000000001',
        userId: mockRegularUser.id,
        token: 'user-token',
        expiresAt: sessionExpiry,
      },
    });

    await prisma.session.create({
      data: {
        id: 's0000000-0000-0000-0000-000000000002',
        userId: mockAdminUser.id,
        token: 'admin-token',
        expiresAt: sessionExpiry,
      },
    });
  });

  test('POST /checkouts - creates a checkout request', async () => {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer user-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentId: mockDocument.id,
        purpose: 'On-site blueprints check.',
        destination: 'Osaka HQ',
        locationAddress: 'Osaka, Japan',
        expectedReturnDate: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
      }),
    });

    const json = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.purposeOfRemoval, 'On-site blueprints check.');
  });

  test('GET /checkouts/:id - retrieves details for owner/admin', async () => {
    // Seed checkout
    const checkout = await prisma.checkout.create({
      data: {
        id: 'c0000000-0000-0000-0000-000000000090',
        documentId: mockDocument.id,
        documentNameSnapshot: mockDocument.name,
        classificationSnapshot: mockDocument.classification,
        requestedById: mockRegularUser.id,
        employeeName: 'Regular Employee',
        department: 'Engineering',
        destination: 'Osaka HQ',
        locationAddress: 'Osaka, Japan',
        purposeOfRemoval: 'Blueprints check.',
        status: 'PENDING_APPROVAL',
      },
    });

    const res = await fetch(`${BASE_URL}/${checkout.id}`, {
      headers: { 'Authorization': 'Bearer user-token' },
    });

    const json = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.id, checkout.id);
  });

  test('GET /checkouts - lists checkouts', async () => {
    await prisma.checkout.create({
      data: {
        id: 'c0000000-0000-0000-0000-000000000091',
        documentId: mockDocument.id,
        documentNameSnapshot: mockDocument.name,
        classificationSnapshot: mockDocument.classification,
        requestedById: mockRegularUser.id,
        employeeName: 'Regular Employee',
        department: 'Engineering',
        destination: 'Osaka HQ',
        locationAddress: 'Osaka, Japan',
        purposeOfRemoval: 'Blueprints check.',
        status: 'PENDING_APPROVAL',
      },
    });

    const res = await fetch(BASE_URL, {
      headers: { 'Authorization': 'Bearer user-token' },
    });

    const json = await res.json();
    assert.strictEqual(res.status, 200);
    assert.ok(json.data.length > 0);
  });

  test('GET /checkouts/my - retrieves current user checkouts', async () => {
    const res = await fetch(`${BASE_URL}/my`, {
      headers: { 'Authorization': 'Bearer user-token' },
    });

    const json = await res.json();
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(json.data));
  });

  test('PATCH /checkouts/:id - updates draft/pending properties', async () => {
    const checkout = await prisma.checkout.create({
      data: {
        id: 'c0000000-0000-0000-0000-000000000092',
        documentId: mockDocument.id,
        documentNameSnapshot: mockDocument.name,
        classificationSnapshot: mockDocument.classification,
        requestedById: mockRegularUser.id,
        employeeName: 'Regular Employee',
        department: 'Engineering',
        destination: 'Osaka HQ',
        locationAddress: 'Osaka, Japan',
        purposeOfRemoval: 'Original Purpose',
        status: 'PENDING_APPROVAL',
      },
    });

    const res = await fetch(`${BASE_URL}/${checkout.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer user-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        purpose: 'Updated Purpose',
      }),
    });

    const json = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.data.purposeOfRemoval, 'Updated Purpose');
  });

  test('PATCH /checkouts/:id/cancel - cancels checkout request', async () => {
    const checkout = await prisma.checkout.create({
      data: {
        id: 'c0000000-0000-0000-0000-000000000093',
        documentId: mockDocument.id,
        documentNameSnapshot: mockDocument.name,
        classificationSnapshot: mockDocument.classification,
        requestedById: mockRegularUser.id,
        employeeName: 'Regular Employee',
        department: 'Engineering',
        destination: 'Osaka HQ',
        locationAddress: 'Osaka, Japan',
        purposeOfRemoval: 'Cancel check.',
        status: 'PENDING_APPROVAL',
      },
    });

    const res = await fetch(`${BASE_URL}/${checkout.id}/cancel`, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer user-token' },
    });

    const json = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.data.status, 'CANCELLED');
  });

  test('DELETE /checkouts/:id - soft deletes checkout record', async () => {
    const checkout = await prisma.checkout.create({
      data: {
        id: 'c0000000-0000-0000-0000-000000000094',
        documentId: mockDocument.id,
        documentNameSnapshot: mockDocument.name,
        classificationSnapshot: mockDocument.classification,
        requestedById: mockRegularUser.id,
        employeeName: 'Regular Employee',
        department: 'Engineering',
        destination: 'Osaka HQ',
        locationAddress: 'Osaka, Japan',
        purposeOfRemoval: 'Delete check.',
        status: 'DRAFT',
      },
    });

    const res = await fetch(`${BASE_URL}/${checkout.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer user-token' },
    });

    const json = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);

    const dbRecord = await prisma.checkout.findUnique({ where: { id: checkout.id } });
    assert.strictEqual(dbRecord.isDeleted, true);
  });
});
