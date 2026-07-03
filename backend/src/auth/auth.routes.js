import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  AuthService,
  AuthResponseDto,
  UserProfileDto,
  AUTH_MESSAGES,
  MFA_MESSAGES,
  MfaEnrollResponseDto,
  MfaVerifyResponseDto,
  AUTH_CONFIG,
} from '../services/security.service.js';

const router = Router();
const authService = new AuthService();

/**
 * Maps Supabase Auth errors to standardized application HTTP errors.
 * 
 * @param {Error} err - Caught exception
 * @returns {Error} Formatted exception
 */
function mapAuthError(err) {
  const msg = err.message || '';
  if (msg.includes('invalid login credentials') || msg.includes('Invalid login credentials')) {
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
  } else if (msg.includes('Email not confirmed') || msg.includes('email not confirmed')) {
    err.statusCode = 403;
    err.code = 'EMAIL_UNVERIFIED';
  } else if (msg.includes('JWT expired') || msg.includes('expired') || err.status === 401) {
    err.statusCode = 401;
    err.code = 'UNAUTHORIZED';
  } else if (err.status === 400) {
    err.statusCode = 400;
    err.code = 'BAD_REQUEST';
  }
  return err;
}

/**
 * Securely appends authentication token cookies to express HTTP responses.
 * 
 * @function setAuthCookies
 * @param {import('express').Response} res - Express Response object
 * @param {string} accessToken - JSON Web Access Token
 * @param {string} refreshToken - Renewal Session Refresh Token
 * @returns {void}
 */
export function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie('accessToken', accessToken, {
    ...AUTH_CONFIG.COOKIE_OPTIONS,
    maxAge: 15 * 60 * 1000, // 15 Minutes
  });

  res.cookie('refreshToken', refreshToken, {
    ...AUTH_CONFIG.COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Days
  });
}

/**
 * Clears and invalidates existing authentication token cookies.
 * 
 * @function clearAuthCookies
 * @param {import('express').Response} res - Express Response object
 * @returns {void}
 */
export function clearAuthCookies(res) {
  res.clearCookie('accessToken', AUTH_CONFIG.COOKIE_OPTIONS);
  res.clearCookie('refreshToken', AUTH_CONFIG.COOKIE_OPTIONS);
}

/**
 * Validates access JWT structure or formats.
 * 
 * @function parseTokenHeader
 * @param {string} authHeader - Express Authorization HTTP Header content
 * @returns {string|null} Parsed JWT Token or null if invalid
 */
export function parseTokenHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.split(' ')[1];
}

/**
 * Controller class managing Express HTTP layer authentication interfaces.
 */
class AuthController {
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const userAgent = req.headers['user-agent'] || '';
      const ipAddress = req.ip || req.socket.remoteAddress || '';
      
      const result = await authService.login(email, password, userAgent, ipAddress);
      
      setAuthCookies(res, result.accessToken, result.refreshToken);

      const responseData = AuthResponseDto.fromSession(
        result.accessToken,
        result.refreshToken,
        result.user
      );

      res.status(200).json({
        success: true,
        message: AUTH_MESSAGES.LOGIN_SUCCESS,
        data: responseData,
      });
    } catch (err) {
      next(mapAuthError(err));
    }
  }

  async logout(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const accessToken = parseTokenHeader(authHeader);
      const { refreshToken } = req.body;

      await authService.logout({ accessToken, refreshToken });
      clearAuthCookies(res);

      res.status(200).json({
        success: true,
        message: AUTH_MESSAGES.LOGOUT_SUCCESS,
      });
    } catch (err) {
      next(mapAuthError(err));
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const userAgent = req.headers['user-agent'] || '';
      const ipAddress = req.ip || req.socket.remoteAddress || '';

      const result = await authService.refreshToken(refreshToken, userAgent, ipAddress);
      setAuthCookies(res, result.accessToken, result.refreshToken);

      const responseData = AuthResponseDto.fromSession(
        result.accessToken,
        result.refreshToken,
        result.user
      );

      res.status(200).json({
        success: true,
        message: AUTH_MESSAGES.REFRESH_SUCCESS,
        data: responseData,
      });
    } catch (err) {
      next(mapAuthError(err));
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      await authService.forgotPassword(email);

      res.status(200).json({
        success: true,
        message: AUTH_MESSAGES.FORGOT_PASSWORD_SUCCESS,
      });
    } catch (err) {
      next(mapAuthError(err));
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;
      await authService.resetPassword(token, newPassword);

      res.status(200).json({
        success: true,
        message: AUTH_MESSAGES.RESET_PASSWORD_SUCCESS,
      });
    } catch (err) {
      next(mapAuthError(err));
    }
  }

  async verifyEmail(req, res, next) {
    try {
      const { token } = req.query;
      await authService.verifyEmail(token);

      res.status(200).json({
        success: true,
        message: AUTH_MESSAGES.VERIFY_EMAIL_SUCCESS,
      });
    } catch (err) {
      next(mapAuthError(err));
    }
  }

  async resendVerification(req, res, next) {
    try {
      const { email } = req.body;
      await authService.resendVerification(email);

      res.status(200).json({
        success: true,
        message: AUTH_MESSAGES.RESEND_VERIFICATION_SUCCESS,
      });
    } catch (err) {
      next(mapAuthError(err));
    }
  }

  async getCurrentUser(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        const error = new Error('User session context missing.');
        error.statusCode = 401;
        error.code = 'UNAUTHORIZED';
        throw error;
      }
      
      const result = await authService.getCurrentUser(userId);
      const responseData = UserProfileDto.fromRecord(result);

      res.status(200).json({
        success: true,
        data: responseData,
      });
    } catch (err) {
      next(mapAuthError(err));
    }
  }

  async enrollMfa(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const accessToken = parseTokenHeader(authHeader);

      const result = await authService.enrollMfa(accessToken);
      const responseData = MfaEnrollResponseDto.fromData(result);

      res.status(200).json({
        success: true,
        message: MFA_MESSAGES.ENROLL_SUCCESS,
        data: responseData,
      });
    } catch (err) {
      next(mapAuthError(err));
    }
  }

  async verifyMfa(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const accessToken = parseTokenHeader(authHeader);
      const { factorId, code } = req.body;

      const result = await authService.verifyMfa(accessToken, factorId, code);
      const responseData = MfaVerifyResponseDto.fromData(result);

      res.status(200).json({
        success: true,
        message: MFA_MESSAGES.VERIFY_SUCCESS,
        data: responseData,
      });
    } catch (err) {
      next(mapAuthError(err));
    }
  }

  async disableMfa(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const accessToken = parseTokenHeader(authHeader);
      const { factorId } = req.body;

      await authService.disableMfa(accessToken, factorId);

      res.status(200).json({
        success: true,
        message: MFA_MESSAGES.DISABLE_SUCCESS,
      });
    } catch (err) {
      next(mapAuthError(err));
    }
  }

  async getRecoveryCodes(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const accessToken = parseTokenHeader(authHeader);

      const codes = await authService.getRecoveryCodes(accessToken);

      res.status(200).json({
        success: true,
        message: MFA_MESSAGES.RECOVERY_CODES_SUCCESS,
        data: {
          recoveryCodes: codes,
        },
      });
    } catch (err) {
      next(mapAuthError(err));
    }
  }
}

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

/**
 * Validation schema for verifying TOTP challenge.
 */
export const verifyMfaSchema = z.object({
  body: z.object({
    factorId: z.string().trim().min(1, 'Factor ID is required.'),
    code: z.string().trim().min(6, 'Verification code must be exactly 6 characters.').max(6),
  }),
});

/**
 * Validation schema for unenrolling/disabling TOTP MFA.
 */
export const disableMfaSchema = z.object({
  body: z.object({
    factorId: z.string().trim().min(1, 'Factor ID is required.'),
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

router.get('/me', requireAuth, authController.getCurrentUser);

/**
 * POST /api/v1/auth/mfa/enroll
 * Initiates TOTP MFA enrollment challenge.
 */
router.post('/mfa/enroll', requireAuth, authController.enrollMfa);

/**
 * POST /api/v1/auth/mfa/verify
 * Verifies TOTP challenge code to enable MFA.
 */
router.post('/mfa/verify', requireAuth, validate(verifyMfaSchema), authController.verifyMfa);

/**
 * POST /api/v1/auth/mfa/disable
 * Disables active TOTP MFA factor.
 */
router.post('/mfa/disable', requireAuth, validate(disableMfaSchema), authController.disableMfa);

/**
 * GET /api/v1/auth/mfa/recovery-codes
 * Retrieves secure backup recovery codes.
 */
router.get('/mfa/recovery-codes', requireAuth, authController.getRecoveryCodes);

export default router;
