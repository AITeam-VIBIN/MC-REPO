import crypto from 'crypto';

/**
 * Generate a unique report reference number in the format REP-YYYYMMDD-HEX.
 * 
 * @function generateReportReference
 * @returns {string} The unique reference number
 */
export function generateReportReference() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `REP-${dateStr}-${randomHex}`;
}

/**
 * Validates report type.
 * 
 * @function isValidReportType
 * @param {string} type - Report Type string
 * @returns {boolean} True if valid
 */
export function isValidReportType(type) {
  const validTypes = [
    'DOCUMENT_ACTIVITY',
    'CHECKOUT_REPORT',
    'RETURN_REPORT',
    'APPROVAL_REPORT',
    'SIGNATURE_REPORT',
    'AUDIT_REPORT',
    'USER_ACTIVITY',
    'SECURITY_REPORT',
    'COMPLIANCE_REPORT',
    'SYSTEM_REPORT',
  ];
  return validTypes.includes(type);
}

/**
 * Validates report format.
 * 
 * @function isValidReportFormat
 * @param {string} format - Format string
 * @returns {boolean} True if valid
 */
export function isValidReportFormat(format) {
  const validFormats = ['PDF', 'EXCEL', 'CSV'];
  return validFormats.includes(String(format).toUpperCase());
}

/**
 * Normalizes filter criteria and ensures sensible defaults.
 * 
 * @function normalizeFilters
 * @param {Object} [filters={}] - Input filters
 * @returns {Object} Normalized filters
 */
export function normalizeFilters(filters = {}) {
  const normalized = {};

  if (filters.department) {
    normalized.department = String(filters.department).trim();
  }
  if (filters.startDate) {
    normalized.startDate = new Date(filters.startDate).toISOString();
  }
  if (filters.endDate) {
    normalized.endDate = new Date(filters.endDate).toISOString();
  }
  if (filters.status) {
    normalized.status = String(filters.status).toUpperCase().trim();
  }
  if (filters.classification) {
    normalized.classification = String(filters.classification).toUpperCase().trim();
  }
  if (filters.userId) {
    normalized.userId = String(filters.userId).trim();
  }
  if (filters.category) {
    normalized.category = String(filters.category).toUpperCase().trim();
  }
  if (filters.search) {
    normalized.search = String(filters.search).trim();
  }

  return normalized;
}

/**
 * Formats a report details database model for user responses.
 * 
 * @function formatReportResponse
 * @param {Object} report - Report database record
 * @returns {Object} Clean formatted report structure
 */
export function formatReportResponse(report) {
  if (!report) return null;

  return {
    id: report.id,
    refNumber: report.refNumber,
    name: report.name,
    type: report.type,
    description: report.description,
    format: report.format,
    status: report.status,
    requestedBy: report.user ? { id: report.user.id, email: report.user.email } : report.userSnapshot,
    department: report.departmentSnapshot,
    filters: report.filters || {},
    sorting: report.sorting || {},
    columns: report.columns || [],
    fileInfo: report.filePath ? {
      fileName: report.fileName,
      fileSize: report.fileSize !== null && report.fileSize !== undefined ? report.fileSize.toString() : null,
      generatedAt: report.generatedAt,
      expiryDate: report.expiryDate,
    } : null,
    metrics: {
      startedAt: report.startedAt,
      completedAt: report.completedAt,
      processingTime: report.processingTime,
      failureReason: report.failureReason,
      retryCount: report.retryCount,
    },
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    history: (report.history || []).map(h => ({
      action: h.action,
      performedBy: h.performedBy,
      timestamp: h.timestamp,
      metadata: h.metadata || {},
    })),
  };
}

export default {
  generateReportReference,
  isValidReportType,
  isValidReportFormat,
  normalizeFilters,
  formatReportResponse,
};
