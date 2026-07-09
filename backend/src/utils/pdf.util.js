/**
 * Helper to draw standard header on a PDF page.
 * 
 * @function drawPageHeader
 * @param {Object} doc - PDFDocument instance
 * @param {string} title - Report title
 * @param {string} refNumber - Report reference number
 * @param {string} generatedBy - Requester name/email
 */
export function drawPageHeader(doc, title, refNumber, generatedBy) {
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#1E3A8A')
    .text('MITCON CORPORATION - ELECTRONIC RECORDS MANAGEMENT', 50, 30);
  
  doc.fontSize(8).font('Helvetica').fillColor('#4B5563')
    .text(`Ref: ${refNumber}`, 300, 30, { align: 'right', width: 245 });
  
  doc.lineWidth(0.75).strokeColor('#E5E7EB')
    .moveTo(50, 42)
    .lineTo(545, 42)
    .stroke();
}

/**
 * Helper to draw standard footer on a PDF page.
 * 
 * @function drawPageFooter
 * @param {Object} doc - PDFDocument instance
 * @param {number} pageNum - Current page index (1-indexed)
 * @param {number} totalPages - Total pages in document
 */
export function drawPageFooter(doc, pageNum, totalPages) {
  doc.lineWidth(0.75).strokeColor('#E5E7EB')
    .moveTo(50, 792 - 45)
    .lineTo(545, 792 - 45)
    .stroke();

  doc.fontSize(7).font('Helvetica-Bold').fillColor('#9CA3AF')
    .text('CONFIDENTIAL - IMMUTABLE COMPLIANCE AUDIT REPORT', 50, 792 - 35);
  
  doc.fontSize(7).font('Helvetica').fillColor('#9CA3AF')
    .text(`Page ${pageNum} of ${totalPages}`, 300, 792 - 35, { align: 'right', width: 245 });
}

/**
 * Helper to draw a structured data table with wraps and page-overflow.
 * 
 * @function drawTable
 * @param {Object} doc - PDFDocument instance
 * @param {Array<string>} headers - Headers row
 * @param {Array<Array<string>>} rows - Table data cells
 * @param {Object} [options={}] - Column configuration
 */
export function drawTable(doc, headers, rows, options = {}) {
  const startX = options.startX || 50;
  const startY = options.startY || doc.y;
  const columnWidths = options.columnWidths || [];
  const rowHeight = options.rowHeight || 18;
  const fontSize = options.fontSize || 8;
  
  let currentY = startY;
  const tableWidth = 545 - startX;
  const colCount = headers.length;
  const widths = columnWidths.length === colCount 
    ? columnWidths 
    : Array(colCount).fill(tableWidth / colCount);

  // Helper to draw text within a cell, supporting wrapping
  const renderRow = (rowData, isHeader = false) => {
    // Determine height needed for this row if cells wrap
    let maxHeight = rowHeight;
    
    // Check if drawing row will exceed page bounds (margin 60)
    if (currentY + maxHeight > 730) {
      doc.addPage();
      currentY = 60; // Start below the page header
      
      // Re-draw headers on new page
      renderRow(headers, true);
    }

    // Render row background
    if (isHeader) {
      doc.rect(startX, currentY, tableWidth, maxHeight).fill('#1E3A8A');
    } else if (options.alternate && rows.indexOf(rowData) % 2 === 1) {
      doc.rect(startX, currentY, tableWidth, maxHeight).fill('#F3F4F6');
    }

    let currentX = startX;
    doc.fontSize(fontSize).font(isHeader ? 'Helvetica-Bold' : 'Helvetica');
    doc.fillColor(isHeader ? '#FFFFFF' : '#374151');

    rowData.forEach((cellText, idx) => {
      const colW = widths[idx];
      const textVal = cellText !== null && cellText !== undefined ? String(cellText) : '';
      
      doc.text(
        textVal,
        currentX + 4,
        currentY + (maxHeight - fontSize) / 2 - 1,
        { width: colW - 8, height: maxHeight - 2, lineBreak: false, ellipsis: true }
      );
      currentX += colW;
    });

    // Stroke cell bottom boundary line
    doc.lineWidth(0.5).strokeColor('#E5E7EB')
      .moveTo(startX, currentY + maxHeight)
      .lineTo(startX + tableWidth, currentY + maxHeight)
      .stroke();

    currentY += maxHeight;
  };

  // Header Row
  renderRow(headers, true);

  // Content Rows
  rows.forEach(row => {
    renderRow(row);
  });

  doc.y = currentY;
  return currentY;
}

export default {
  drawPageHeader,
  drawPageFooter,
  drawTable,
};
