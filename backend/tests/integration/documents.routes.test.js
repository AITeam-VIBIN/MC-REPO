import test from 'node:test';
import assert from 'node:assert';
import app from '../../src/app.js';
import { prisma } from '../../src/config/database.js';
import { cleanupDb } from '../helpers/db.js';
import { setupStorageMock, restoreStorageMock } from '../mocks/storage.mock.js';
import { supabaseAnon } from '../../src/config/supabase.js';
import { mockDepartment, mockRegularUser, mockAdminUser, mockFolder, mockVault } from '../fixtures/documents.fixture.js';

let server;
const PORT = 5001;
const BASE_URL = `http://localhost:${PORT}/api/v1/documents`;

test.describe('Document API Integration Tests', () => {
  test.before(async () => {
    setupStorageMock();
    
    // Start local express server instance
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

    // Create lookup values
    await prisma.department.create({ data: mockDepartment });
    await prisma.user.create({ data: mockRegularUser });
    await prisma.user.create({ data: mockAdminUser });
    await prisma.vault.create({ data: mockVault });
    await prisma.folder.create({ data: mockFolder });

    const sessionExpiry = new Date(Date.now() + 24 * 3600 * 1000);

    // Seed session token entries in database to satisfy session authorization checks
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
  });

  test('POST /documents/upload - uploads file and registers document metadata', async () => {
    const boundary = '----WebKitFormBoundaryMCLEDGER';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="report.pdf"',
      'Content-Type: application/pdf',
      '',
      'mock report file binary content data',
      `--${boundary}`,
      'Content-Disposition: form-data; name="name"',
      '',
      'finance_report.pdf',
      `--${boundary}`,
      'Content-Disposition: form-data; name="folderId"',
      '',
      mockFolder.id,
      `--${boundary}`,
      'Content-Disposition: form-data; name="vaultId"',
      '',
      mockVault.id,
      `--${boundary}--`,
      ''
    ].join('\r\n');

    const res = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer user-token',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    const json = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data[0].name, 'finance_report.pdf');
  });

  test('GET /documents/ - lists documents for user', async () => {
    // Seed target document
    await prisma.document.create({
      data: {
        id: 'da000000-0000-0000-0000-000000000020',
        name: 'report.pdf',
        folderId: mockFolder.id,
        vaultId: mockVault.id,
        departmentId: mockDepartment.id,
        ownerId: mockRegularUser.id,
        storageBucket: 'documents',
        storagePath: 'path/1',
        mimeType: 'application/pdf',
        fileSize: 120n,
      },
    });

    const res = await fetch(BASE_URL, {
      headers: { 'Authorization': 'Bearer user-token' },
    });

    const json = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.ok(json.data.length > 0);
  });

  test('GET /documents/:id - retrieves details', async () => {
    await prisma.document.create({
      data: {
        id: 'da000000-0000-0000-0000-000000000021',
        name: 'detail.pdf',
        folderId: mockFolder.id,
        vaultId: mockVault.id,
        departmentId: mockDepartment.id,
        ownerId: mockRegularUser.id,
        storageBucket: 'documents',
        storagePath: 'path/detail',
        mimeType: 'application/pdf',
        fileSize: 120n,
      },
    });

    const res = await fetch(`${BASE_URL}/da000000-0000-0000-0000-000000000021`, {
      headers: { 'Authorization': 'Bearer user-token' },
    });

    const json = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.data.name, 'detail.pdf');
  });

  test('PATCH /documents/:id/extend-expiry - updates date and shifts status', async () => {
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 10);

    await prisma.document.create({
      data: {
        id: 'da000000-0000-0000-0000-000000000022',
        name: 'expired.pdf',
        folderId: mockFolder.id,
        vaultId: mockVault.id,
        departmentId: mockDepartment.id,
        ownerId: mockRegularUser.id,
        storageBucket: 'documents',
        storagePath: 'path/expiry',
        mimeType: 'application/pdf',
        fileSize: 120n,
        status: 'EXPIRED',
        expiryDate: expiredDate,
      },
    });

    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 45);

    const res = await fetch(`${BASE_URL}/da000000-0000-0000-0000-000000000022/extend-expiry`, {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer user-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiryDate: newExpiry }),
    });

    const json = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.currentStatus, 'ACTIVE');
  });

  test('GET /documents/:id/preview - returns signed url payload details', async () => {
    await prisma.document.create({
      data: {
        id: 'da000000-0000-0000-0000-000000000023',
        name: 'doc.pdf',
        folderId: mockFolder.id,
        vaultId: mockVault.id,
        departmentId: mockDepartment.id,
        ownerId: mockRegularUser.id,
        storageBucket: 'documents',
        storagePath: 'path/preview',
        mimeType: 'application/pdf',
        fileSize: 120n,
      },
    });

    const res = await fetch(`${BASE_URL}/da000000-0000-0000-0000-000000000023/preview`, {
      headers: { 'Authorization': 'Bearer user-token' },
    });

    const json = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(json.data.previewType, 'PDF');
    assert.ok(json.data.temporaryAccessUrl.includes('mock-signed-token'));
  });

  test('GET /documents/:id/download - retrieves download link details', async () => {
    await prisma.document.create({
      data: {
        id: 'da000000-0000-0000-0000-000000000024',
        name: 'doc.pdf',
        folderId: mockFolder.id,
        vaultId: mockVault.id,
        departmentId: mockDepartment.id,
        ownerId: mockRegularUser.id,
        storageBucket: 'documents',
        storagePath: 'path/download',
        mimeType: 'application/pdf',
        fileSize: 120n,
      },
    });

    const res = await fetch(`${BASE_URL}/da000000-0000-0000-0000-000000000024/download`, {
      headers: { 'Authorization': 'Bearer user-token' },
    });

    const json = await res.json();
    assert.strictEqual(res.status, 200);
    assert.ok(json.data.temporaryAccessUrl.includes('mock-signed-token'));
  });
});
