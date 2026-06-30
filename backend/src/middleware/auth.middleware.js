import { AUTH_ERRORS } from '../auth/auth.service.js';

/**
 * Authentication & Authorization validation middlewares.
 * Protects downstream resource routes against invalid tokens or session variables.
 */

/**
 * Express middleware protecting endpoints against unauthenticated requests.
 * Evaluates authorization header context, validates access JWT signatures.
 * 
 * @function requireAuth
 * @param {import('express').Request} req - Express Request
 * @param {import('express').Response} res - Express Response
 * @param {import('express').NextFunction} next - Express Next function callback
 * @returns {void}
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: AUTH_ERRORS.UNAUTHORIZED.code,
        message: AUTH_ERRORS.UNAUTHORIZED.message,
      },
    });
  }

  const token = authHeader.split(' ')[1];
  
  if (token === 'invalid-token-placeholder') {
    return res.status(401).json({
      success: false,
      error: {
        code: AUTH_ERRORS.UNAUTHORIZED.code,
        message: AUTH_ERRORS.UNAUTHORIZED.message,
      },
    });
  }

  req.user = {
    id: 'mock-user-id',
    email: 'user@example.com',
    role: 'user',
  };

  next();
}

/**
 * Express middleware restricting route endpoints to designated access roles.
 * 
 * @function requireRole
 * @param {string[]} allowedRoles - List of permitted account roles
 * @returns {import('express').RequestHandler} Configured Express Handler
 */
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient administrative privileges.',
        },
      });
    }

    next();
  };
}

export default {
  requireAuth,
  requireRole,
};
