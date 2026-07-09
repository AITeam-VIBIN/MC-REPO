import { supabaseAnon } from '../config/supabase.js';
import { SessionRepository } from '../repositories/security.repository.js';
import { PermissionResolutionService, AUTHORIZATION_ERRORS } from '../services/security.service.js';
import { parseTokenHeader } from '../auth/auth.routes.js';
import logUtil from '../utils/logger.util.js';

const permissionResolutionService = new PermissionResolutionService();

/**
 * Express middleware protecting endpoints against unauthenticated requests.
 * Evaluates the Authorization header and secure HTTP-Only cookies.
 * 
 * @async
 * @function requireAuth
 * @param {import('express').Request} req - Express Request
 * @param {import('express').Response} res - Express Response
 * @param {import('express').NextFunction} next - Express Next function callback
 * @returns {Promise<void>}
 */
export async function requireAuth(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader) {
      token = parseTokenHeader(authHeader);
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: AUTHORIZATION_ERRORS.UNAUTHORIZED.code,
          message: AUTHORIZATION_ERRORS.UNAUTHORIZED.message,
        },
      });
    }

    // Verify token structure (relaxed in test mode for mock tokens)
    if (process.env.NODE_ENV !== 'test') {
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        logUtil.warn('Rejected malformed JWT token structure attempt.', { ip: req.ip });
        return res.status(401).json({
          success: false,
          error: {
            code: AUTHORIZATION_ERRORS.UNAUTHORIZED.code,
            message: 'Invalid token structure.',
          },
        });
      }
    }

    // Authenticate JWT directly against Supabase Identity provider
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);

    if (error || !user) {
      logUtil.warn('Supabase JWT authentication failed.', { error: error?.message, ip: req.ip });
      return res.status(401).json({
        success: false,
        error: {
          code: AUTHORIZATION_ERRORS.UNAUTHORIZED.code,
          message: error?.message || AUTHORIZATION_ERRORS.UNAUTHORIZED.message,
        },
      });
    }

    // Sync database-backed role context onto user object
    const role = await prismaSelectUserRole(user.id);

    req.user = {
      id: user.id,
      email: user.email,
      role: role,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Express middleware protecting endpoints against revoked session tokens.
 * Verifies that the user has at least one active, non-revoked session in local DB.
 * 
 * @async
 * @function requireSession
 * @param {import('express').Request} req - Express Request
 * @param {import('express').Response} res - Express Response
 * @param {import('express').NextFunction} next - Express Next function callback
 * @returns {Promise<void>}
 */
export async function requireSession(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: AUTHORIZATION_ERRORS.UNAUTHORIZED.code,
          message: AUTHORIZATION_ERRORS.UNAUTHORIZED.message,
        },
      });
    }

    const sessionRepo = new SessionRepository();
    const activeSessions = await sessionRepo.listSessionsByUserId(userId);

    if (!activeSessions || activeSessions.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: AUTHORIZATION_ERRORS.SESSION_REVOKED.code,
          message: AUTHORIZATION_ERRORS.SESSION_REVOKED.message,
        },
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Express middleware restricting route endpoints to designated access roles.
 * Features customizable Super Admin (ADMIN) authorization bypass.
 * 
 * @function requireRole
 * @param {string[]} allowedRoles - List of permitted account roles
 * @returns {import('express').RequestHandler} Configured Express Handler
 */
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user?.role;

    // Configurable Super Admin role bypass
    if (userRole === 'ADMIN') {
      return next();
    }

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: {
          code: AUTHORIZATION_ERRORS.FORBIDDEN_ROLE.code,
          message: AUTHORIZATION_ERRORS.FORBIDDEN_ROLE.message,
        },
      });
    }

    next();
  };
}

/**
 * Express middleware restricting routes to matching permission specifications.
 * Automatically processes Super Admin wildcard overrides.
 * 
 * @function requirePermission
 * @param {string} requiredPermission - Required permission key
 * @returns {import('express').RequestHandler} Configured Express Handler
 */
export function requirePermission(requiredPermission) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: AUTHORIZATION_ERRORS.UNAUTHORIZED.code,
            message: AUTHORIZATION_ERRORS.UNAUTHORIZED.message,
          },
        });
      }

      const isPermitted = await permissionResolutionService.hasPermission(userId, requiredPermission);

      if (!isPermitted) {
        return res.status(403).json({
          success: false,
          error: {
            code: AUTHORIZATION_ERRORS.FORBIDDEN_PERMISSION.code,
            message: AUTHORIZATION_ERRORS.FORBIDDEN_PERMISSION.message,
          },
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Dynamic internal helper resolving database-backed user role.
 * Safe fallback to default VIEWER role.
 * 
 * @async
 * @private
 * @param {string} userId - User UUID
 * @returns {Promise<string>} User role
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

export default {
  requireAuth,
  requireSession,
  requireRole,
  requirePermission,
};
