import puppeteer, { Browser, Page } from 'puppeteer';

export class InvoicePDFGenerator {
  private browser: Browser | null = null;

  private async initBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    try {
      // Launch browser with specific configuration for WebContainer environment
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      });

      console.log('Browser launched successfully');
      return this.browser;
    } catch (error) {
      console.error('Failed to launch browser:', error);
      throw new Error(`Browser launch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateInvoicePDF(invoiceData: any): Promise<Buffer> {
    let page: Page | null = null;
    
    try {
      console.log('Starting PDF generation...');
      
      const browser = await this.initBrowser();
      page = await browser.newPage();

      // Set viewport for consistent rendering
      await page.setViewport({ width: 1200, height: 800 });

      // Generate HTML content for the invoice
      const htmlContent = this.generateInvoiceHTML(invoiceData);
      
      // Set the HTML content
      await page.setContent(htmlContent, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });

      console.log('HTML content set, generating PDF...');

      // Generate PDF with specific options
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px',
        },
        preferCSSPageSize: true,
      });

      console.log('PDF generated successfully');
      return Buffer.from(pdfBuffer);

    } catch (error) {
      console.error('PDF generation error:', error);
      throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (closeError) {
          console.warn('Error closing page:', closeError);
        }
      }
    }
  }

  private generateInvoiceHTML(invoiceData: any): string {
    const {
      invoiceNumber,
      date,
      dueDate,
      client,
      items = [],
      subtotal = 0,
      tax = 0,
      total = 0,
      notes = '',
      businessInfo = {}
    } = invoiceData;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${invoiceNumber}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            background: white;
          }
          
          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            background: white;
          }
          
          .invoice-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 40px;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 20px;
          }
          
          .business-info h1 {
            font-size: 28px;
            color: #1f2937;
            margin-bottom: 10px;
          }
          
          .business-info p {
            color: #6b7280;
            margin-bottom: 5px;
          }
          
          .invoice-details {
            text-align: right;
          }
          
          .invoice-details h2 {
            font-size: 24px;
            color: #1f2937;
            margin-bottom: 10px;
          }
          
          .invoice-details p {
            margin-bottom: 5px;
            color: #6b7280;
          }
          
          .client-info {
            margin-bottom: 40px;
          }
          
          .client-info h3 {
            font-size: 18px;
            color: #1f2937;
            margin-bottom: 10px;
          }
          
          .client-info p {
            color: #6b7280;
            margin-bottom: 5px;
          }
          
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          
          .items-table th,
          .items-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
          }
          
          .items-table th {
            background-color: #f9fafb;
            font-weight: 600;
            color: #1f2937;
          }
          
          .items-table td {
            color: #6b7280;
          }
          
          .items-table .text-right {
            text-align: right;
          }
          
          .totals {
            margin-left: auto;
            width: 300px;
          }
          
          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          
          .totals-row.total {
            font-weight: 600;
            font-size: 18px;
            color: #1f2937;
            border-bottom: 2px solid #1f2937;
          }
          
          .notes {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
          
          .notes h4 {
            color: #1f2937;
            margin-bottom: 10px;
          }
          
          .notes p {
            color: #6b7280;
            line-height: 1.6;
          }
          
          @media print {
            body {
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="invoice-header">
            <div class="business-info">
              <h1>${businessInfo.name || 'Your Business'}</h1>
              <p>${businessInfo.address || ''}</p>
              <p>${businessInfo.city || ''} ${businessInfo.state || ''} ${businessInfo.zip || ''}</p>
              <p>${businessInfo.email || ''}</p>
              <p>${businessInfo.phone || ''}</p>
            </div>
            <div class="invoice-details">
              <h2>INVOICE</h2>
              <p><strong>Invoice #:</strong> ${invoiceNumber}</p>
              <p><strong>Date:</strong> ${new Date(date).toLocaleDateString()}</p>
              <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
            </div>
          </div>
          
          <div class="client-info">
            <h3>Bill To:</h3>
            <p><strong>${client?.name || 'Client Name'}</strong></p>
            <p>${client?.email || ''}</p>
            <p>${client?.address || ''}</p>
            <p>${client?.city || ''} ${client?.state || ''} ${client?.zip || ''}</p>
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th class="text-right">Quantity</th>
                <th class="text-right">Rate</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item: any) => `
                <tr>
                  <td>${item.description || ''}</td>
                  <td class="text-right">${item.quantity || 0}</td>
                  <td class="text-right">$${(item.rate || 0).toFixed(2)}</td>
                  <td class="text-right">$${((item.quantity || 0) * (item.rate || 0)).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totals">
            <div class="totals-row">
              <span>Subtotal:</span>
              <span>$${subtotal.toFixed(2)}</span>
            </div>
            <div class="totals-row">
              <span>Tax:</span>
              <span>$${tax.toFixed(2)}</span>
            </div>
            <div class="totals-row total">
              <span>Total:</span>
              <span>$${total.toFixed(2)}</span>
            </div>
          </div>
          
          ${notes ? `
            <div class="notes">
              <h4>Notes:</h4>
              <p>${notes}</p>
            </div>
          ` : ''}
        </div>
      </body>
      </html>
    `;
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        console.log('Browser closed successfully');
      } catch (error) {
        console.warn('Error closing browser:', error);
      }
    }
  }
}

// Create a singleton instance
export const pdfGenerator = new InvoicePDFGenerator();

// Cleanup on process exit
process.on('exit', () => {
  pdfGenerator.cleanup();
});

process.on('SIGINT', () => {
  pdfGenerator.cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  pdfGenerator.cleanup();
  process.exit(0);
});