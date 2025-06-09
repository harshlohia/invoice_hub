import type { Invoice } from '@/lib/types';
import type { PDFPosition } from '../types';
import { PDFUtils } from '../utils';
import { FONT_SIZES, SPACING, LAYOUT } from '../config';
import { format } from 'date-fns';

export class HeaderSection {
  private utils: PDFUtils;
  private config: any;
  private dimensions: any;

  constructor(utils: PDFUtils, config: any, dimensions: any) {
    this.utils = utils;
    this.config = config;
    this.dimensions = dimensions;
  }

  render(invoice: Invoice, startPosition: PDFPosition): PDFPosition {
    // Header background
    this.utils.addRectangle(
      { x: 0, y: 0 },
      this.dimensions.pageWidth,
      LAYOUT.headerHeight,
      this.config.colors.lightGray
    );

    // Logo placeholder
    this.utils.addRectangle(
      { x: this.config.margins.left, y: this.config.margins.top },
      LAYOUT.logoSize.width,
      LAYOUT.logoSize.height,
      [200, 200, 200],
      this.config.colors.border
    );

    this.utils.addText(
      'Logo',
      { 
        x: this.config.margins.left + LAYOUT.logoSize.width / 2, 
        y: this.config.margins.top + LAYOUT.logoSize.height / 2 + 2
      },
      {
        fontSize: FONT_SIZES.tiny,
        align: 'center',
        color: this.config.colors.white
      }
    );

    // Company information
    let companyY = this.config.margins.top + LAYOUT.logoSize.height + SPACING.sm;
    
    this.utils.addText(
      invoice.billerInfo.businessName,
      { x: this.config.margins.left, y: companyY },
      {
        fontSize: FONT_SIZES.heading,
        fontStyle: 'bold',
        color: this.config.colors.primary
      }
    );

    companyY += SPACING.md;

    // Company address with tight spacing
    const addressLines = [
      invoice.billerInfo.addressLine1,
      invoice.billerInfo.addressLine2,
      `${invoice.billerInfo.city}, ${invoice.billerInfo.state} - ${invoice.billerInfo.postalCode}`,
      invoice.billerInfo.gstin ? `GSTIN: ${invoice.billerInfo.gstin}` : null
    ].filter(Boolean);

    addressLines.forEach((line) => {
      if (line) {
        this.utils.addText(
          line,
          { x: this.config.margins.left, y: companyY },
          {
            fontSize: FONT_SIZES.tiny,
            color: this.config.colors.mutedText
          }
        );
        companyY += SPACING.xs + 1; // Very tight spacing
      }
    });

    // Right side - Invoice title and details
    const rightX = this.dimensions.pageWidth - this.config.margins.right;
    
    this.utils.addText(
      'INVOICE',
      { x: rightX, y: this.config.margins.top + SPACING.md },
      {
        fontSize: FONT_SIZES.title,
        fontStyle: 'bold',
        align: 'right',
        color: [119, 119, 119] // Gray like web
      }
    );

    this.utils.addText(
      `# ${invoice.invoiceNumber}`,
      { x: rightX, y: this.config.margins.top + SPACING.md + 8 },
      {
        fontSize: FONT_SIZES.subheading,
        align: 'right',
        color: this.config.colors.mutedText
      }
    );

    // Separator line
    this.utils.addLine(
      { x: rightX - 60, y: this.config.margins.top + SPACING.md + 15 },
      { x: rightX, y: this.config.margins.top + SPACING.md + 15 },
      this.config.colors.border
    );

    // Dates
    const invoiceDate = invoice.invoiceDate instanceof Date ? invoice.invoiceDate : invoice.invoiceDate.toDate();
    const dueDate = invoice.dueDate instanceof Date ? invoice.dueDate : invoice.dueDate.toDate();

    let dateY = this.config.margins.top + SPACING.md + 22;

    // Date
    this.utils.addText(
      'Date:',
      { x: rightX - 50, y: dateY },
      {
        fontSize: FONT_SIZES.small,
        fontStyle: 'bold',
        color: this.config.colors.text
      }
    );
    this.utils.addText(
      format(invoiceDate, 'dd MMM, yyyy'),
      { x: rightX, y: dateY },
      {
        fontSize: FONT_SIZES.small,
        align: 'right',
        color: this.config.colors.text
      }
    );

    dateY += SPACING.sm + 1;

    // Due Date
    this.utils.addText(
      'Due Date:',
      { x: rightX - 50, y: dateY },
      {
        fontSize: FONT_SIZES.small,
        fontStyle: 'bold',
        color: this.config.colors.text
      }
    );
    this.utils.addText(
      format(dueDate, 'dd MMM, yyyy'),
      { x: rightX, y: dateY },
      {
        fontSize: FONT_SIZES.small,
        align: 'right',
        color: this.config.colors.text
      }
    );

    return { x: startPosition.x, y: LAYOUT.headerHeight + SPACING.md };
  }
}