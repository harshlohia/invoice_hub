import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { Invoice } from '@/lib/types';
import { format } from 'date-fns';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export interface PDFTemplate {
  generatePDF(invoice: Invoice): jsPDF;
  downloadPDF(invoice: Invoice, filename?: string): void;
}

export abstract class BasePDFTemplate implements PDFTemplate {
  protected doc: jsPDF;
  protected pageWidth: number;
  protected pageHeight: number;
  protected margin: number = 15; // Reduced margin
  protected currentY: number = 15;

  // Exact colors from your web preview
  protected colors = {
    primary: [63, 81, 181], // #3F51B5 - Your app's primary blue
    text: [17, 24, 39], // Very dark gray for text
    mutedText: [107, 114, 126], // Muted gray text
    lightGray: [248, 250, 252], // Very light background
    white: [255, 255, 255],
    border: [229, 231, 235], // Light border
    tableHeader: [248, 250, 252], // Light gray header (NOT blue)
    tableAlt: [249, 250, 251], // Alternating row color
  };

  constructor() {
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
  }

  protected addText(text: string, x: number, y: number, options?: { 
    fontSize?: number; 
    fontStyle?: 'normal' | 'bold'; 
    align?: 'left' | 'center' | 'right';
    color?: number[];
    maxWidth?: number;
  }): number {
    // Set font - using Helvetica for consistency
    this.doc.setFont('helvetica', options?.fontStyle || 'normal');
    this.doc.setFontSize(options?.fontSize || 9);
    
    // Set color
    if (options?.color) {
      this.doc.setTextColor(options.color[0], options.color[1], options.color[2]);
    } else {
      this.doc.setTextColor(this.colors.text[0], this.colors.text[1], this.colors.text[2]);
    }

    // Handle text wrapping if maxWidth is specified
    if (options?.maxWidth) {
      const lines = this.doc.splitTextToSize(text, options.maxWidth);
      if (Array.isArray(lines)) {
        lines.forEach((line: string, index: number) => {
          const lineY = y + (index * 4);
          if (options?.align === 'right') {
            this.doc.text(line, x, lineY, { align: 'right' });
          } else if (options?.align === 'center') {
            this.doc.text(line, x, lineY, { align: 'center' });
          } else {
            this.doc.text(line, x, lineY);
          }
        });
        return lines.length * 4; // Return height used
      }
    }

    // Single line text
    if (options?.align === 'right') {
      this.doc.text(text, x, y, { align: 'right' });
    } else if (options?.align === 'center') {
      this.doc.text(text, x, y, { align: 'center' });
    } else {
      this.doc.text(text, x, y);
    }
    
    return 4; // Return single line height
  }

  protected addRect(x: number, y: number, width: number, height: number, fillColor?: number[], strokeColor?: number[]): void {
    if (fillColor) {
      this.doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
    }
    if (strokeColor) {
      this.doc.setDrawColor(strokeColor[0], strokeColor[1], strokeColor[2]);
    } else {
      this.doc.setDrawColor(this.colors.border[0], this.colors.border[1], this.colors.border[2]);
    }
    
    this.doc.setLineWidth(0.1);
    
    if (fillColor && strokeColor) {
      this.doc.rect(x, y, width, height, 'FD');
    } else if (fillColor) {
      this.doc.rect(x, y, width, height, 'F');
    } else {
      this.doc.rect(x, y, width, height, 'D');
    }
  }

  protected addLine(x1: number, y1: number, x2: number, y2: number, color?: number[]): void {
    if (color) {
      this.doc.setDrawColor(color[0], color[1], color[2]);
    } else {
      this.doc.setDrawColor(this.colors.border[0], this.colors.border[1], this.colors.border[2]);
    }
    this.doc.setLineWidth(0.1);
    this.doc.line(x1, y1, x2, y2);
  }

  protected checkPageBreak(requiredHeight: number): void {
    if (this.currentY + requiredHeight > this.pageHeight - this.margin) {
      this.doc.addPage();
      this.currentY = this.margin;
    }
  }

  // Abstract methods that templates must implement
  protected abstract addHeader(invoice: Invoice): void;
  protected abstract addBillToSection(invoice: Invoice): void;
  protected abstract addLineItemsTable(invoice: Invoice): void;
  protected abstract addTotalsSection(invoice: Invoice): void;
  protected abstract addNotesSection(invoice: Invoice): void;
  protected abstract addPaymentInfo(invoice: Invoice): void;

  public generatePDF(invoice: Invoice): jsPDF {
    // Reset document
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.currentY = this.margin;

    // Build PDF using template methods
    this.addHeader(invoice);
    this.addBillToSection(invoice);
    this.addLineItemsTable(invoice);
    this.addTotalsSection(invoice);
    this.addNotesSection(invoice);
    this.addPaymentInfo(invoice);

    return this.doc;
  }

  public downloadPDF(invoice: Invoice, filename?: string): void {
    const pdf = this.generatePDF(invoice);
    const fileName = filename || `invoice-${invoice.invoiceNumber || 'details'}.pdf`;
    pdf.save(fileName);
  }
}