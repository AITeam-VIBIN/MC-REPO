import { Router } from 'express';
import { z } from 'zod';
import AuthController from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
const authController = new AuthController();

// =========================================================================
// 1. Zod Validation Schemas
// =========================================================================

/**
 * Validation schema for User login request payloads.
 */
export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Invalid email address format.'),
    password: z.string().min(8, 'Password must be at least 8 characters long.'),
  }),
});

/**
 * Validation schema for Refreshing active session tokens.
 */
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().trim().min(1, 'Refresh token is required.'),
  }),
});

/**
 * Validation schema for Forgot Password endpoint request.
 */
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Invalid email address format.'),
  }),
});

/**
 * Validation schema for Resetting credentials/passwords.
 */
export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().trim().min(1, 'Password reset token is required.'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters long.'),
    confirmPassword: z.string().min(8, 'Confirm password must be at least 8 characters long.'),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New password and confirm password must match.',
    path: ['confirmPassword'],
  }),
});

/**
 * Validation schema for Verification of target emails.
 */
export const verifyEmailSchema = z.object({
  query: z.object({
    token: z.string().trim().min(1, 'Email verification token is required.'),
  }),
});

/**
 * Validation schema for Resending email verification links.
 */
export const resendVerificationSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Invalid email address format.'),
  }),
});


// =========================================================================
// 2. Request Validation Middleware
// =========================================================================

/**
 * Utility validation handler middleware.
 * Binds Zod parser schemas to Route request elements.
 * 
 * @param {import('zod').ZodSchema} schema - Zod compilation target schema
 * @returns {import('express').RequestHandler}
 */
const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data payload.',
        details: err.errors,
      },
    });
  }
};


// =========================================================================
// 3. Routing Map Definitions
// =========================================================================

/**
 * POST /api/v1/auth/login
 * Public login credential validation check endpoint.
 */
router.post('/login', validate(loginSchema), authController.login);

/**
 * POST /api/v1/auth/logout
 * Terminates active login session tokens.
 */
router.post('/logout', authController.logout);

/**
 * POST /api/v1/auth/refresh
 * Refreshes short-lived Access Tokens using valid Refresh Tokens.
 */
router.post('/refresh', validate(refreshTokenSchema), authController.refreshToken);

/**
 * POST /api/v1/auth/forgot-password
 * Triggers dispatch of credential reset codes or links.
 */
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);

/**
 * POST /api/v1/auth/reset-password
 * Applies passcode changes with confirmation verification tokens.
 */
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

/**
 * GET /api/v1/auth/verify-email
 * Validates target email addresses with verification tokens.
 */
router.get('/verify-email', validate(verifyEmailSchema), authController.verifyEmail);

/**
 * POST /api/v1/auth/resend-verification
 * Re-sends validation email link dispatches.
 */
router.post('/resend-verification', validate(resendVerificationSchema), authController.resendVerification);

/**
 * GET /api/v1/auth/me
 * Retrieves current active user profile information (Requires Auth).
 */
router.get('/me', requireAuth, authController.getCurrentUser);

export default router;
