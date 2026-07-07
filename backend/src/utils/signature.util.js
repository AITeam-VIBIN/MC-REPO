import crypto from 'crypto';
import { logger } from '../config/logger.js';

export const SIGNATURE_TRANSITIONS = {
  CREATED: ['PENDING_VERIFICATION', 'VERIFIED', 'FAILED', 'REVOKED'],
  PENDING_VERIFICATION: ['VERIFIED', 'FAILED', 'REVOKED'],
  VERIFIED: ['REVOKED'],
  FAILED: ['PENDING_VERIFICATION', 'REVOKED'],
  REVOKED: []
};

/**
 * Validates state transitions.
 */
export function isValidSignatureTransition(current, target) {
  const allowed = SIGNATURE_TRANSITIONS[current];
  if (!allowed) return false;
  return allowed.includes(target);
}

/**
 * Generates reference number.
 */
export function generateSignatureReferenceNumber(prefix = 'SIG') {
  const timestamp = Date.now();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Computes tamper-proof SHA-256 signature hash.
 * Generate tamper detection hash using: User ID, Reference Type, Reference ID, File Checksum, Timestamp
 */
export function generateSignatureHash(userId, referenceType, referenceId, checksum, timestamp) {
  const rawData = `${userId}:${referenceType}:${referenceId}:${checksum}:${new Date(timestamp).getTime()}`;
  return crypto.createHash('sha256').update(rawData).digest('hex');
}

/**
 * Computes verification validation hash.
 * Generate verification hash using: Signature ID, User ID, Reference Type, Reference ID, Original Checksum, Created Timestamp
 */
export function generateVerificationHash(signatureId, userId, referenceType, referenceId, checksum, timestamp) {
  const rawData = `${signatureId}:${userId}:${referenceType}:${referenceId}:${checksum}:${new Date(timestamp).getTime()}`;
  return crypto.createHash('sha256').update(rawData).digest('hex');
}

/**
 * Computes transaction binding hash.
 * Generate hash using: Signature ID, User ID, Reference Type, Reference ID, Transaction Snapshot, Timestamp
 */
export function generateBindingHash(signatureId, userId, referenceType, referenceId, snapshot, timestamp) {
  const snapshotStr = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot);
  const rawData = `${signatureId}:${userId}:${referenceType}:${referenceId}:${snapshotStr}:${new Date(timestamp).getTime()}`;
  return crypto.createHash('sha256').update(rawData).digest('hex');
}

/**
 * Compares two hashes using timing-safe buffer comparison.
 */
export function compareHashesSecurely(hashA, hashB) {
  if (!hashA || !hashB) return false;
  try {
    const bufferA = Buffer.from(hashA, 'hex');
    const bufferB = Buffer.from(hashB, 'hex');
    if (bufferA.length !== bufferB.length) return false;
    return crypto.timingSafeEqual(bufferA, bufferB);
  } catch (err) {
    return false;
  }
}

/**
 * Path builder structure:
 * signatures/user-id/year/month/reference-type/reference-id/signature-id/signature.ext
 */
export function generateSignatureStoragePath(userId, referenceType, referenceId, signatureId, filename) {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  let extension = 'png';
  if (filename) {
    const parts = filename.split('.');
    if (parts.length > 1) {
      extension = parts.pop().toLowerCase();
    }
  }
  
  return `signatures/${userId}/${year}/${month}/${referenceType}/${referenceId}/${signatureId}/signature.${extension}`;
}

export async function signatureCreated(signature) {
  logger.info({ signatureId: signature.id }, '[Digital Signature Hook] Signature created.');
}

export async function signatureVerified(signature) {
  logger.info({ signatureId: signature.id }, '[Digital Signature Hook] Signature verified.');
}

export async function signatureRejected(signature) {
  logger.info({ signatureId: signature.id }, '[Digital Signature Hook] Signature verification rejected.');
}

export async function signatureRevoked(signature) {
  logger.info({ signatureId: signature.id }, '[Digital Signature Hook] Signature revoked.');
}

export async function signatureStored(signature) {
  logger.info({ signatureId: signature.id }, '[Digital Signature Hook] Signature stored.');
}

export async function signatureAccessed(signature) {
  logger.info({ signatureId: signature.id }, '[Digital Signature Hook] Signature accessed.');
}

export async function signatureFileGenerated(signature) {
  logger.info({ signatureId: signature.id }, '[Digital Signature Hook] Signature file generated.');
}

export async function signatureBound(signature) {
  logger.info({ signatureId: signature.id }, '[Digital Signature Hook] Signature bound to transaction.');
}

export async function bindingVerified(signature) {
  logger.info({ signatureId: signature.id }, '[Digital Signature Hook] Binding verified.');
}

export async function bindingFailed(signature) {
  logger.warn({ signatureId: signature.id }, '[Digital Signature Hook] Binding verification failed.');
}
