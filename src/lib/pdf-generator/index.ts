import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { Invoice } from '@/lib/types';
import type { PDFConfig, PDFDimensions, PDFPosition, InvoiceTemplate } from './types';
import { DEFAULT_PDF_CONFIG } from './config';
import { PDFUtils } from './utils';
import { classicTemplate } from './templates/classic';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

/**
 * Industry-level PDF Generator with extensible template system
 * Designed for perfect web preview matching and future template support
 */
export class InvoicePDFGenerator {
  private doc: jsPDF;
  private config: PDFConfig;
  private dimensions: PDFDimensions;
  private utils: PDFUtils;
  private template: InvoiceTemplate;

  constructor(templateId: string = 'classic', customConfig?: Partial<PDFConfig>) {
    this.config = { ...DEFAULT_PDF_CONFIG, ...customConfig };
    this.template = this.getTemplate(templateId);
    this.initializeDocument();
    this.calculateDimensions();
    this.utils = new PDFUtils(this.doc);
  }

  /**
   * Initialize PDF document with proper settings
   */
  private initializeDocument(): void {
    this.doc = new jsPDF({
      orientation: this.config.orientation,
      unit: 'mm',
      format: this.config.pageSize,
    });

    // Set default font
    this.doc.setFont(this.config.fonts.primary, 'normal');
  }

  /**
   * Calculate page dimensions and content area
   */
  private calculateDimensions(): void {
    this.dimensions = {
      pageWidth: this.doc.internal.pageSize.getWidth(),
      pageHeight: this.doc.internal.pageSize.getHeight(),
      contentWidth: this.doc.internal.pageSize.getWidth() - this.config.margins.left - this.config.margins.right,
      contentHeight: this.doc.internal.pageSize.getHeight() - this.config.margins.top - this.config.margins.bottom,
    };
  }

  /**
   * Get template by ID (extensible for future templates)
   */
  private getTemplate(templateId: string): InvoiceTemplate {
    const templates = {
      classic: classicTemplate,
      // Future templates can be added here:
      // modern: modernTemplate,
      // creative: creativeTemplate,
    };

    return templates[templateId as keyof typeof templates] || classicTemplate;
  }

  /**
   * Generate PDF using the selected template
   */
  public generatePDF(invoice: Invoice): jsPDF {
    // Reset document for fresh generation
    this.initializeDocument();
    this.calculateDimensions();
    this.utils = new PDFUtils(this.doc);

    let currentPosition: PDFPosition = {
      x: this.config.margins.left,
      y: this.config.margins.top
    };

    // Render each section from the template
    for (const section of this.template.sections) {
      // Check if we need a page break
      if (this.utils.checkPageBreak(
        currentPosition.y,
        section.height,
        this.dimensions.pageHeight,
        this.config.margins.bottom
      )) {
        currentPosition.y = this.utils.addPage(this.config.margins.top);
      }

      // Render the section
      currentPosition = section.render(this, invoice, currentPosition);
    }

    return this.doc;
  }

  /**
   * Download PDF with proper filename
   */
  public downloadPDF(invoice: Invoice, filename?: string): void {
    const pdf = this.generatePDF(invoice);
    const fileName = filename || `invoice-${invoice.invoiceNumber || 'details'}.pdf`;
    pdf.save(fileName);
  }

  /**
   * Get PDF as blob for further processing
   */
  public getPDFBlob(invoice: Invoice): Blob {
    const pdf = this.generatePDF(invoice);
    return pdf.output('blob');
  }

  /**
   * Get PDF as base64 string
   */
  public getPDFBase64(invoice: Invoice): string {
    const pdf = this.generatePDF(invoice);
    return pdf.output('datauristring');
  }

  // Expose internal properties for section renderers
  public get utils(): PDFUtils { return this.utils; }
  public get config(): PDFConfig { return this.config; }
  public get dimensions(): PDFDimensions { return this.dimensions; }
  public get doc(): jsPDF { return this.doc; }
}

// Export for backward compatibility and easy usage
export { classicTemplate };
export type { InvoiceTemplate, PDFConfig };