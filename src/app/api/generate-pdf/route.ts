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

    // Launch Puppeteer browser
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
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Set viewport for consistent rendering
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 2
    });

    // Generate the HTML content for the invoice
    const htmlContent = generateInvoiceHTML(invoice);

    // Set the HTML content
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait for any images to load
    await page.waitForFunction(() => {
      const images = Array.from(document.images);
      return images.every(img => img.complete);
    }, { timeout: 10000 }).catch(() => {
      // Continue if images don't load within timeout
      console.warn('Some images may not have loaded completely');
    });

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
      preferCSSPageSize: true
    });

    await browser.close();

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`
      }
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
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
      <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'PT Sans', sans-serif;
          line-height: 1.5;
          color: #212529;
          background: white;
        }
        
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .invoice-header {
          background: #f8f9fa;
          padding: 2rem;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 2rem;
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
          margin-bottom: 1rem;
        }
        
        .logo-image {
          width: 120px;
          height: 60px;
          object-fit: contain;
          margin-bottom: 1rem;
          border-radius: 4px;
        }
        
        .business-name {
          font-size: 1.5rem;
          font-weight: bold;
          color: #3F51B5;
          margin-bottom: 0.5rem;
        }
        
        .address-line {
          font-size: 0.875rem;
          color: #6c757d;
          margin-bottom: 0.25rem;
        }
        
        .gstin-highlight {
          background: #e3f2fd;
          color: #3F51B5;
          font-weight: bold;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          display: inline-block;
          margin-top: 0.5rem;
          font-size: 0.875rem;
        }
        
        .invoice-title-section {
          text-align: right;
          flex-shrink: 0;
        }
        
        .invoice-title {
          font-size: 2.5rem;
          font-weight: bold;
          color: #212529;
          margin-bottom: 0.5rem;
        }
        
        .invoice-number {
          font-size: 1rem;
          color: #6c757d;
          margin-bottom: 1rem;
        }
        
        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          margin-bottom: 1rem;
          display: inline-block;
        }
        
        .status-paid { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status-sent { background: #cce5ff; color: #004085; border: 1px solid #99d6ff; }
        .status-overdue { background: #f8d7da; color: #721c24; border: 1px solid #f1aeb5; }
        .status-draft { background: #e2e3e5; color: #383d41; border: 1px solid #d6d8db; }
        .status-cancelled { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
        
        .date-info {
          font-size: 0.875rem;
          margin-bottom: 0.25rem;
        }
        
        .invoice-content {
          padding: 2rem;
        }
        
        .bill-to-section {
          margin-bottom: 2rem;
        }
        
        .section-title {
          font-size: 1.125rem;
          font-weight: bold;
          color: #3F51B5;
          margin-bottom: 0.5rem;
        }
        
        .client-name {
          font-size: 1.125rem;
          font-weight: bold;
          color: #3F51B5;
          margin-bottom: 0.5rem;
        }
        
        .line-items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 2rem;
        }
        
        .table-header {
          background: #f8f9fa;
        }
        
        .table-header th {
          padding: 0.75rem 0.5rem;
          text-align: left;
          font-weight: bold;
          font-size: 0.875rem;
          color: #212529;
          border-bottom: 2px solid #dee2e6;
        }
        
        .table-header th:first-child { text-align: left; }
        .table-header th:last-child,
        .table-header th:nth-last-child(2) { text-align: right; }
        
        .line-item-row td {
          padding: 0.75rem 0.5rem;
          font-size: 0.875rem;
          border-bottom: 1px solid #f1f3f4;
        }
        
        .line-item-row td:first-child { text-align: left; }
        .line-item-row td:last-child,
        .line-item-row td:nth-last-child(2) { text-align: right; }
        
        .totals-section {
          display: flex;
          justify-content: space-between;
          gap: 2rem;
          margin-bottom: 2rem;
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
          padding: 0.25rem 0;
          font-size: 0.875rem;
        }
        
        .total-row.grand-total {
          border-top: 2px solid #dee2e6;
          padding-top: 0.75rem;
          margin-top: 0.5rem;
          font-size: 1.125rem;
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
          padding-top: 1.5rem;
          margin-top: 1.5rem;
        }
        
        .payment-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-top: 0.75rem;
        }
        
        .payment-item {
          font-size: 0.875rem;
          color: #6c757d;
        }
        
        .payment-item strong {
          color: #212529;
        }
        
        @media print {
          body { margin: 0; }
          .invoice-container { 
            box-shadow: none; 
            border-radius: 0;
            max-width: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header Section -->
        <div class="invoice-header">
          <div class="biller-info">
            ${invoice.billerInfo.logoUrl 
              ? `<img src="${invoice.billerInfo.logoUrl}" alt="Logo" class="logo-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                 <div class="logo-placeholder" style="display: none;">LOGO</div>`
              : `<div class="logo-placeholder">LOGO</div>`
            }
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
        
        <!-- Content Section -->
        <div class="invoice-content">
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
      </div>
    </body>
    </html>
  `;
}