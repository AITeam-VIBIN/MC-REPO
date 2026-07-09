import { DeviceResponseDto, ActivityResponseDto, SessionResponseDto, PermissionResponseDto } from '../services/security.service.js';
import { RoleResponseDto } from '../roles/roles.service.js';
import bcrypt from 'bcrypt';
import logUtil from './logger.util.js';
import { prisma } from '../config/database.js';

/**
 * Mapper utility to transform raw user session records into sanitized DeviceResponseDto objects.
 * 
 * @function deviceMapper
 * @param {Object} rawSessionRecord - Database session model
 * @returns {DeviceResponseDto} Sanitized DeviceResponseDto
 */
export function deviceMapper(rawSessionRecord) {
  return DeviceResponseDto.fromRecord(rawSessionRecord);
}

/**
 * Mapper utility to transform raw audit log records into sanitized ActivityResponseDto objects.
 * 
 * @function activityMapper
 * @param {Object} rawLogRecord - Database AuditLog model
 * @returns {ActivityResponseDto} Sanitized ActivityResponseDto
 */
export function activityMapper(rawLogRecord) {
  return ActivityResponseDto.fromRecord(rawLogRecord);
}

/**
 * Mapper utility to transform raw role database records or models into sanitized response DTOs.
 * 
 * @function roleMapper
 * @param {Object} rawRoleRecord - Database role record model
 * @returns {RoleResponseDto} Sanitized and serialized RoleResponseDto
 */
export function roleMapper(rawRoleRecord) {
  return RoleResponseDto.fromRecord(rawRoleRecord);
}

/**
 * Utility parser for client User-Agents.
 * Extracts browser names, OS platforms, and device types.
 * 
 * @function parseUserAgent
 * @param {string} userAgentString - Request user-agent header
 * @returns {{browser: string, os: string, device: string}} Parsed metadata
 */
export function parseUserAgent(userAgentString) {
  if (!userAgentString) {
    return { browser: 'Unknown Browser', os: 'Unknown OS', device: 'Desktop' };
  }

  let browser = 'Unknown Browser';
  let os = 'Unknown OS';
  let device = 'Desktop';

  // Browser detection
  if (userAgentString.includes('Firefox')) {
    browser = 'Mozilla Firefox';
  } else if (userAgentString.includes('Chrome') && !userAgentString.includes('Chromium')) {
    browser = 'Google Chrome';
  } else if (userAgentString.includes('Safari') && !userAgentString.includes('Chrome')) {
    browser = 'Apple Safari';
  } else if (userAgentString.includes('Edge')) {
    browser = 'Microsoft Edge';
  }

  // OS detection
  if (userAgentString.includes('Windows')) {
    os = 'Windows';
  } else if (userAgentString.includes('Macintosh') || userAgentString.includes('Mac OS X')) {
    os = 'macOS';
  } else if (userAgentString.includes('Linux')) {
    os = 'Linux';
  } else if (userAgentString.includes('Android')) {
    os = 'Android';
    device = 'Mobile';
  } else if (userAgentString.includes('iPhone') || userAgentString.includes('iPad')) {
    os = 'iOS';
    device = 'Mobile';
  }

  return { browser, os, device };
}

/**
 * Mapper utility to transform raw session database records into response DTOs.
 * Prevents internal token hashes or secrets from leaking to external clients.
 * 
 * @function sessionMapper
 * @param {Object} rawSession - Database session record
 * @returns {SessionResponseDto} Sanitized SessionResponseDto
 */
export function sessionMapper(rawSession) {
  return SessionResponseDto.fromRecord(rawSession);
}

/**
 * Mapper utility to transform raw permission database records or models into sanitized response DTOs.
 * 
 * @function permissionMapper
 * @param {Object} rawPermissionRecord - Database permission record model
 * @returns {PermissionResponseDto} Sanitized and serialized PermissionResponseDto
 */
export function permissionMapper(rawPermissionRecord) {
  return PermissionResponseDto.fromRecord(rawPermissionRecord);
}

/**
 * Validates password complexity strength.
 * Enforces: At least 8 characters, 1 uppercase, 1 lowercase, 1 number, and 1 special symbol.
 * 
 * @param {string} password - Raw user password
 * @returns {boolean} True if complexity satisfies criteria
 */
export function validatePasswordStrength(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return false;
  }
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  return hasUpper && hasLower && hasNumber && hasSpecial;
}

/**
 * Hashes passwords using bcrypt with strict salt cost.
 */
export async function hashPassword(password, saltRounds = 12) {
  return bcrypt.hash(password, saltRounds);
}

/**
 * Compares passwords with bcrypt hashes.
 */
export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Event hook recording detected security policy violations to standard logs & audit engines.
 */
export async function securityViolationDetected(userId, violationType, description, req = null) {
  logUtil.error(`[Security Violation] User: ${userId || 'GUEST'} | Type: ${violationType} | Desc: ${description}`, null, {
    userId,
    violationType,
    ipAddress: req?.ip,
    userAgent: req?.headers?.['user-agent'],
  });

  try {
    // Generate audit entry
    await prisma.auditLog.create({
      data: {
        eventRef: `SEC-VIO-${Date.now()}-${Math.round(Math.random() * 1000)}`,
        userId: userId || null,
        userSnapshot: userId ? 'Security Audit Alert' : 'Anonymous Guest',
        category: 'SECURITY',
        action: 'DELETE', // Map to general action category
        eventType: violationType,
        description,
        ipAddress: req?.ip || null,
        userAgent: req?.headers?.['user-agent'] || null,
        result: 'DENIED',
      },
    });
  } catch (err) {
    logUtil.error('Failed writing security violation to audit trail:', err);
  }
}

/**
 * Event hook recording suspicious activities or rapid access triggers.
 */
export async function suspiciousActivityDetected(userId, activityType, description, req = null) {
  logUtil.warn(`[Suspicious Activity] User: ${userId || 'GUEST'} | Type: ${activityType} | Desc: ${description}`, {
    userId,
    activityType,
    ipAddress: req?.ip,
    userAgent: req?.headers?.['user-agent'],
  });
}

export default {
  deviceMapper,
  activityMapper,
  roleMapper,
  parseUserAgent,
  sessionMapper,
  permissionMapper,
  validatePasswordStrength,
  hashPassword,
  comparePassword,
  securityViolationDetected,
  suspiciousActivityDetected,
};
