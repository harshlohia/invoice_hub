import type { Invoice } from '@/lib/types';

export interface PDFGenerationOptions {
  filename?: string;
  download?: boolean;
}

export class InvoicePDFGenerator {
  public async generateInvoicePDF(invoice: Invoice, options: PDFGenerationOptions = {}): Promise<void> {
    const { filename = `invoice-${invoice.invoiceNumber}.pdf`, download = true } = options;

    try {
      // Call our API route to generate the PDF using Puppeteer
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoice,
          options
        }),
      });

      if (!response.ok) {
        throw new Error(`PDF generation failed: ${response.statusText}`);
      }

      // Get the PDF blob
      const pdfBlob = await response.blob();

      if (download) {
        // Create download link
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }

      return;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF. Please try again.');
    }
  }

  public async getBlob(invoice: Invoice): Promise<Blob> {
    const response = await fetch('/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invoice,
        options: { download: false }
      }),
    });

    if (!response.ok) {
      throw new Error(`PDF generation failed: ${response.statusText}`);
    }

    return await response.blob();
  }

  public async getDataUri(invoice: Invoice): Promise<string> {
    const blob = await this.getBlob(invoice);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}