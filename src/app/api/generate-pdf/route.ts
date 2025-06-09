import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import type { Invoice } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { invoice, options = {} } = await request.json();
    
    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice data is required' },
        { status: 400 }
      );
    }

    console.log('Starting PDF generation for invoice:', invoice.invoiceNumber);

    // Launch Puppeteer browser with more robust configuration
    const browser = await puppeteer.launch({
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
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images'
      ],
      timeout: 60000
    });

    console.log('Browser launched successfully');

    const page = await browser.newPage();

    // Set viewport for consistent rendering
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 1
    });

    console.log('Page created and viewport set');

    // Generate the HTML content for the invoice
    const htmlContent = generateInvoiceHTML(invoice);

    console.log('HTML content generated');

    // Set the HTML content with a longer timeout
    await page.setContent(htmlContent, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    console.log('HTML content set on page');

    // Wait a bit for any CSS to apply
    await page.waitForTimeout(1000);

    console.log('Starting PDF generation');

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      },
      preferCSSPageSize: false,
      timeout: 30000
    });

    console.log('PDF generated successfully');

    await browser.close();

    console.log('Browser closed');

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`
      }
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to generate PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function generateInvoiceHTML(invoice: Invoice): string {
  const invoiceDate = invoice.invoiceDate instanceof Date 
    ? invoice.invoiceDate 
    : new Date(invoice.invoiceDate);
  const dueDate = invoice.dueDate instanceof Date 
    ? invoice.dueDate 
    : new Date(invoice.dueDate);
  
  const currencySymbol = invoice.currency === "INR" ? "Rs." : (invoice.currency || "Rs.");

  // Calculate tax percentages for display
  const taxRate = invoice.lineItems[0]?.taxRate || 18;
  const cgstRate = taxRate / 2;
  const sgstRate = taxRate / 2;
  const igstRate = taxRate;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice ${invoice.invoiceNumber}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: Arial, sans-serif;
          line-height: 1.5;
          color: #212529;
          background: white;
          font-size: 14px;
        }
        
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 20px;
        }
        
        .invoice-header {
          background: #f8f9fa;
          padding: 30px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 30px;
          margin-bottom: 30px;
          border-radius: 8px;
        }
        
        .biller-info {
          flex: 1;
        }
        
        .logo-placeholder {
          width: 120px;
          height: 60px;
          background: #e9ecef;
          border: 2px dashed #dee2e6;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6c757d;
          font-size: 12px;
          margin-bottom: 15px;
        }
        
        .business-name {
          font-size: 24px;
          font-weight: bold;
          color: #3F51B5;
          margin-bottom: 8px;
        }
        
        .address-line {
          font-size: 14px;
          color: #6c757d;
          margin-bottom: 4px;
        }
        
        .gstin-highlight {
          background: #e3f2fd;
          color: #3F51B5;
          font-weight: bold;
          padding: 6px 12px;
          border-radius: 4px;
          display: inline-block;
          margin-top: 8px;
          font-size: 14px;
        }
        
        .invoice-title-section {
          text-align: right;
          flex-shrink: 0;
        }
        
        .invoice-title {
          font-size: 40px;
          font-weight: bold;
          color: #212529;
          margin-bottom: 8px;
        }
        
        .invoice-number {
          font-size: 16px;
          color: #6c757d;
          margin-bottom: 15px;
        }
        
        .status-badge {
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          margin-bottom: 15px;
          display: inline-block;
        }
        
        .status-paid { background: #d4edda; color: #155724; }
        .status-sent { background: #cce5ff; color: #004085; }
        .status-overdue { background: #f8d7da; color: #721c24; }
        .status-draft { background: #e2e3e5; color: #383d41; }
        .status-cancelled { background: #fff3cd; color: #856404; }
        
        .date-info {
          font-size: 14px;
          margin-bottom: 4px;
        }
        
        .bill-to-section {
          margin-bottom: 30px;
        }
        
        .section-title {
          font-size: 18px;
          font-weight: bold;
          color: #3F51B5;
          margin-bottom: 8px;
        }
        
        .client-name {
          font-size: 18px;
          font-weight: bold;
          color: #3F51B5;
          margin-bottom: 8px;
        }
        
        .line-items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        
        .table-header {
          background: #f8f9fa;
        }
        
        .table-header th {
          padding: 12px 8px;
          text-align: left;
          font-weight: bold;
          font-size: 14px;
          color: #212529;
          border-bottom: 2px solid #dee2e6;
        }
        
        .table-header th:nth-child(3),
        .table-header th:nth-child(4) { 
          text-align: right; 
        }
        
        .line-item-row td {
          padding: 12px 8px;
          font-size: 14px;
          border-bottom: 1px solid #f1f3f4;
        }
        
        .line-item-row td:nth-child(3),
        .line-item-row td:nth-child(4) { 
          text-align: right; 
        }
        
        .totals-section {
          display: flex;
          justify-content: space-between;
          gap: 30px;
          margin-bottom: 30px;
        }
        
        .notes-section {
          flex: 1;
        }
        
        .totals-table {
          min-width: 300px;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          font-size: 14px;
        }
        
        .total-row.grand-total {
          border-top: 2px solid #dee2e6;
          padding-top: 12px;
          margin-top: 8px;
          font-size: 18px;
          font-weight: bold;
        }
        
        .total-label {
          color: #6c757d;
        }
        
        .total-value {
          font-weight: 500;
          color: #212529;
        }
        
        .grand-total .total-label {
          color: #212529;
        }
        
        .grand-total .total-value {
          color: #3F51B5;
        }
        
        .payment-info {
          border-top: 1px solid #dee2e6;
          padding-top: 24px;
          margin-top: 24px;
        }
        
        .payment-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-top: 12px;
        }
        
        .payment-item {
          font-size: 14px;
          color: #6c757d;
        }
        
        .payment-item strong {
          color: #212529;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header Section -->
        <div class="invoice-header">
          <div class="biller-info">
            <div class="logo-placeholder">LOGO</div>
            <div class="business-name">${invoice.billerInfo.businessName}</div>
            <div class="address-line">${invoice.billerInfo.addressLine1}</div>
            ${invoice.billerInfo.addressLine2 ? `<div class="address-line">${invoice.billerInfo.addressLine2}</div>` : ''}
            <div class="address-line">${invoice.billerInfo.city}, ${invoice.billerInfo.state} - ${invoice.billerInfo.postalCode}</div>
            ${invoice.billerInfo.gstin ? `<div class="gstin-highlight">GSTIN: ${invoice.billerInfo.gstin}</div>` : ''}
          </div>
          
          <div class="invoice-title-section">
            <div class="invoice-title">INVOICE</div>
            <div class="invoice-number"># ${invoice.invoiceNumber}</div>
            <div class="status-badge status-${invoice.status}">${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}</div>
            <div class="date-info"><strong>Date:</strong> ${invoiceDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            <div class="date-info"><strong>Due Date:</strong> ${dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          </div>
        </div>
        
        <!-- Bill To Section -->
        <div class="bill-to-section">
          <div class="section-title">Bill To:</div>
          <div class="client-name">${invoice.client.name}</div>
          <div class="address-line">${invoice.client.addressLine1}</div>
          ${invoice.client.addressLine2 ? `<div class="address-line">${invoice.client.addressLine2}</div>` : ''}
          <div class="address-line">${invoice.client.city}, ${invoice.client.state} - ${invoice.client.postalCode}</div>
          ${invoice.client.gstin ? `<div class="address-line">GSTIN: ${invoice.client.gstin}</div>` : ''}
        </div>
        
        <!-- Line Items Table -->
        <table class="line-items-table">
          <thead class="table-header">
            <tr>
              <th style="width: 8%;">#</th>
              <th style="width: 50%;">Item/Service</th>
              <th style="width: 21%;">Rate (${currencySymbol})</th>
              <th style="width: 21%;">Amount (${currencySymbol})</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.lineItems.map((item, index) => `
              <tr class="line-item-row">
                <td>${index + 1}</td>
                <td>${item.productName}</td>
                <td>${item.rate.toFixed(2)}</td>
                <td>${item.amount.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <!-- Totals Section -->
        <div class="totals-section">
          <div class="notes-section">
            ${invoice.notes ? `
              <div class="section-title">Notes:</div>
              <div class="address-line">${invoice.notes}</div>
            ` : ''}
          </div>
          
          <div class="totals-table">
            <div class="total-row">
              <span class="total-label">Subtotal:</span>
              <span class="total-value">${currencySymbol}${invoice.subTotal.toFixed(2)}</span>
            </div>
            
            ${!invoice.isInterState ? `
              <div class="total-row">
                <span class="total-label">CGST (${cgstRate}%):</span>
                <span class="total-value">${currencySymbol}${invoice.totalCGST.toFixed(2)}</span>
              </div>
              <div class="total-row">
                <span class="total-label">SGST (${sgstRate}%):</span>
                <span class="total-value">${currencySymbol}${invoice.totalSGST.toFixed(2)}</span>
              </div>
            ` : `
              <div class="total-row">
                <span class="total-label">IGST (${igstRate}%):</span>
                <span class="total-value">${currencySymbol}${invoice.totalIGST.toFixed(2)}</span>
              </div>
            `}
            
            <div class="total-row grand-total">
              <span class="total-label">Grand Total:</span>
              <span class="total-value">${currencySymbol}${invoice.grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        <!-- Payment Information -->
        ${(invoice.billerInfo.bankName || invoice.billerInfo.upiId) ? `
          <div class="payment-info">
            <div class="section-title">Payment Information:</div>
            <div class="payment-grid">
              ${invoice.billerInfo.bankName ? `<div class="payment-item"><strong>Bank:</strong> ${invoice.billerInfo.bankName}</div>` : ''}
              ${invoice.billerInfo.accountNumber ? `<div class="payment-item"><strong>A/C No:</strong> ${invoice.billerInfo.accountNumber}</div>` : ''}
              ${invoice.billerInfo.ifscCode ? `<div class="payment-item"><strong>IFSC:</strong> ${invoice.billerInfo.ifscCode}</div>` : ''}
              ${invoice.billerInfo.upiId ? `<div class="payment-item"><strong>UPI:</strong> ${invoice.billerInfo.upiId}</div>` : ''}
            </div>
          </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;
}