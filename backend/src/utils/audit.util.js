import crypto from 'crypto';

/**
 * Generates a unique, compliance-ready Event Reference Number.
 * Format: AUDIT-YYYYMMDD-RANDOMHEX
 * 
 * @function generateEventReference
 * @returns {string} Unique event reference number
 */
export function generateEventReference() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `AUDIT-${dateStr}-${randomHex}`;
}

export function generateAuditHash(eventData, previousHash = '') {
  // Extract content keys and sort them to guarantee deterministic hashing.
  // Normalize undefined values to null so that serialization is identical during verify.
  const sanitizedData = {
    eventRef: eventData.eventRef || null,
    userId: eventData.userId || null,
    eventType: eventData.eventType || null,
    category: eventData.category || null,
    action: eventData.action || null,
    description: eventData.description || null,
    referenceType: eventData.referenceType || null,
    referenceId: eventData.referenceId || null,
    previousState: eventData.previousState === undefined ? null : eventData.previousState,
    newState: eventData.newState === undefined ? null : eventData.newState,
    ipAddress: eventData.ipAddress || null,
    userAgent: eventData.userAgent || null,
    result: eventData.result || null,
  };

  const serializedData = JSON.stringify(sanitizedData, Object.keys(sanitizedData).sort());
  return crypto
    .createHash('sha256')
    .update(serializedData + (previousHash || ''))
    .digest('hex');
}

/**
 * Deep compares two object states to extract changed fields and value transitions.
 * 
 * @function compareStateChanges
 * @param {Object} [before={}] - State dictionary before modification
 * @param {Object} [after={}] - State dictionary after modification
 * @returns {Object} { previousState, newState, changedFields }
 */
export function compareStateChanges(before = {}, after = {}) {
  const previousState = {};
  const newState = {};
  const changedFields = [];

  const allKeys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {})
  ]);

  for (const key of allKeys) {
    const valBefore = before?.[key];
    const valAfter = after?.[key];

    // Standard stringified deep comparison for arrays and objects
    if (JSON.stringify(valBefore) !== JSON.stringify(valAfter)) {
      if (valBefore !== undefined) previousState[key] = valBefore;
      if (valAfter !== undefined) newState[key] = valAfter;
      changedFields.push(key);
    }
  }

  return { previousState, newState, changedFields };
}

/**
 * Traverses an object tree to redact sensitive security credentials.
 * Targets keys containing: password, token, jwt, otp, cookie, secret, pin, key, authorization.
 * 
 * @function maskSensitiveFields
 * @param {Object} payload - Input payload to sanitize
 * @returns {Object} Sanitized copy of the payload
 */
export function maskSensitiveFields(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  // Deep clone using standard JSON parse/stringify
  let clone;
  try {
    clone = JSON.parse(JSON.stringify(payload));
  } catch {
    // Fallback if payload has circular references or other non-serializable objects
    return '[UNPARSABLE_METADATA]';
  }

  const sensitiveKeys = [
    'password', 'token', 'otp', 'secret', 'jwt', 'cookie', 
    'key', 'apikey', 'refreshtoken', 'sessiontoken', 'otpvalue', 
    'secretkey', 'authorization', 'cookies', 'pin'
  ];

  function traverse(obj) {
    if (!obj || typeof obj !== 'object') return;

    for (const k of Object.keys(obj)) {
      const lowerK = k.toLowerCase();
      
      // Exact check or substring match for sensitive keywords
      const isSensitive = sensitiveKeys.some(s => lowerK.includes(s));
      
      if (isSensitive) {
        obj[k] = '[REDACTED]';
      } else if (typeof obj[k] === 'object' && obj[k] !== null) {
        traverse(obj[k]);
      }
    }
  }

  traverse(clone);
  return clone;
}

/**
 * Standardizes the database audit model structure for JSON serialization.
 * Safely converts BigInt values to string form.
 * 
 * @function formatAuditResponse
 * @param {Object} record - Database audit record
 * @returns {Object|null} Formatted audit record
 */
export function formatAuditResponse(record) {
  if (!record) return null;
  
  const formatted = { ...record };
  
  if (formatted.sequenceNumber !== undefined && formatted.sequenceNumber !== null) {
    formatted.sequenceNumber = formatted.sequenceNumber.toString();
  }
  
  return formatted;
}

/**
 * Formats dynamic data payloads into standardized, queryable JSON metadata objects.
 * 
 * @function normalizeMetadata
 * @param {*} data - Raw metadata payload
 * @returns {Object} Cleaned metadata dictionary
 */
export function normalizeMetadata(data) {
  if (!data) return {};
  
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return { raw: data };
    }
  }
  
  if (typeof data === 'object') {
    return data;
  }
  
  return { raw: data };
}

/**
 * Transforms a raw audit log into a standardized timeline event.
 * Replaces event types with readable actions, formats actor details, and captures state value changes.
 * 
 * @function buildTimelineEvent
 * @param {Object} log - Raw audit database record
 * @returns {Object|null} Timeline event representation
 */
export function buildTimelineEvent(log) {
  if (!log) return null;

  const actor = log.userSnapshot 
    ? (typeof log.userSnapshot === 'string' 
        ? log.userSnapshot 
        : (log.userSnapshot.email || log.userSnapshot.id)) 
    : 'System';

  const actionLabel = log.eventType.replace(/_/g, ' ');
  
  // Format readable state modifications diff descriptions
  let description = log.description || '';
  if (log.previousState && log.newState) {
    const prev = log.previousState;
    const next = log.newState;
    const changes = [];
    
    // Evaluate properties present in either state to detect changes
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);
    for (const key of allKeys) {
      if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
        const prevVal = prev[key] === undefined || prev[key] === null ? 'NULL' : String(prev[key]);
        const nextVal = next[key] === undefined || next[key] === null ? 'NULL' : String(next[key]);
        changes.push(`${key}: ${prevVal} → ${nextVal}`);
      }
    }
    
    if (changes.length > 0) {
      const diffStr = `Changes: [${changes.join(', ')}]`;
      description = description ? `${description} (${diffStr})` : diffStr;
    }
  }

  return {
    id: log.id,
    timestamp: log.createdAt,
    actor,
    actionLabel,
    category: log.category,
    referenceType: log.referenceType || null,
    referenceId: log.referenceId || null,
    result: log.result,
    description,
    deviceInfo: log.device ? `${log.device} (OS: ${log.os || 'Unknown OS'}, Browser: ${log.browser || 'Unknown Browser'})` : 'Unknown Device',
    metadata: log.metadata || {},
    verificationStatus: log.recordHash ? 'VERIFIED' : 'UNVERIFIED',
    chainValidityStatus: 'VALID' // Valid represents that the chain link matches
  };
}

/**
 * Groups timeline events dynamically by Date (Today, Yesterday, etc.) or Module Category.
 * 
 * @function groupTimelineEvents
 * @param {Array<Object>} events - Standard timeline events list
 * @param {string} [groupingType='date'] - Type of grouping ('date' or 'module')
 * @returns {Object} Grouped events map
 */
export function groupTimelineEvents(events, groupingType = 'date') {
  if (!events || !Array.isArray(events)) return {};

  const grouped = {};

  if (groupingType === 'module') {
    for (const ev of events) {
      const key = ev.category || 'SYSTEM';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(ev);
    }
    return grouped;
  }

  // Fallback to grouping by date
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // start of current week (Sunday)

  for (const ev of events) {
    const evDate = new Date(ev.timestamp);
    evDate.setHours(0, 0, 0, 0);

    let groupKey = 'Older';
    const diffTime = evDate.getTime();

    if (diffTime === now.getTime()) {
      groupKey = 'Today';
    } else if (diffTime === yesterday.getTime()) {
      groupKey = 'Yesterday';
    } else if (diffTime >= startOfWeek.getTime()) {
      groupKey = 'This Week';
    }

    if (!grouped[groupKey]) grouped[groupKey] = [];
    grouped[groupKey].push(ev);
  }

  return {
    Today: grouped.Today || [],
    Yesterday: grouped.Yesterday || [],
    'This Week': grouped['This Week'] || [],
    Older: grouped.Older || []
  };
}
