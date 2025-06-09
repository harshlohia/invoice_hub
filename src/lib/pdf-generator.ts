import jsPDF from 'jspdf';
import type { Invoice } from '@/lib/types';
import { format } from 'date-fns';

export interface PDFGenerationOptions {
  filename?: string;
  download?: boolean;
}

export class InvoicePDFGenerator {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 20;
  private currentY: number = 20;

  constructor() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
  }

  private addText(text: string, x: number, y: number, options: {
    fontSize?: number;
    fontStyle?: 'normal' | 'bold';
    align?: 'left' | 'center' | 'right';
    color?: string;
  } = {}) {
    const { fontSize = 10, fontStyle = 'normal', align = 'left', color = '#000000' } = options;
    
    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', fontStyle);
    this.doc.setTextColor(color);
    this.doc.text(text, x, y, { align });
  }

  private addLine(x1: number, y1: number, x2: number, y2: number, color: string = '#000000') {
    this.doc.setDrawColor(color);
    this.doc.line(x1, y1, x2, y2);
  }

  private addRect(x: number, y: number, width: number, height: number, style: 'S' | 'F' | 'FD' = 'S', fillColor?: string) {
    if (fillColor) {
      this.doc.setFillColor(fillColor);
    }
    this.doc.rect(x, y, width, height, style);
  }

  public generateInvoicePDF(invoice: Invoice, options: PDFGenerationOptions = {}): void {
    const { filename = `invoice-${invoice.invoiceNumber}.pdf`, download = true } = options;

    // Header Section
    this.addHeader(invoice);
    
    // Bill To Section
    this.addBillToSection(invoice);
    
    // Line Items Table
    this.addLineItemsTable(invoice);
    
    // Totals Section
    this.addTotalsSection(invoice);
    
    // Terms and Payment Info
    this.addFooterSections(invoice);

    if (download) {
      this.doc.save(filename);
    }
  }

  private addHeader(invoice: Invoice) {
    // Company Logo placeholder
    this.addRect(this.margin, this.margin, 40, 20, 'S');
    this.addText('Logo', this.margin + 20, this.margin + 12, { align: 'center', fontSize: 8, color: '#666666' });

    // Company Info
    this.addText(invoice.billerInfo.businessName, this.margin, this.margin + 35, { fontSize: 16, fontStyle: 'bold', color: '#3F51B5' });
    this.addText(invoice.billerInfo.addressLine1, this.margin, this.margin + 42, { fontSize: 9 });
    if (invoice.billerInfo.addressLine2) {
      this.addText(invoice.billerInfo.addressLine2, this.margin, this.margin + 47, { fontSize: 9 });
    }
    this.addText(`${invoice.billerInfo.city}, ${invoice.billerInfo.state} - ${invoice.billerInfo.postalCode}`, this.margin, this.margin + 52, { fontSize: 9 });
    this.addText(`GSTIN: ${invoice.billerInfo.gstin}`, this.margin, this.margin + 57, { fontSize: 9 });

    // Invoice Title and Details
    this.addText('INVOICE', this.pageWidth - this.margin, this.margin + 10, { fontSize: 24, fontStyle: 'bold', align: 'right' });
    this.addText(`# ${invoice.invoiceNumber}`, this.pageWidth - this.margin, this.margin + 20, { fontSize: 12, align: 'right' });
    
    // Status badge
    const statusColors = {
      paid: '#4CAF50',
      sent: '#2196F3',
      overdue: '#F44336',
      draft: '#9E9E9E',
      cancelled: '#FF9800'
    };
    this.addText(`● ${invoice.status.toUpperCase()}`, this.pageWidth - this.margin, this.margin + 28, { 
      fontSize: 10, 
      align: 'right', 
      color: statusColors[invoice.status] || '#000000'
    });

    // Dates
    this.addText(`Date: ${format(invoice.invoiceDate instanceof Date ? invoice.invoiceDate : new Date(invoice.invoiceDate), 'dd MMM, yyyy')}`, this.pageWidth - this.margin, this.margin + 40, { fontSize: 10, align: 'right' });
    this.addText(`Due Date: ${format(invoice.dueDate instanceof Date ? invoice.dueDate : new Date(invoice.dueDate), 'dd MMM, yyyy')}`, this.pageWidth - this.margin, this.margin + 47, { fontSize: 10, align: 'right' });

    this.currentY = this.margin + 70;
  }

  private addBillToSection(invoice: Invoice) {
    this.addText('Bill To:', this.margin, this.currentY, { fontSize: 12, fontStyle: 'bold' });
    this.currentY += 8;
    
    this.addText(invoice.client.name, this.margin, this.currentY, { fontSize: 11, fontStyle: 'bold', color: '#3F51B5' });
    this.currentY += 6;
    
    this.addText(invoice.client.addressLine1, this.margin, this.currentY, { fontSize: 9 });
    this.currentY += 5;
    
    if (invoice.client.addressLine2) {
      this.addText(invoice.client.addressLine2, this.margin, this.currentY, { fontSize: 9 });
      this.currentY += 5;
    }
    
    this.addText(`${invoice.client.city}, ${invoice.client.state} - ${invoice.client.postalCode}`, this.margin, this.currentY, { fontSize: 9 });
    this.currentY += 5;
    
    if (invoice.client.gstin) {
      this.addText(`GSTIN: ${invoice.client.gstin}`, this.margin, this.currentY, { fontSize: 9 });
      this.currentY += 5;
    }

    this.currentY += 10;
  }

  private addLineItemsTable(invoice: Invoice) {
    const tableStartY = this.currentY;
    const rowHeight = 8;
    const headerHeight = 10;

    // Table headers
    const headers = ['#', 'Item/Service', 'Qty', 'Rate (Rs.)', 'Discount (%)', 'Amount (Rs.)'];
    const columnWidths = [10, 70, 15, 25, 25, 25];
    const columnPositions = [this.margin];
    
    for (let i = 0; i < columnWidths.length - 1; i++) {
      columnPositions.push(columnPositions[i] + columnWidths[i]);
    }

    // Header background
    this.addRect(this.margin, tableStartY, this.pageWidth - 2 * this.margin, headerHeight, 'F', '#f5f5f5');
    
    // Header text
    headers.forEach((header, index) => {
      const align = index === 0 ? 'left' : index === 1 ? 'left' : 'right';
      const x = align === 'right' ? columnPositions[index] + columnWidths[index] - 2 : columnPositions[index] + 2;
      this.addText(header, x, tableStartY + 7, { fontSize: 9, fontStyle: 'bold', align });
    });

    this.currentY = tableStartY + headerHeight;

    // Table rows
    invoice.lineItems.forEach((item, index) => {
      const rowY = this.currentY;
      
      // Alternate row background
      if (index % 2 === 1) {
        this.addRect(this.margin, rowY, this.pageWidth - 2 * this.margin, rowHeight, 'F', '#fafafa');
      }

      // Row data
      const rowData = [
        (index + 1).toString(),
        item.productName,
        item.quantity.toString(),
        item.rate.toFixed(2),
        `${item.discountPercentage.toFixed(2)}%`,
        item.amount.toFixed(2)
      ];

      rowData.forEach((data, colIndex) => {
        const align = colIndex === 0 ? 'left' : colIndex === 1 ? 'left' : 'right';
        const x = align === 'right' ? columnPositions[colIndex] + columnWidths[colIndex] - 2 : columnPositions[colIndex] + 2;
        
        // Truncate long text for item name
        let displayText = data;
        if (colIndex === 1 && data.length > 35) {
          displayText = data.substring(0, 32) + '...';
        }
        
        this.addText(displayText, x, rowY + 6, { fontSize: 9, align });
      });

      this.currentY += rowHeight;
    });

    // Table border
    this.addRect(this.margin, tableStartY, this.pageWidth - 2 * this.margin, this.currentY - tableStartY, 'S');
    
    // Vertical lines
    for (let i = 1; i < columnPositions.length; i++) {
      this.addLine(columnPositions[i], tableStartY, columnPositions[i], this.currentY);
    }

    this.currentY += 10;
  }

  private addTotalsSection(invoice: Invoice) {
    const totalsX = this.pageWidth - 60;
    const labelX = totalsX - 40;

    // Subtotal
    this.addText('Subtotal:', labelX, this.currentY, { fontSize: 10 });
    this.addText(`Rs.${invoice.subTotal.toFixed(2)}`, totalsX, this.currentY, { fontSize: 10, align: 'right' });
    this.currentY += 6;

    // Tax details
    if (!invoice.isInterState) {
      this.addText('CGST:', labelX, this.currentY, { fontSize: 10 });
      this.addText(`Rs.${invoice.totalCGST.toFixed(2)}`, totalsX, this.currentY, { fontSize: 10, align: 'right' });
      this.currentY += 6;

      this.addText('SGST:', labelX, this.currentY, { fontSize: 10 });
      this.addText(`Rs.${invoice.totalSGST.toFixed(2)}`, totalsX, this.currentY, { fontSize: 10, align: 'right' });
      this.currentY += 6;
    } else {
      this.addText('IGST:', labelX, this.currentY, { fontSize: 10 });
      this.addText(`Rs.${invoice.totalIGST.toFixed(2)}`, totalsX, this.currentY, { fontSize: 10, align: 'right' });
      this.currentY += 6;
    }

    // Line above grand total
    this.addLine(labelX, this.currentY, totalsX, this.currentY);
    this.currentY += 4;

    // Grand Total
    this.addText('Grand Total:', labelX, this.currentY, { fontSize: 12, fontStyle: 'bold' });
    this.addText(`Rs.${invoice.grandTotal.toFixed(2)}`, totalsX, this.currentY, { fontSize: 12, fontStyle: 'bold', color: '#3F51B5', align: 'right' });
    this.currentY += 15;
  }

  private addFooterSections(invoice: Invoice) {
    // Terms & Conditions
    if (invoice.termsAndConditions) {
      this.addText('Terms & Conditions:', this.margin, this.currentY, { fontSize: 11, fontStyle: 'bold' });
      this.currentY += 6;
      
      const terms = this.doc.splitTextToSize(invoice.termsAndConditions, 100);
      terms.forEach((line: string) => {
        this.addText(line, this.margin, this.currentY, { fontSize: 9 });
        this.currentY += 5;
      });
      this.currentY += 5;
    }

    // Payment Information
    if (invoice.billerInfo.bankName || invoice.billerInfo.upiId) {
      this.addText('Payment Information:', this.margin, this.currentY, { fontSize: 11, fontStyle: 'bold' });
      this.currentY += 8;

      const leftCol = this.margin;
      const rightCol = this.pageWidth / 2;

      if (invoice.billerInfo.bankName) {
        this.addText(`Bank: ${invoice.billerInfo.bankName}`, leftCol, this.currentY, { fontSize: 9 });
        if (invoice.billerInfo.accountNumber) {
          this.addText(`A/C No: ${invoice.billerInfo.accountNumber}`, rightCol, this.currentY, { fontSize: 9 });
        }
        this.currentY += 5;
      }

      if (invoice.billerInfo.ifscCode) {
        this.addText(`IFSC: ${invoice.billerInfo.ifscCode}`, leftCol, this.currentY, { fontSize: 9 });
        if (invoice.billerInfo.upiId) {
          this.addText(`UPI: ${invoice.billerInfo.upiId}`, rightCol, this.currentY, { fontSize: 9 });
        }
        this.currentY += 5;
      }
    }
  }

  public getBlob(): Blob {
    return this.doc.output('blob');
  }

  public getDataUri(): string {
    return this.doc.output('datauristring');
  }
}