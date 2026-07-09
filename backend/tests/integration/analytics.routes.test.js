process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert';
import app from '../../src/app.js';
import { prisma } from '../../src/config/database.js';
import { cleanupDb } from '../helpers/db.js';
import { setupStorageMock, restoreStorageMock } from '../mocks/storage.mock.js';
import { supabaseAnon } from '../../src/config/supabase.js';
import { mockDepartment, mockRegularUser, mockAdminUser } from '../fixtures/documents.fixture.js';

let server;
const PORT = 5006;
const BASE_URL = `http://localhost:${PORT}/api/v1/analytics`;

test.describe('Analytics API Routes Integration Tests', () => {
  test.before(async () => {
    setupStorageMock();
    server = app.listen(PORT);

    // Mock User Resolver
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

    // Setup base users and departments
    await prisma.department.create({ data: mockDepartment });
    await prisma.user.create({ data: mockRegularUser });
    await prisma.user.create({ data: mockAdminUser });

    const sessionExpiry = new Date(Date.now() + 24 * 3600 * 1000);

    // Sessions seeding
    await prisma.session.create({
      data: {
        id: 'da000000-0000-0000-0000-000000000060',
        userId: mockRegularUser.id,
        token: 'user-token',
        expiresAt: sessionExpiry,
      },
    });

    await prisma.session.create({
      data: {
        id: 'da000000-0000-0000-0000-000000000061',
        userId: mockAdminUser.id,
        token: 'admin-token',
        expiresAt: sessionExpiry,
      },
    });
  });

  test('GET /analytics/overview - resolves metrics and distributions', async () => {
    const res = await fetch(`${BASE_URL}/overview`, {
      headers: { 'Authorization': 'Bearer admin-token' }
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data.metrics);
    assert.ok(json.data.charts);
    assert.ok(json.data.lastUpdated);
  });

  test('GET /analytics/users - allows Admin role but denies Viewer role', async () => {
    // 1. Viewer check (fails with 403)
    const resUser = await fetch(`${BASE_URL}/users`, {
      headers: { 'Authorization': 'Bearer user-token' }
    });
    assert.strictEqual(resUser.status, 403);

    // 2. Admin check (succeeds with 200)
    const resAdmin = await fetch(`${BASE_URL}/users`, {
      headers: { 'Authorization': 'Bearer admin-token' }
    });
    assert.strictEqual(resAdmin.status, 200);
    const json = await resAdmin.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data.metrics.activeUsersCount !== undefined);
  });
});
