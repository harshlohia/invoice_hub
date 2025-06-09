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
      businessInfo,
      items = [],
      subtotal = 0,
      tax = 0,
      total = 0,
      notes = '',
      isInterState = false,
      totalCGST = 0,
      totalSGST = 0,
      totalIGST = 0
    } = invoiceData;

    const invoiceDate = new Date(date);
    const dueDateObj = new Date(dueDate);

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
            border-bottom: 2px solid #3F51B5;
            padding-bottom: 20px;
          }
          
          .business-info h1 {
            font-size: 28px;
            color: #3F51B5;
            margin-bottom: 10px;
          }
          
          .business-info p {
            color: #6b7280;
            margin-bottom: 5px;
          }
          
          .gstin-badge {
            background-color: rgba(63, 81, 181, 0.1);
            color: #3F51B5;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 12px;
            display: inline-block;
            margin-top: 8px;
          }
          
          .invoice-details {
            text-align: right;
          }
          
          .invoice-details h2 {
            font-size: 32px;
            color: #1f2937;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
          
          .invoice-details p {
            margin-bottom: 5px;
            color: #6b7280;
          }
          
          .invoice-number {
            font-size: 18px;
            color: #3F51B5;
            font-weight: 600;
          }
          
          .client-info {
            margin-bottom: 40px;
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
          }
          
          .client-info h3 {
            font-size: 18px;
            color: #1f2937;
            margin-bottom: 10px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 5px;
          }
          
          .client-info .client-name {
            font-size: 16px;
            font-weight: 600;
            color: #3F51B5;
            margin-bottom: 5px;
          }
          
          .client-info p {
            color: #6b7280;
            margin-bottom: 3px;
          }
          
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          
          .items-table th {
            background-color: #3F51B5;
            color: white;
            padding: 15px 12px;
            text-align: left;
            font-weight: 600;
            font-size: 14px;
          }
          
          .items-table td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
            color: #374151;
          }
          
          .items-table .text-right {
            text-align: right;
          }
          
          .items-table tbody tr:hover {
            background-color: #f9fafb;
          }
          
          .totals {
            margin-left: auto;
            width: 350px;
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
          }
          
          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          
          .totals-row.total {
            font-weight: 700;
            font-size: 20px;
            color: #3F51B5;
            border-bottom: 2px solid #3F51B5;
            border-top: 2px solid #3F51B5;
            margin-top: 10px;
            padding-top: 15px;
          }
          
          .tax-row {
            font-size: 14px;
            color: #6b7280;
          }
          
          .notes {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
          
          .notes h4 {
            color: #1f2937;
            margin-bottom: 10px;
            font-size: 16px;
          }
          
          .notes p {
            color: #6b7280;
            line-height: 1.6;
            background-color: #f9fafb;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #3F51B5;
          }
          
          .payment-info {
            margin-top: 30px;
            background-color: #f0f9ff;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #bfdbfe;
          }
          
          .payment-info h4 {
            color: #1e40af;
            margin-bottom: 15px;
            font-size: 16px;
          }
          
          .payment-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }
          
          .payment-grid p {
            color: #374151;
            font-size: 14px;
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
              <h1>${businessInfo?.name || 'Your Business'}</h1>
              <p>${businessInfo?.address || ''}</p>
              ${businessInfo?.city ? `<p>${businessInfo.city}, ${businessInfo.state || ''} ${businessInfo.zip || ''}</p>` : ''}
              ${businessInfo?.email ? `<p>${businessInfo.email}</p>` : ''}
              ${businessInfo?.phone ? `<p>${businessInfo.phone}</p>` : ''}
              ${businessInfo?.gstin ? `<div class="gstin-badge">GSTIN: ${businessInfo.gstin}</div>` : ''}
            </div>
            <div class="invoice-details">
              <h2>INVOICE</h2>
              <p class="invoice-number"># ${invoiceNumber}</p>
              <p><strong>Date:</strong> ${invoiceDate.toLocaleDateString('en-IN')}</p>
              <p><strong>Due Date:</strong> ${dueDateObj.toLocaleDateString('en-IN')}</p>
            </div>
          </div>
          
          <div class="client-info">
            <h3>Bill To:</h3>
            <div class="client-name">${client?.name || 'Client Name'}</div>
            ${client?.email ? `<p>${client.email}</p>` : ''}
            ${client?.address ? `<p>${client.address}</p>` : ''}
            ${client?.city ? `<p>${client.city}, ${client.state || ''} ${client.zip || ''}</p>` : ''}
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th class="text-right">Quantity</th>
                <th class="text-right">Rate (₹)</th>
                <th class="text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item: any, index: number) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${item.description || ''}</td>
                  <td class="text-right">${item.quantity || 0}</td>
                  <td class="text-right">₹${(item.rate || 0).toFixed(2)}</td>
                  <td class="text-right">₹${(item.amount || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totals">
            <div class="totals-row">
              <span>Subtotal:</span>
              <span>₹${subtotal.toFixed(2)}</span>
            </div>
            ${!isInterState ? `
              <div class="totals-row tax-row">
                <span>CGST:</span>
                <span>₹${totalCGST.toFixed(2)}</span>
              </div>
              <div class="totals-row tax-row">
                <span>SGST:</span>
                <span>₹${totalSGST.toFixed(2)}</span>
              </div>
            ` : `
              <div class="totals-row tax-row">
                <span>IGST:</span>
                <span>₹${totalIGST.toFixed(2)}</span>
              </div>
            `}
            <div class="totals-row total">
              <span>Grand Total:</span>
              <span>₹${total.toFixed(2)}</span>
            </div>
          </div>
          
          ${notes ? `
            <div class="notes">
              <h4>Notes:</h4>
              <p>${notes}</p>
            </div>
          ` : ''}

          ${businessInfo?.bankName ? `
            <div class="payment-info">
              <h4>Payment Information:</h4>
              <div class="payment-grid">
                ${businessInfo.bankName ? `<p><strong>Bank:</strong> ${businessInfo.bankName}</p>` : ''}
                ${businessInfo.accountNumber ? `<p><strong>A/C No:</strong> ${businessInfo.accountNumber}</p>` : ''}
                ${businessInfo.ifscCode ? `<p><strong>IFSC:</strong> ${businessInfo.ifscCode}</p>` : ''}
                ${businessInfo.upiId ? `<p><strong>UPI:</strong> ${businessInfo.upiId}</p>` : ''}
              </div>
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