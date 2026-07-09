import { supabaseAnon } from '../config/supabase.js';
import { SessionRepository } from '../repositories/security.repository.js';

/**
 * Resolves user role from database.
 */
async function prismaSelectUserRole(userId) {
  try {
    const { prisma } = await import('../config/database.js');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role || 'VIEWER';
  } catch {
    return 'VIEWER';
  }
}

/**
 * Intercepts Socket.IO handshake request to perform JWT token authentication and session verification.
 * 
 * @function socketAuthMiddleware
 * @param {import('socket.io').Socket} socket - Socket instance
 * @param {function} next - Callback function
 */
export async function socketAuthMiddleware(socket, next) {
  try {
    // Attempt to extract token from various handshake positions
    let token = socket.handshake.auth?.token || socket.handshake.query?.token;
    
    if (!token && socket.handshake.headers?.authorization) {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else {
        token = authHeader;
      }
    }

    if (!token) {
      return next(new Error('Authentication error: Token missing.'));
    }

    // Authenticate JWT directly against Supabase Identity provider
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);

    if (error || !user) {
      return next(new Error('Authentication error: Invalid or expired token.'));
    }

    // Verify session state in local DB
    const sessionRepo = new SessionRepository();
    const activeSessions = await sessionRepo.listSessionsByUserId(user.id);

    if (!activeSessions || activeSessions.length === 0) {
      return next(new Error('Authentication error: Session revoked.'));
    }

    // Sync database-backed role context onto user object
    const role = await prismaSelectUserRole(user.id);

    // Fetch user department snapshot info
    let departmentId = null;
    try {
      const { prisma } = await import('../config/database.js');
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { departmentId: true },
      });
      departmentId = dbUser?.departmentId || null;
    } catch (dbErr) {
      console.warn(`[SocketAuth] Failed to load department info for ${user.id}:`, dbErr.message);
    }

    // Bind authentication context to socket session
    socket.user = {
      id: user.id,
      email: user.email,
      role,
      departmentId,
    };

    next();
  } catch (err) {
    console.error('[SocketAuth] Handshake error:', err);
    next(new Error('Authentication error: Internal validation failure.'));
  }
}

export default socketAuthMiddleware;
