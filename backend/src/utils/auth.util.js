import { AUTH_CONFIG } from '../auth/auth.service.js';

/**
 * Authentication module helper utilities.
 * Handles token generation templates, cookies configurations, and cryptographic session properties.
 */

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

export default {
  setAuthCookies,
  clearAuthCookies,
  parseTokenHeader,
};
