import type { Invoice } from '@/lib/types';
import type { PDFPosition, PDFTableColumn } from '../types';
import { PDFUtils } from '../utils';
import { FONT_SIZES, SPACING } from '../config';

export class TableSection {
  private utils: PDFUtils;
  private config: any;
  private dimensions: any;
  private doc: any;

  constructor(utils: PDFUtils, config: any, dimensions: any, doc: any) {
    this.utils = utils;
    this.config = config;
    this.dimensions = dimensions;
    this.doc = doc;
  }

  render(invoice: Invoice, startPosition: PDFPosition): PDFPosition {
    const currencySymbol = invoice.currency === "INR" ? "Rs." : (invoice.currency || "Rs.");

    // Define optimized column widths (total should be ~170mm for A4)
    const columns: PDFTableColumn[] = [
      { key: 'index', header: '#', width: 10, align: 'center' },
      { key: 'product', header: 'Item/Service', width: 70, align: 'left' },
      { key: 'quantity', header: 'Qty', width: 15, align: 'center' },
      { key: 'rate', header: `Rate (${currencySymbol})`, width: 25, align: 'right' },
      { key: 'discount', header: 'Discount (%)', width: 20, align: 'center' },
      { key: 'amount', header: `Amount (${currencySymbol})`, width: 30, align: 'right' }
    ];

    // Prepare table data
    const tableData = invoice.lineItems.map((item, index) => [
      (index + 1).toString(),
      item.productName,
      item.quantity.toString(),
      item.rate.toFixed(2),
      item.discountPercentage.toFixed(2) + '%',
      item.amount.toFixed(2)
    ]);

    // Use autoTable with precise styling
    (this.doc as any).autoTable({
      startY: startPosition.y,
      head: [columns.map(col => col.header)],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: FONT_SIZES.small,
        cellPadding: 2.5, // Reduced padding for compactness
        lineColor: this.config.colors.border,
        lineWidth: 0.3,
        textColor: this.config.colors.text,
        font: 'helvetica',
        overflow: 'linebreak',
        halign: 'left'
      },
      headStyles: {
        fillColor: this.config.colors.tableHeader, // Light gray, NOT blue
        textColor: this.config.colors.text,
        fontStyle: 'bold',
        fontSize: FONT_SIZES.small,
        lineColor: this.config.colors.border,
        lineWidth: 0.3,
        halign: 'center',
        cellPadding: 3
      },
      bodyStyles: {
        fillColor: this.config.colors.white,
        textColor: this.config.colors.text,
        fontSize: FONT_SIZES.small
      },
      alternateRowStyles: {
        fillColor: this.config.colors.tableAlt // Very light alternating rows
      },
      columnStyles: {
        0: { cellWidth: columns[0].width, halign: columns[0].align },
        1: { cellWidth: columns[1].width, halign: columns[1].align },
        2: { cellWidth: columns[2].width, halign: columns[2].align },
        3: { cellWidth: columns[3].width, halign: columns[3].align },
        4: { cellWidth: columns[4].width, halign: columns[4].align },
        5: { cellWidth: columns[5].width, halign: columns[5].align }
      },
      margin: { 
        left: this.config.margins.left, 
        right: this.config.margins.right 
      },
      tableLineColor: this.config.colors.border,
      tableLineWidth: 0.3,
      showHead: 'everyPage',
      pageBreak: 'auto'
    });

    // Return position after table
    const finalY = (this.doc as any).lastAutoTable.finalY;
    return { x: startPosition.x, y: finalY + SPACING.lg };
  }
}