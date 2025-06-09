import type { Invoice } from '@/lib/types';
import type { PDFPosition } from '../types';
import { PDFUtils } from '../utils';
import { FONT_SIZES, SPACING } from '../config';

export class TotalsSection {
  private utils: PDFUtils;
  private config: any;
  private dimensions: any;

  constructor(utils: PDFUtils, config: any, dimensions: any) {
    this.utils = utils;
    this.config = config;
    this.dimensions = dimensions;
  }

  render(invoice: Invoice, startPosition: PDFPosition): PDFPosition {
    const currencySymbol = invoice.currency === "INR" ? "Rs." : (invoice.currency || "Rs.");
    
    // Position totals section on the right side
    const totalsWidth = 70;
    const startX = this.dimensions.pageWidth - this.config.margins.right - totalsWidth;
    const labelWidth = 35;
    const valueWidth = 35;
    
    let currentY = startPosition.y;

    // Subtotal
    this.utils.addText(
      'Subtotal:',
      { x: startX, y: currentY },
      {
        fontSize: FONT_SIZES.body,
        color: this.config.colors.mutedText
      }
    );
    this.utils.addText(
      this.utils.formatCurrency(invoice.subTotal, invoice.currency),
      { x: startX + totalsWidth, y: currentY },
      {
        fontSize: FONT_SIZES.body,
        fontStyle: 'bold',
        align: 'right',
        color: this.config.colors.text
      }
    );
    currentY += SPACING.sm;

    // Tax details
    if (!invoice.isInterState) {
      // CGST
      this.utils.addText(
        'CGST:',
        { x: startX, y: currentY },
        {
          fontSize: FONT_SIZES.body,
          color: this.config.colors.mutedText
        }
      );
      this.utils.addText(
        this.utils.formatCurrency(invoice.totalCGST, invoice.currency),
        { x: startX + totalsWidth, y: currentY },
        {
          fontSize: FONT_SIZES.body,
          fontStyle: 'bold',
          align: 'right',
          color: this.config.colors.text
        }
      );
      currentY += SPACING.sm;

      // SGST
      this.utils.addText(
        'SGST:',
        { x: startX, y: currentY },
        {
          fontSize: FONT_SIZES.body,
          color: this.config.colors.mutedText
        }
      );
      this.utils.addText(
        this.utils.formatCurrency(invoice.totalSGST, invoice.currency),
        { x: startX + totalsWidth, y: currentY },
        {
          fontSize: FONT_SIZES.body,
          fontStyle: 'bold',
          align: 'right',
          color: this.config.colors.text
        }
      );
      currentY += SPACING.sm;
    } else {
      // IGST
      this.utils.addText(
        'IGST:',
        { x: startX, y: currentY },
        {
          fontSize: FONT_SIZES.body,
          color: this.config.colors.mutedText
        }
      );
      this.utils.addText(
        this.utils.formatCurrency(invoice.totalIGST, invoice.currency),
        { x: startX + totalsWidth, y: currentY },
        {
          fontSize: FONT_SIZES.body,
          fontStyle: 'bold',
          align: 'right',
          color: this.config.colors.text
        }
      );
      currentY += SPACING.sm;
    }

    // Separator line
    this.utils.addLine(
      { x: startX, y: currentY + 2 },
      { x: startX + totalsWidth, y: currentY + 2 },
      this.config.colors.border
    );
    currentY += SPACING.sm + 2;

    // Grand Total
    this.utils.addText(
      'Grand Total:',
      { x: startX, y: currentY },
      {
        fontSize: FONT_SIZES.subheading,
        fontStyle: 'bold',
        color: this.config.colors.text
      }
    );
    this.utils.addText(
      this.utils.formatCurrency(invoice.grandTotal, invoice.currency),
      { x: startX + totalsWidth, y: currentY },
      {
        fontSize: FONT_SIZES.subheading,
        fontStyle: 'bold',
        align: 'right',
        color: this.config.colors.primary
      }
    );

    return { x: startPosition.x, y: currentY + SPACING.xl };
  }
}