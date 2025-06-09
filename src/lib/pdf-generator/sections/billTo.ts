import type { Invoice } from '@/lib/types';
import type { PDFPosition } from '../types';
import { PDFUtils } from '../utils';
import { FONT_SIZES, SPACING } from '../config';

export class BillToSection {
  private utils: PDFUtils;
  private config: any;

  constructor(utils: PDFUtils, config: any) {
    this.utils = utils;
    this.config = config;
  }

  render(invoice: Invoice, startPosition: PDFPosition): PDFPosition {
    let currentY = startPosition.y;

    // Bill To label
    this.utils.addText(
      'Bill To:',
      { x: this.config.margins.left, y: currentY },
      {
        fontSize: FONT_SIZES.body + 1,
        fontStyle: 'bold',
        color: this.config.colors.text
      }
    );

    currentY += SPACING.sm + 2;

    // Client name in primary color
    this.utils.addText(
      invoice.client.name,
      { x: this.config.margins.left, y: currentY },
      {
        fontSize: FONT_SIZES.subheading,
        fontStyle: 'bold',
        color: this.config.colors.primary
      }
    );

    currentY += SPACING.sm;

    // Client address with compact spacing
    const clientAddressLines = [
      invoice.client.addressLine1,
      invoice.client.addressLine2,
      `${invoice.client.city}, ${invoice.client.state} - ${invoice.client.postalCode}`,
      invoice.client.gstin ? `GSTIN: ${invoice.client.gstin}` : null
    ].filter(Boolean);

    clientAddressLines.forEach((line) => {
      if (line) {
        this.utils.addText(
          line,
          { x: this.config.margins.left, y: currentY },
          {
            fontSize: FONT_SIZES.tiny,
            color: this.config.colors.mutedText
          }
        );
        currentY += SPACING.xs + 1; // Tight spacing
      }
    });

    return { x: startPosition.x, y: currentY + SPACING.lg };
  }
}