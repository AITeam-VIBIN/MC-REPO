import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

/**
 * Generates flat CSV formatted Buffer from audit logs.
 * 
 * @function generateCSVReport
 * @param {Array<Object>} logs - List of audit records
 * @returns {Buffer} CSV data buffer
 */
export function generateCSVReport(logs) {
  const headers = [
    'Sequence Number',
    'Event Reference',
    'Category',
    'Action',
    'Result',
    'User Email',
    'Role Snapshot',
    'Department Snapshot',
    'IP Address',
    'Device',
    'Browser',
    'OS',
    'Description',
    'Created At'
  ];

  const rows = [headers.join(',')];

  for (const log of logs) {
    const userEmail = log.userSnapshot 
      ? (typeof log.userSnapshot === 'string' 
          ? log.userSnapshot 
          : (log.userSnapshot.email || log.userSnapshot.id || ''))
      : 'System';

    const row = [
      log.sequenceNumber?.toString() || '',
      `"${(log.eventRef || '').replace(/"/g, '""')}"`,
      `"${(log.category || '').replace(/"/g, '""')}"`,
      `"${(log.action || '').replace(/"/g, '""')}"`,
      `"${(log.result || '').replace(/"/g, '""')}"`,
      `"${userEmail.replace(/"/g, '""')}"`,
      `"${(log.roleSnapshot || '').replace(/"/g, '""')}"`,
      `"${(log.departmentSnapshot || '').replace(/"/g, '""')}"`,
      `"${(log.ipAddress || '').replace(/"/g, '""')}"`,
      `"${(log.device || '').replace(/"/g, '""')}"`,
      `"${(log.browser || '').replace(/"/g, '""')}"`,
      `"${(log.os || '').replace(/"/g, '""')}"`,
      `"${(log.description || '').replace(/"/g, '""')}"`,
      `"${log.createdAt ? new Date(log.createdAt).toISOString() : ''}"`
    ];
    rows.push(row.join(','));
  }

  return Buffer.from(rows.join('\n'), 'utf-8');
}

/**
 * Generates Excel formatted Buffer with multiple worksheets (Overview, Events, Users, Security) from audit logs.
 * 
 * @async
 * @function generateExcelReport
 * @param {Array<Object>} logs - List of audit records
 * @param {string} reportType - Type categorization of this report
 * @returns {Promise<Buffer>} Excel data buffer
 */
export async function generateExcelReport(logs, reportType) {
  const workbook = new ExcelJS.Workbook();

  // 1. Overview Worksheet
  const overviewSheet = workbook.addWorksheet('Overview');
  overviewSheet.columns = [
    { header: 'Report Parameter', key: 'param', width: 25 },
    { header: 'Details', key: 'detail', width: 35 }
  ];
  overviewSheet.getRow(1).font = { bold: true };
  overviewSheet.addRow({ param: 'Report Type Classification', detail: reportType });
  overviewSheet.addRow({ param: 'Export Date/Time', detail: new Date().toISOString() });
  overviewSheet.addRow({ param: 'Database Records Scanned', detail: logs.length });
  overviewSheet.addRow({ param: 'System Host Name', detail: 'Mitcon BCD-FSS Engine' });

  // 2. Events Worksheet
  const eventsSheet = workbook.addWorksheet('Events');
  eventsSheet.columns = [
    { header: 'Seq', key: 'seq', width: 10 },
    { header: 'Reference', key: 'ref', width: 20 },
    { header: 'Category', key: 'cat', width: 15 },
    { header: 'Action', key: 'act', width: 15 },
    { header: 'Result', key: 'res', width: 12 },
    { header: 'Description', key: 'desc', width: 45 },
    { header: 'Timestamp', key: 'time', width: 25 }
  ];
  eventsSheet.getRow(1).font = { bold: true };

  // 3. User Identity Snapshot Worksheet
  const usersSheet = workbook.addWorksheet('Identity Snapshot');
  usersSheet.columns = [
    { header: 'Event Ref', key: 'ref', width: 20 },
    { header: 'Email Snapshot', key: 'email', width: 30 },
    { header: 'Role Snapshot', key: 'role', width: 15 },
    { header: 'Department Snapshot', key: 'dept', width: 20 },
    { header: 'IP Address', key: 'ip', width: 15 }
  ];
  usersSheet.getRow(1).font = { bold: true };

  // Populate row content
  for (const log of logs) {
    const userEmail = log.userSnapshot 
      ? (typeof log.userSnapshot === 'string' 
          ? log.userSnapshot 
          : (log.userSnapshot.email || log.userSnapshot.id || ''))
      : 'System';

    eventsSheet.addRow({
      seq: log.sequenceNumber?.toString() || '',
      ref: log.eventRef,
      cat: log.category,
      act: log.action,
      res: log.result,
      desc: log.description || '',
      time: log.createdAt ? new Date(log.createdAt).toISOString() : ''
    });

    usersSheet.addRow({
      ref: log.eventRef,
      email: userEmail,
      role: log.roleSnapshot || 'N/A',
      dept: log.departmentSnapshot || 'N/A',
      ip: log.ipAddress || 'N/A'
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generates compliance-ready PDF Buffer from audit logs.
 * 
 * @async
 * @function generatePDFReport
 * @param {Array<Object>} logs - List of audit records
 * @param {string} reportType - Type categorization of this report
 * @returns {Promise<Buffer>} PDF data buffer
 */
export async function generatePDFReport(logs, reportType) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', err => reject(err));

    // Organization header
    doc.fontSize(16).font('Helvetica-Bold').text('MITCON CORPORATION', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text('Immutable Electronic Records Management (BCD-FSS)', { align: 'center' });
    doc.fontSize(10).font('Helvetica-Oblique').text('Compliance Audit History Ledger', { align: 'center' });
    doc.moveDown(1.5);

    // Metadata details
    doc.fontSize(10).font('Helvetica-Bold').text('Report Generation Details:');
    doc.font('Helvetica')
      .text(`  Report Category: ${reportType}`)
      .text(`  Generated Date: ${new Date().toISOString()}`)
      .text(`  Record Volume: ${logs.length} logged actions`);
    doc.moveDown(1);

    // Decorative Separator Line
    doc.lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1.5);

    doc.fontSize(11).font('Helvetica-Bold').text('Compliance Audit Logs Timeline:', { underline: true });
    doc.moveDown(0.5);

    if (logs.length === 0) {
      doc.fontSize(9).font('Helvetica-Oblique').text('No events found matching the designated filter parameters.');
    } else {
      for (const log of logs) {
        // Enforce page constraints by inserting new pages
        if (doc.y > 700) {
          doc.addPage();
        }

        const dateStr = log.createdAt ? new Date(log.createdAt).toISOString() : '';
        doc.fontSize(9).font('Helvetica-Bold')
          .text(`[SEQ: ${log.sequenceNumber || 'N/A'}] Event Ref: ${log.eventRef} - ${dateStr}`);

        const userEmail = log.userSnapshot 
          ? (typeof log.userSnapshot === 'string' 
              ? log.userSnapshot 
              : (log.userSnapshot.email || ''))
          : 'System';

        doc.font('Helvetica').fontSize(8.5)
          .text(`  Identity: Actor: ${userEmail} | Role: ${log.roleSnapshot || 'N/A'} | Dept: ${log.departmentSnapshot || 'N/A'}`)
          .text(`  Context: Category: ${log.category} | Action: ${log.action} | Result: ${log.result} | IP: ${log.ipAddress || 'N/A'}`)
          .text(`  Description: ${log.description || ''}`)
          .moveDown(0.8);
      }
    }

    doc.end();
  });
}
