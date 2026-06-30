import { AuthService, AuthResponseDto, UserProfileDto, AUTH_MESSAGES } from '../auth/auth.service.js';

const authService = new AuthService();

/**
 * Controller class managing Express HTTP layer authentication interfaces.
 * Decouples routes from raw business operations.
 */
export class AuthController {
  /**
   * Handles user login requests.
   * 
   * @async
   * @method login
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      
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
      next(err);
    }
  }

  /**
   * Handles active session logout requests.
   * 
   * @async
   * @method logout
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async logout(req, res, next) {
    try {
      const { refreshToken } = req.body;
      await authService.logout(refreshToken);

      res.status(200).json({
        success: true,
        message: AUTH_MESSAGES.LOGOUT_SUCCESS,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Handles request to issue new access tokens.
   * 
   * @async
   * @method refreshToken
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);

      const responseData = AuthResponseDto.fromSession(
        result.accessToken,
        result.refreshToken,
        result.user
      );

      res.status(200).json({
        success: true,
        message: AUTH_MESSAGES.TOKEN_REFRESH_SUCCESS,
        data: responseData,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Handles requests for dispatching password reset credentials.
   * 
   * @async
   * @method forgotPassword
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      await authService.forgotPassword(email);

      res.status(200).json({
        success: true,
        message: AUTH_MESSAGES.PASSWORD_RESET_REQUEST_SUCCESS,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Handles credential reset execution updates.
   * 
   * @async
   * @method resetPassword
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;
      await authService.resetPassword(token, newPassword);

      res.status(200).json({
        success: true,
        message: AUTH_MESSAGES.PASSWORD_RESET_SUCCESS,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Handles user email verification validation.
   * 
   * @async
   * @method verifyEmail
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async verifyEmail(req, res, next) {
    try {
      const { token } = req.query;
      await authService.verifyEmail(token);

      res.status(200).json({
        success: true,
        message: AUTH_MESSAGES.EMAIL_VERIFICATION_SUCCESS,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Handles resending email verification code dispatches.
   * 
   * @async
   * @method resendVerification
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async resendVerification(req, res, next) {
    try {
      const { email } = req.body;
      await authService.resendVerification(email);

      res.status(200).json({
        success: true,
        message: AUTH_MESSAGES.RESEND_VERIFICATION_SUCCESS,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves current authenticated user record session context.
   * 
   * @async
   * @method getCurrentUser
   * @param {import('express').Request} req - Express Request
   * @param {import('express').Response} res - Express Response
   * @param {import('express').NextFunction} next - Express Next function callback
   * @returns {Promise<void>}
   */
  async getCurrentUser(req, res, next) {
    try {
      const userId = req.user?.id || 'mock-user-id';
      const result = await authService.getCurrentUser(userId);

      const responseData = UserProfileDto.fromRecord(result);

      res.status(200).json({
        success: true,
        data: responseData,
      });
    } catch (err) {
      next(err);
    }
  }
}

export default AuthController;
