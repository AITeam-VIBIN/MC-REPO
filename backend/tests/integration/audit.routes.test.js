import test from 'node:test';
import assert from 'node:assert';
import app from '../../src/app.js';
import { prisma } from '../../src/config/database.js';
import { cleanupDb } from '../helpers/db.js';
import { setupStorageMock, restoreStorageMock } from '../mocks/storage.mock.js';
import { supabaseAnon } from '../../src/config/supabase.js';
import { mockDepartment, mockRegularUser, mockAdminUser, mockFolder, mockVault } from '../fixtures/documents.fixture.js';

let server;
const PORT = 5005;
const BASE_URL = `http://localhost:${PORT}/api/v1/audit`;

const mockEditorUser = {
  id: 'ba000000-0000-0000-0000-000000000003',
  email: 'editor@mitcon.corp',
  role: 'EDITOR',
  departmentId: 'de000000-0000-0000-0000-000000000001',
  createdAt: new Date(),
  updatedAt: new Date(),
};

test.describe('Audit API Routes Integration Tests', () => {
  test.before(async () => {
    setupStorageMock();
    server = app.listen(PORT);

    // Mock User Resolver
    supabaseAnon.auth.getUser = async (token) => {
      if (token === 'admin-token') {
        return { data: { user: { id: mockAdminUser.id, email: mockAdminUser.email } }, error: null };
      }
      if (token === 'editor-token') {
        return { data: { user: { id: mockEditorUser.id, email: mockEditorUser.email } }, error: null };
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

    // Setup base users and dependencies
    await prisma.department.create({ data: mockDepartment });
    await prisma.user.create({ data: mockRegularUser });
    await prisma.user.create({ data: mockAdminUser });
    await prisma.user.create({ data: mockEditorUser });
    await prisma.vault.create({ data: mockVault });
    await prisma.folder.create({ data: mockFolder });

    const sessionExpiry = new Date(Date.now() + 24 * 3600 * 1000);

    // Sessions seeding
    await prisma.session.create({
      data: {
        id: 'da000000-0000-0000-0000-000000000050',
        userId: mockRegularUser.id,
        token: 'user-token',
        expiresAt: sessionExpiry,
      },
    });

    await prisma.session.create({
      data: {
        id: 'da000000-0000-0000-0000-000000000051',
        userId: mockAdminUser.id,
        token: 'admin-token',
        expiresAt: sessionExpiry,
      },
    });

    await prisma.session.create({
      data: {
        id: 'da000000-0000-0000-0000-000000000052',
        userId: mockEditorUser.id,
        token: 'editor-token',
        expiresAt: sessionExpiry,
      },
    });

    // Seed test audit logs representing different users and departments
    await prisma.auditLog.create({
      data: {
        id: 'ab000000-0000-0000-0000-000000000001',
        eventRef: 'REF-INT-001',
        userId: mockRegularUser.id,
        userSnapshot: mockRegularUser.email,
        roleSnapshot: mockRegularUser.role,
        departmentSnapshot: 'Engineering',
        eventType: 'LOGIN_SUCCESS',
        category: 'AUTHENTICATION',
        action: 'LOGIN',
        result: 'SUCCESS',
        ipAddress: '127.0.0.1',
        recordHash: 'dummyhash1',
        prevRecordHash: '',
      }
    });

    await prisma.auditLog.create({
      data: {
        id: 'ab000000-0000-0000-0000-000000000002',
        eventRef: 'REF-INT-002',
        userId: mockAdminUser.id,
        userSnapshot: mockAdminUser.email,
        roleSnapshot: mockAdminUser.role,
        departmentSnapshot: 'Management',
        eventType: 'DOCUMENT_UPLOADED',
        category: 'DOCUMENT',
        action: 'UPLOAD',
        result: 'SUCCESS',
        ipAddress: '127.0.0.2',
        recordHash: 'dummyhash2',
        prevRecordHash: 'dummyhash1',
      }
    });

    await prisma.auditLog.create({
      data: {
        id: 'ab000000-0000-0000-0000-000000000003',
        eventRef: 'REF-INT-003',
        userId: mockEditorUser.id,
        userSnapshot: mockEditorUser.email,
        roleSnapshot: mockEditorUser.role,
        departmentSnapshot: 'Engineering',
        eventType: 'LOGIN_FAILED',
        category: 'AUTHENTICATION',
        action: 'LOGIN',
        result: 'FAILED',
        ipAddress: '127.0.0.3',
        recordHash: 'dummyhash3',
        prevRecordHash: 'dummyhash2',
      }
    });
  });

  // =========================================================================
  // 1. Role-Based Scoping Tests
  // =========================================================================

  test('GET /audit - Regular User (VIEWER) only gets back own activity logs', async () => {
    const res = await fetch(`${BASE_URL}`, {
      headers: { 'Authorization': 'Bearer user-token' }
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.length, 1);
    assert.strictEqual(json.data[0].userId, mockRegularUser.id);
  });

  test('GET /audit - Admin User (EDITOR) only gets back logs of their department (Engineering)', async () => {
    const res = await fetch(`${BASE_URL}`, {
      headers: { 'Authorization': 'Bearer editor-token' }
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    // RegularUser and EditorUser are in 'Engineering'. AdminUser is in 'Management'.
    assert.strictEqual(json.data.length, 2);
    assert.ok(json.data.every(log => log.departmentSnapshot === 'Engineering'));
  });

  test('GET /audit - Super Admin (ADMIN) gets back complete audit visibility', async () => {
    const res = await fetch(`${BASE_URL}`, {
      headers: { 'Authorization': 'Bearer admin-token' }
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.length, 3);
  });

  // =========================================================================
  // 2. Timeline API Tests
  // =========================================================================

  test('GET /audit/my-activity - Retrieves personal timeline successfully', async () => {
    const res = await fetch(`${BASE_URL}/my-activity`, {
      headers: { 'Authorization': 'Bearer user-token' }
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.length, 1);
    assert.strictEqual(json.data[0].actor, mockRegularUser.email);
  });

  test('GET /audit/security/events - Denies viewer but allows editor role', async () => {
    // 1. Viewer check (fails)
    const resViewer = await fetch(`${BASE_URL}/security/events`, {
      headers: { 'Authorization': 'Bearer user-token' }
    });
    assert.strictEqual(resViewer.status, 403);

    // 2. Editor check (succeeds)
    const resEditor = await fetch(`${BASE_URL}/security/events`, {
      headers: { 'Authorization': 'Bearer editor-token' }
    });
    assert.strictEqual(resEditor.status, 200);
    const json = await resEditor.json();
    assert.strictEqual(json.success, true);
  });

  // =========================================================================
  // 3. Detail View and Data Protection
  // =========================================================================

  test('GET /audit/:id - Hides blockchain recordHash context from non-ADMIN users', async () => {
    // 1. Request details as regular user
    const resUser = await fetch(`${BASE_URL}/ab000000-0000-0000-0000-000000000001`, {
      headers: { 'Authorization': 'Bearer user-token' }
    });
    assert.strictEqual(resUser.status, 200);
    const jsonUser = await resUser.json();
    assert.strictEqual(jsonUser.data.recordHash, undefined);

    // 2. Request details as super admin
    const resAdmin = await fetch(`${BASE_URL}/ab000000-0000-0000-0000-000000000001`, {
      headers: { 'Authorization': 'Bearer admin-token' }
    });
    assert.strictEqual(resAdmin.status, 200);
    const jsonAdmin = await resAdmin.json();
    assert.strictEqual(jsonAdmin.data.recordHash, 'dummyhash1');
  });

  test('GET /audit/:id - Blocks unauthorized user timeline access', async () => {
    const res = await fetch(`${BASE_URL}/ab000000-0000-0000-0000-000000000002`, {
      headers: { 'Authorization': 'Bearer user-token' }
    });
    assert.strictEqual(res.status, 403); // Forbidden
  });

  // =========================================================================
  // 4. Report Exports
  // =========================================================================

  test('POST /reports/generate - enqueues a compliance generation job', async () => {
    const res = await fetch(`${BASE_URL}/reports/generate`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer admin-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reportType: 'COMPLETE',
        format: 'PDF',
        filters: {}
      })
    });
    assert.strictEqual(res.status, 202); // Accepted
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data.reportId);
  });
});
