import test from 'node:test';
import assert from 'node:assert';
import { createServer } from 'http';
import { io as ioClient } from 'socket.io-client';
import app from '../../src/app.js';
import { initSocketServer, getIO } from '../../src/config/socket.js';
import { notificationService } from '../../src/services/notification.service.js';
import { prisma } from '../../src/config/database.js';
import { cleanupDb } from '../helpers/db.js';
import { supabaseAnon } from '../../src/config/supabase.js';
import { mockDepartment, mockRegularUser, mockAdminUser } from '../fixtures/documents.fixture.js';

let server;
let ioServer;
const PORT = 5006;
const SOCKET_URL = `http://localhost:${PORT}`;

test.describe('Socket.IO Real-Time Integration Tests', { concurrency: 1 }, () => {
  test.before(async () => {
    // Spin up HTTP server wrapped with Socket.IO
    server = createServer(app);
    ioServer = initSocketServer(server);
    server.listen(PORT);

    // Mock Supabase getUser call
    supabaseAnon.auth.getUser = async (token) => {
      if (token === 'admin-token') {
        return { data: { user: { id: mockAdminUser.id, email: mockAdminUser.email } }, error: null };
      }
      if (token === 'user-token') {
        return { data: { user: { id: mockRegularUser.id, email: mockRegularUser.email } }, error: null };
      }
      return { data: { user: null }, error: new Error('Invalid token') };
    };
  });

  test.after(async () => {
    if (ioServer) ioServer.close();
    server.close();
    await cleanupDb();
    await prisma.$disconnect();
  });

  test.beforeEach(async () => {
    await cleanupDb();
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Create seed relations
    await prisma.department.create({ data: mockDepartment });
    await new Promise((resolve) => setTimeout(resolve, 150));

    await prisma.user.create({ data: mockRegularUser });
    await new Promise((resolve) => setTimeout(resolve, 150));

    await prisma.user.create({ data: mockAdminUser });
    await new Promise((resolve) => setTimeout(resolve, 150));

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
    await new Promise((resolve) => setTimeout(resolve, 150));

    await prisma.session.create({
      data: {
        id: 'da000000-0000-0000-0000-000000000051',
        userId: mockAdminUser.id,
        token: 'admin-token',
        expiresAt: sessionExpiry,
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Reset user preferences
    await notificationService.getUserPreferences(mockRegularUser.id);
    await new Promise((resolve) => setTimeout(resolve, 150));
  });

  test('client connects with valid JWT, joins private room, and receives real-time notification', async () => {
    // 1. Connect client socket
    const clientSocket = ioClient(SOCKET_URL, {
      auth: { token: 'user-token' },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      clientSocket.on('connect', resolve);
      clientSocket.on('connect_error', reject);
    });

    assert.strictEqual(clientSocket.connected, true);

    // 2. Setup incoming event listener on client
    const eventsReceived = [];
    clientSocket.on('notification:new', (data) => {
      eventsReceived.push(data);
    });

    // 3. Create a notification in background (which triggers realtime.service sendToUser)
    const notif = await notificationService.createNotification({
      userId: mockRegularUser.id,
      category: 'DOCUMENT',
      eventType: 'DOCUMENT_UPLOADED',
      context: { documentName: 'BudgetDraft.xlsx', userName: 'Alice' },
    });

    // 4. Poll client events list until the notification event is received, up to 5 seconds
    for (let i = 0; i < 20; i++) {
      if (eventsReceived.length > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    // Assert that client received the real-time payload
    assert.strictEqual(eventsReceived.length, 1);
    assert.strictEqual(eventsReceived[0].refNumber, notif.refNumber);
    assert.strictEqual(eventsReceived[0].title, 'Document Uploaded Successfully');

    // Clean up socket
    clientSocket.close();
  });

  test('client connection is rejected if token is missing or invalid', async () => {
    const invalidSocket = ioClient(SOCKET_URL, {
      auth: { token: 'invalid-token' },
      transports: ['websocket'],
      reconnection: false,
    });

    await new Promise((resolve) => {
      invalidSocket.on('connect_error', (err) => {
        assert.ok(err.message.includes('Authentication error'));
        resolve();
      });
    });

    assert.strictEqual(invalidSocket.connected, false);
    invalidSocket.close();
  });
});
