import { PDFTemplateFactory, type TemplateType } from './pdf-templates';
import type { Invoice } from '@/lib/types';

export class InvoicePDFGenerator {
  private templateType: TemplateType;

  constructor(templateType: TemplateType = 'classic') {
    this.templateType = templateType;
  }

  public downloadPDF(invoice: Invoice, filename?: string): void {
    const template = PDFTemplateFactory.createTemplate(this.templateType);
    template.downloadPDF(invoice, filename);
  }

  public generatePDF(invoice: Invoice) {
    const template = PDFTemplateFactory.createTemplate(this.templateType);
    return template.generatePDF(invoice);
  }

  public setTemplate(templateType: TemplateType): void {
    this.templateType = templateType;
  }
}

// For backward compatibility
export { PDFTemplateFactory, type TemplateType };