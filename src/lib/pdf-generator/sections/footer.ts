import type { Invoice } from '@/lib/types';
import type { PDFPosition } from '../types';
import { PDFUtils } from '../utils';
import { FONT_SIZES, SPACING } from '../config';

export class FooterSection {
  private utils: PDFUtils;
  private config: any;
  private dimensions: any;

  constructor(utils: PDFUtils, config: any, dimensions: any) {
    this.utils = utils;
    this.config = config;
    this.dimensions = dimensions;
  }

  render(invoice: Invoice, startPosition: PDFPosition): PDFPosition {
    let currentY = startPosition.y;

    // Notes section
    if (invoice.notes) {
      this.utils.addText(
        'Notes:',
        { x: this.config.margins.left, y: currentY },
        {
          fontSize: FONT_SIZES.body,
          fontStyle: 'bold',
          color: this.config.colors.text
        }
      );
      currentY += SPACING.sm;

      const notesPosition = this.utils.addText(
        invoice.notes,
        { x: this.config.margins.left, y: currentY },
        {
          fontSize: FONT_SIZES.small,
          color: this.config.colors.mutedText,
          maxWidth: this.dimensions.contentWidth
        }
      );
      currentY = notesPosition.y + SPACING.md;
    }

    // Terms & Conditions
    if (invoice.termsAndConditions) {
      this.utils.addText(
        'Terms & Conditions:',
        { x: this.config.margins.left, y: currentY },
        {
          fontSize: FONT_SIZES.body,
          fontStyle: 'bold',
          color: this.config.colors.text
        }
      );
      currentY += SPACING.sm;

      const termsPosition = this.utils.addText(
        invoice.termsAndConditions,
        { x: this.config.margins.left, y: currentY },
        {
          fontSize: FONT_SIZES.small,
          color: this.config.colors.mutedText,
          maxWidth: this.dimensions.contentWidth
        }
      );
      currentY = termsPosition.y + SPACING.md;
    }

    // Payment Information
    if (invoice.billerInfo.bankName || invoice.billerInfo.upiId) {
      this.utils.addText(
        'Payment Information:',
        { x: this.config.margins.left, y: currentY },
        {
          fontSize: FONT_SIZES.body,
          fontStyle: 'bold',
          color: this.config.colors.text
        }
      );
      currentY += SPACING.sm;

      // Background box for payment info
      const boxHeight = 25;
      this.utils.addRectangle(
        { x: this.config.margins.left, y: currentY },
        this.dimensions.contentWidth,
        boxHeight,
        this.config.colors.lightGray,
        this.config.colors.border
      );

      // Two-column layout
      const leftCol = this.config.margins.left + SPACING.sm;
      const rightCol = this.config.margins.left + this.dimensions.contentWidth / 2;
      let leftY = currentY + SPACING.sm;
      let rightY = currentY + SPACING.sm;

      // Left column
      if (invoice.billerInfo.bankName) {
        this.utils.addText(
          'Bank:',
          { x: leftCol, y: leftY },
          {
            fontSize: FONT_SIZES.tiny,
            fontStyle: 'bold',
            color: this.config.colors.text
          }
        );
        this.utils.addText(
          invoice.billerInfo.bankName,
          { x: leftCol + 15, y: leftY },
          {
            fontSize: FONT_SIZES.tiny,
            color: this.config.colors.mutedText
          }
        );
        leftY += SPACING.xs + 1;
      }

      if (invoice.billerInfo.accountNumber) {
        this.utils.addText(
          'A/C No:',
          { x: leftCol, y: leftY },
          {
            fontSize: FONT_SIZES.tiny,
            fontStyle: 'bold',
            color: this.config.colors.text
          }
        );
        this.utils.addText(
          invoice.billerInfo.accountNumber,
          { x: leftCol + 15, y: leftY },
          {
            fontSize: FONT_SIZES.tiny,
            color: this.config.colors.mutedText
          }
        );
      }

      // Right column
      if (invoice.billerInfo.ifscCode) {
        this.utils.addText(
          'IFSC:',
          { x: rightCol, y: rightY },
          {
            fontSize: FONT_SIZES.tiny,
            fontStyle: 'bold',
            color: this.config.colors.text
          }
        );
        this.utils.addText(
          invoice.billerInfo.ifscCode,
          { x: rightCol + 15, y: rightY },
          {
            fontSize: FONT_SIZES.tiny,
            color: this.config.colors.mutedText
          }
        );
        rightY += SPACING.xs + 1;
      }

      if (invoice.billerInfo.upiId) {
        this.utils.addText(
          'UPI:',
          { x: rightCol, y: rightY },
          {
            fontSize: FONT_SIZES.tiny,
            fontStyle: 'bold',
            color: this.config.colors.text
          }
        );
        this.utils.addText(
          invoice.billerInfo.upiId,
          { x: rightCol + 15, y: rightY },
          {
            fontSize: FONT_SIZES.tiny,
            color: this.config.colors.mutedText
          }
        );
      }

      currentY += boxHeight + SPACING.md;
    }

    return { x: startPosition.x, y: currentY };
  }
}