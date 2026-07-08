import { reportQueue } from '../jobs/index.js';
import { AuditService } from './audit.service.js';
import * as exportUtil from '../utils/export.util.js';
import { StorageService } from './storage/storage.service.js';
import { prisma } from '../config/database.js';

const auditService = new AuditService();

/**
 * Service to orchestrate Compliance Audit Trail Reports generation.
 * Coordinates BullMQ jobs enqueuing, secure PDF/Excel/CSV binary uploads, and signed download links generation.
 */
export class ReportService {
  /**
   * Request a compliance report generation.
   * Enqueues job to background BullMQ worker thread to keep API non-blocking.
   * 
   * @async
   * @method requestReport
   * @param {string} reportType - Complete, Document, User, Security, or Compliance
   * @param {string} format - PDF, Excel, or CSV
   * @param {Object} [filters={}] - Search criteria and scopes
   * @param {Object} user - Requesting actor context
   * @returns {Promise<Object>} Reference to enqueued job ID and details
   */
  async requestReport(reportType, format, filters = {}, user) {
    if (!user) {
      throw new Error('Access denied: Authentication context missing.');
    }

    // Enqueue background processing job
    const job = await reportQueue.add('generate-compliance-report', {
      reportType,
      format,
      filters,
      requestedBy: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });

    return {
      reportId: job.id,
      status: 'PENDING',
      reportType,
      format,
      requestedBy: user.email,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Retrieves status of compliance report generation.
   * 
   * @async
   * @method getReportStatus
   * @param {string} reportId - BullMQ Job Identifier
   * @returns {Promise<Object>} Status, progress, and download reference if finished
   */
  async getReportStatus(reportId) {
    // If Redis is offline/Mock queue is used, handle gracefully
    if (reportQueue.constructor.name === 'MockQueue') {
      return {
        reportId,
        status: 'COMPLETED',
        downloadUrl: null,
        message: 'Mock/Offline mode: reports are completed without physical file writes.'
      };
    }

    const job = await reportQueue.getJob(reportId);
    if (!job) {
      return {
        reportId,
        status: 'FAILED',
        error: 'Job details not found.'
      };
    }

    const state = await job.getState();
    
    if (state === 'completed') {
      const result = job.returnvalue;
      
      // Generate secure signed URL for completed private reports (15 mins window)
      let downloadUrl = null;
      if (result && result.fileRef) {
        const data = await StorageService.generateDownloadUrl('documents', result.fileRef, 900);
        downloadUrl = data.signedUrl;
      }

      return {
        reportId,
        status: 'COMPLETED',
        fileRef: result?.fileRef || null,
        downloadUrl,
        finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null
      };
    }

    if (state === 'failed') {
      return {
        reportId,
        status: 'FAILED',
        error: job.failedReason || 'An error occurred during compilation.'
      };
    }

    return {
      reportId,
      status: state.toUpperCase(),
      progress: job.progress || 0
    };
  }

  /**
   * Compiles the audit log list and stores generated binary report physically.
   * Invoked within the BullMQ worker processor block.
   * 
   * @async
   * @method generateAndStoreReportFile
   * @param {string} reportId - ID of report job
   * @param {string} reportType - COMPLETE, DOCUMENT, USER_ACTIVITY, SECURITY, COMPLIANCE
   * @param {string} format - PDF, EXCEL, CSV
   * @param {Object} filters - Filter arguments
   * @param {Object} requestedBy - Operator user snapshot
   * @returns {Promise<{fileRef: string}>} File reference key details
   */
  async generateAndStoreReportFile(reportId, reportType, format, filters, requestedBy) {
    // 1. Fetch matching logs (respecting department/user permissions)
    const { logs } = await auditService.searchAuditLogs(filters, { limit: 100000 }, requestedBy);

    // 2. Build Binary Buffer
    let buffer;
    let contentType;
    const cleanFormat = format.toUpperCase();

    if (cleanFormat === 'PDF') {
      buffer = await exportUtil.generatePDFReport(logs, reportType);
      contentType = 'application/pdf';
    } else if (cleanFormat === 'EXCEL') {
      buffer = await exportUtil.generateExcelReport(logs, reportType);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else {
      buffer = exportUtil.generateCSVReport(logs);
      contentType = 'text/csv';
    }

    // 3. Build target destination storage key
    const date = new Date();
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const filename = `audit_report_${Date.now()}.${format.toLowerCase()}`;
    const fileRef = `reports/audit/${year}/${month}/${reportId}/${filename}`;

    // 4. Upload object physically to private documents bucket
    await StorageService.uploadObject('documents', fileRef, buffer, {
      contentType,
      cacheControl: '300'
    });

    // 5. Audit the export generation event itself
    await auditService.recordEvent({
      userId: requestedBy.id,
      category: 'SECURITY',
      action: 'EXPORT',
      eventType: 'AUDIT_EXPORT_COMPLETED',
      result: 'SUCCESS',
      description: `Audit trail report generated: Category: ${reportType}, Format: ${format}, Destination: ${fileRef}`,
      metadata: { reportId, reportType, format, fileRef }
    });

    return { fileRef };
  }
}

export default ReportService;
