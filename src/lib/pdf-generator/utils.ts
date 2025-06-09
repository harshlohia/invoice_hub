import jsPDF from 'jspdf';
import type { PDFTextOptions, PDFPosition } from './types';

export class PDFUtils {
  private doc: jsPDF;

  constructor(doc: jsPDF) {
    this.doc = doc;
  }

  /**
   * Add text with proper font handling and positioning
   */
  addText(
    text: string, 
    position: PDFPosition, 
    options: PDFTextOptions = {}
  ): PDFPosition {
    const {
      fontSize = 10,
      fontStyle = 'normal',
      align = 'left',
      color = [33, 33, 33],
      maxWidth,
      lineHeight = 1.2
    } = options;

    // Set font properties
    this.doc.setFont('helvetica', fontStyle);
    this.doc.setFontSize(fontSize);
    this.doc.setTextColor(color[0], color[1], color[2]);

    // Handle text wrapping
    if (maxWidth) {
      const lines = this.doc.splitTextToSize(text, maxWidth);
      const lineSpacing = fontSize * lineHeight * 0.35; // Convert to mm
      
      if (Array.isArray(lines)) {
        lines.forEach((line: string, index: number) => {
          const lineY = position.y + (index * lineSpacing);
          this.addSingleLine(line, { x: position.x, y: lineY }, align);
        });
        return {
          x: position.x,
          y: position.y + (lines.length * lineSpacing)
        };
      }
    }

    this.addSingleLine(text, position, align);
    return {
      x: position.x,
      y: position.y + (fontSize * lineHeight * 0.35)
    };
  }

  /**
   * Add a single line of text
   */
  private addSingleLine(text: string, position: PDFPosition, align: 'left' | 'center' | 'right'): void {
    if (align === 'right') {
      this.doc.text(text, position.x, position.y, { align: 'right' });
    } else if (align === 'center') {
      this.doc.text(text, position.x, position.y, { align: 'center' });
    } else {
      this.doc.text(text, position.x, position.y);
    }
  }

  /**
   * Add a rectangle with proper styling
   */
  addRectangle(
    position: PDFPosition,
    width: number,
    height: number,
    fillColor?: [number, number, number],
    strokeColor?: [number, number, number],
    lineWidth: number = 0.1
  ): void {
    if (fillColor) {
      this.doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
    }
    
    if (strokeColor) {
      this.doc.setDrawColor(strokeColor[0], strokeColor[1], strokeColor[2]);
    }
    
    this.doc.setLineWidth(lineWidth);
    
    if (fillColor && strokeColor) {
      this.doc.rect(position.x, position.y, width, height, 'FD');
    } else if (fillColor) {
      this.doc.rect(position.x, position.y, width, height, 'F');
    } else {
      this.doc.rect(position.x, position.y, width, height, 'D');
    }
  }

  /**
   * Add a line
   */
  addLine(
    start: PDFPosition,
    end: PDFPosition,
    color: [number, number, number] = [229, 231, 235],
    lineWidth: number = 0.1
  ): void {
    this.doc.setDrawColor(color[0], color[1], color[2]);
    this.doc.setLineWidth(lineWidth);
    this.doc.line(start.x, start.y, end.x, end.y);
  }

  /**
   * Check if content fits on current page
   */
  checkPageBreak(currentY: number, requiredHeight: number, pageHeight: number, bottomMargin: number): boolean {
    return currentY + requiredHeight > pageHeight - bottomMargin;
  }

  /**
   * Add a new page and return new Y position
   */
  addPage(topMargin: number): number {
    this.doc.addPage();
    return topMargin;
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number, currency: string = 'INR'): string {
    const symbol = currency === 'INR' ? 'Rs.' : currency;
    return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Calculate text width
   */
  getTextWidth(text: string, fontSize: number = 10): number {
    this.doc.setFontSize(fontSize);
    return this.doc.getTextWidth(text);
  }
}