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
    
    // Add custom fonts for better appearance
    this.setupFonts();
  }

  private setupFonts() {
    // Use built-in fonts with better styling
    this.doc.setFont('helvetica');
  }

  private addText(text: string, x: number, y: number, options: {
    fontSize?: number;
    fontStyle?: 'normal' | 'bold' | 'italic';
    align?: 'left' | 'center' | 'right';
    color?: string;
    maxWidth?: number;
  } = {}) {
    const { fontSize = 10, fontStyle = 'normal', align = 'left', color = '#000000', maxWidth } = options;
    
    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', fontStyle);
    this.doc.setTextColor(color);
    
    if (maxWidth) {
      const lines = this.doc.splitTextToSize(text, maxWidth);
      if (Array.isArray(lines)) {
        lines.forEach((line: string, index: number) => {
          this.doc.text(line, x, y + (index * (fontSize * 0.35)), { align });
        });
        return lines.length * (fontSize * 0.35);
      }
    }
    
    this.doc.text(text, x, y, { align });
    return fontSize * 0.35;
  }

  private addLine(x1: number, y1: number, x2: number, y2: number, color: string = '#000000', lineWidth: number = 0.1) {
    this.doc.setDrawColor(color);
    this.doc.setLineWidth(lineWidth);
    this.doc.line(x1, y1, x2, y2);
  }

  private addRect(x: number, y: number, width: number, height: number, style: 'S' | 'F' | 'FD' = 'S', fillColor?: string, strokeColor?: string) {
    if (fillColor) {
      this.doc.setFillColor(fillColor);
    }
    if (strokeColor) {
      this.doc.setDrawColor(strokeColor);
    }
    this.doc.setLineWidth(0.1);
    this.doc.rect(x, y, width, height, style);
  }

  private checkPageBreak(requiredSpace: number): boolean {
    if (this.currentY + requiredSpace > this.pageHeight - this.margin) {
      this.doc.addPage();
      this.currentY = this.margin;
      return true;
    }
    return false;
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
    
    // Notes Section
    this.addNotesSection(invoice);
    
    // Terms and Payment Info
    this.addFooterSections(invoice);

    if (download) {
      this.doc.save(filename);
    }
  }

  private addHeader(invoice: Invoice) {
    // Company Logo placeholder with better styling
    this.addRect(this.margin, this.margin, 40, 20, 'S', '#f8f9fa', '#dee2e6');
    this.addText('LOGO', this.margin + 20, this.margin + 12, { 
      align: 'center', 
      fontSize: 10, 
      color: '#6c757d',
      fontStyle: 'bold'
    });

    // Company Info with better typography
    this.addText(invoice.billerInfo.businessName, this.margin, this.margin + 35, { 
      fontSize: 18, 
      fontStyle: 'bold', 
      color: '#3F51B5' 
    });
    
    let companyY = this.margin + 45;
    this.addText(invoice.billerInfo.addressLine1, this.margin, companyY, { fontSize: 10, color: '#495057' });
    companyY += 5;
    
    if (invoice.billerInfo.addressLine2) {
      this.addText(invoice.billerInfo.addressLine2, this.margin, companyY, { fontSize: 10, color: '#495057' });
      companyY += 5;
    }
    
    this.addText(`${invoice.billerInfo.city}, ${invoice.billerInfo.state} - ${invoice.billerInfo.postalCode}`, this.margin, companyY, { fontSize: 10, color: '#495057' });
    companyY += 5;
    
    if (invoice.billerInfo.gstin) {
      this.addText(`GSTIN: ${invoice.billerInfo.gstin}`, this.margin, companyY, { fontSize: 10, color: '#495057' });
    }
    
    if (invoice.billerInfo.phone) {
      companyY += 5;
      this.addText(`Phone: ${invoice.billerInfo.phone}`, this.margin, companyY, { fontSize: 10, color: '#495057' });
    }
    
    if (invoice.billerInfo.email) {
      companyY += 5;
      this.addText(`Email: ${invoice.billerInfo.email}`, this.margin, companyY, { fontSize: 10, color: '#495057' });
    }

    // Invoice Title and Details with better styling
    this.addText('INVOICE', this.pageWidth - this.margin, this.margin + 15, { 
      fontSize: 28, 
      fontStyle: 'bold', 
      align: 'right',
      color: '#212529'
    });
    
    this.addText(`# ${invoice.invoiceNumber}`, this.pageWidth - this.margin, this.margin + 28, { 
      fontSize: 14, 
      align: 'right',
      color: '#495057'
    });
    
    // Status badge with better styling
    const statusColors = {
      paid: '#28a745',
      sent: '#007bff',
      overdue: '#dc3545',
      draft: '#6c757d',
      cancelled: '#fd7e14'
    };
    
    const statusBgColors = {
      paid: '#d4edda',
      sent: '#cce5ff',
      overdue: '#f8d7da',
      draft: '#e2e3e5',
      cancelled: '#ffeaa7'
    };
    
    // Status background
    const statusText = invoice.status.toUpperCase();
    const statusWidth = this.doc.getTextWidth(statusText) + 8;
    this.addRect(this.pageWidth - this.margin - statusWidth, this.margin + 35, statusWidth, 8, 'F', statusBgColors[invoice.status]);
    this.addText(statusText, this.pageWidth - this.margin - (statusWidth/2), this.margin + 41, { 
      fontSize: 9, 
      align: 'center', 
      color: statusColors[invoice.status],
      fontStyle: 'bold'
    });

    // Dates with better formatting
    const invoiceDate = invoice.invoiceDate instanceof Date ? invoice.invoiceDate : new Date(invoice.invoiceDate);
    const dueDate = invoice.dueDate instanceof Date ? invoice.dueDate : new Date(invoice.dueDate);
    
    this.addText(`Date: ${format(invoiceDate, 'dd MMM, yyyy')}`, this.pageWidth - this.margin, this.margin + 52, { 
      fontSize: 11, 
      align: 'right',
      color: '#495057'
    });
    this.addText(`Due Date: ${format(dueDate, 'dd MMM, yyyy')}`, this.pageWidth - this.margin, this.margin + 62, { 
      fontSize: 11, 
      align: 'right',
      color: '#495057'
    });

    this.currentY = Math.max(companyY + 15, this.margin + 75);
  }

  private addBillToSection(invoice: Invoice) {
    this.checkPageBreak(40);
    
    this.addText('Bill To:', this.margin, this.currentY, { fontSize: 13, fontStyle: 'bold', color: '#212529' });
    this.currentY += 10;
    
    this.addText(invoice.client.name, this.margin, this.currentY, { 
      fontSize: 12, 
      fontStyle: 'bold', 
      color: '#3F51B5' 
    });
    this.currentY += 7;
    
    this.addText(invoice.client.addressLine1, this.margin, this.currentY, { fontSize: 10, color: '#495057' });
    this.currentY += 5;
    
    if (invoice.client.addressLine2) {
      this.addText(invoice.client.addressLine2, this.margin, this.currentY, { fontSize: 10, color: '#495057' });
      this.currentY += 5;
    }
    
    this.addText(`${invoice.client.city}, ${invoice.client.state} - ${invoice.client.postalCode}`, this.margin, this.currentY, { fontSize: 10, color: '#495057' });
    this.currentY += 5;
    
    if (invoice.client.gstin) {
      this.addText(`GSTIN: ${invoice.client.gstin}`, this.margin, this.currentY, { fontSize: 10, color: '#495057' });
      this.currentY += 5;
    }
    
    if (invoice.client.email) {
      this.addText(`Email: ${invoice.client.email}`, this.margin, this.currentY, { fontSize: 10, color: '#495057' });
      this.currentY += 5;
    }
    
    if (invoice.client.phone) {
      this.addText(`Phone: ${invoice.client.phone}`, this.margin, this.currentY, { fontSize: 10, color: '#495057' });
      this.currentY += 5;
    }

    this.currentY += 10;
  }

  private addLineItemsTable(invoice: Invoice) {
    this.checkPageBreak(50);
    
    const tableStartY = this.currentY;
    const rowHeight = 10;
    const headerHeight = 12;

    // Calculate table width and column positions
    const tableWidth = this.pageWidth - 2 * this.margin;
    const tableStartX = this.margin;
    const tableEndX = this.pageWidth - this.margin;

    // Table headers
    const headers = ['#', 'Item/Service', 'Qty', 'Rate (Rs.)', 'Discount (%)', 'Amount (Rs.)'];
    
    // Fixed column widths with proper spacing to prevent overlapping
    const columnWidths = [10, 55, 15, 28, 25, 37]; // Total: 170mm (matches table width)
    const columnPositions = [tableStartX];
    
    for (let i = 0; i < columnWidths.length - 1; i++) {
      columnPositions.push(columnPositions[i] + columnWidths[i]);
    }

    // Header background - ensure it covers the full table width
    this.addRect(tableStartX, tableStartY, tableWidth, headerHeight, 'F', '#f8f9fa');
    this.addRect(tableStartX, tableStartY, tableWidth, headerHeight, 'S', undefined, '#dee2e6');
    
    // Header text with better typography and proper spacing
    headers.forEach((header, index) => {
      const align = index === 0 ? 'left' : index === 1 ? 'left' : 'right';
      let x: number;
      
      if (align === 'right') {
        // For right-aligned columns, position text at the right edge minus padding
        if (index === headers.length - 1) {
          // Last column (Amount) - align to table end with proper padding
          x = tableEndX - 2;
        } else {
          // Other right-aligned columns - align to column end with padding
          x = columnPositions[index] + columnWidths[index] - 2;
        }
      } else {
        // Left-aligned columns - start with padding
        x = columnPositions[index] + 2;
      }
      
      this.addText(header, x, tableStartY + 8, { 
        fontSize: 9, 
        fontStyle: 'bold', 
        align,
        color: '#495057'
      });
    });

    this.currentY = tableStartY + headerHeight;

    // Table rows with better formatting
    invoice.lineItems.forEach((item, index) => {
      this.checkPageBreak(rowHeight + 5);
      
      const rowY = this.currentY;
      
      // Alternate row background - ensure it covers the full table width
      if (index % 2 === 1) {
        this.addRect(tableStartX, rowY, tableWidth, rowHeight, 'F', '#f8f9fa');
      }

      // Row data with proper formatting
      const rowData = [
        (index + 1).toString(),
        item.productName,
        item.quantity.toString(),
        item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        `${item.discountPercentage.toFixed(1)}%`,
        item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      ];

      rowData.forEach((data, colIndex) => {
        const align = colIndex === 0 ? 'left' : colIndex === 1 ? 'left' : 'right';
        let x: number;
        
        if (align === 'right') {
          // For right-aligned columns, position text at the right edge minus padding
          if (colIndex === rowData.length - 1) {
            // Last column (Amount) - align to table end with proper padding
            x = tableEndX - 2;
          } else {
            // Other right-aligned columns - align to column end with padding
            x = columnPositions[colIndex] + columnWidths[colIndex] - 2;
          }
        } else {
          // Left-aligned columns - start with padding
          x = columnPositions[colIndex] + 2;
        }
        
        // Truncate long text for item name to prevent overflow
        let displayText = data;
        if (colIndex === 1 && data.length > 20) {
          displayText = data.substring(0, 18) + '...';
        }
        
        this.addText(displayText, x, rowY + 7, { 
          fontSize: 9, 
          align,
          color: '#212529'
        });
      });

      this.currentY += rowHeight;
    });

    // Table border with better styling - ensure full coverage
    this.addRect(tableStartX, tableStartY, tableWidth, this.currentY - tableStartY, 'S', undefined, '#dee2e6');
    
    // Vertical lines with proper positioning to separate columns clearly
    for (let i = 1; i < columnPositions.length; i++) {
      this.addLine(columnPositions[i], tableStartY, columnPositions[i], this.currentY, '#dee2e6');
    }

    this.currentY += 15;
  }

  private addTotalsSection(invoice: Invoice) {
    this.checkPageBreak(80);
    
    // Calculate totals box dimensions
    const boxWidth = 80;
    const boxHeight = 50;
    const boxX = this.pageWidth - this.margin - boxWidth;
    const boxY = this.currentY;
    
    // Draw the totals container box
    this.addRect(boxX, boxY, boxWidth, boxHeight, 'F', '#f8f9fa');
    this.addRect(boxX, boxY, boxWidth, boxHeight, 'S', undefined, '#dee2e6');
    
    // Text positioning within the box
    const labelStartX = boxX + 5;
    const valueEndX = boxX + boxWidth - 5;
    let textY = boxY + 12;
    const lineSpacing = 8;
    
    // Subtotal
    this.addText('Subtotal:', labelStartX, textY, { 
      fontSize: 10, 
      color: '#495057' 
    });
    this.addText(`Rs. ${invoice.subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valueEndX, textY, { 
      fontSize: 10, 
      align: 'right',
      color: '#212529'
    });
    textY += lineSpacing;

    // Tax lines
    if (!invoice.isInterState) {
      // CGST
      this.addText('CGST:', labelStartX, textY, { 
        fontSize: 10, 
        color: '#495057' 
      });
      this.addText(`Rs. ${invoice.totalCGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valueEndX, textY, { 
        fontSize: 10, 
        align: 'right',
        color: '#212529'
      });
      textY += lineSpacing;

      // SGST
      this.addText('SGST:', labelStartX, textY, { 
        fontSize: 10, 
        color: '#495057' 
      });
      this.addText(`Rs. ${invoice.totalSGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valueEndX, textY, { 
        fontSize: 10, 
        align: 'right',
        color: '#212529'
      });
      textY += lineSpacing;
    } else {
      // IGST
      this.addText('IGST:', labelStartX, textY, { 
        fontSize: 10, 
        color: '#495057' 
      });
      this.addText(`Rs. ${invoice.totalIGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valueEndX, textY, { 
        fontSize: 10, 
        align: 'right',
        color: '#212529'
      });
      textY += lineSpacing;
    }

    // Separator line
    this.addLine(labelStartX, textY - 3, valueEndX, textY - 3, '#495057', 0.5);
    textY += 2;

    // Grand Total
    this.addText('Grand Total:', labelStartX, textY, { 
      fontSize: 12, 
      fontStyle: 'bold', 
      color: '#212529' 
    });
    this.addText(`Rs. ${invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valueEndX, textY, { 
      fontSize: 12, 
      fontStyle: 'bold', 
      color: '#3F51B5', 
      align: 'right'
    });
    
    // Update currentY to be below the totals box
    this.currentY = boxY + boxHeight + 20;
  }

  private addNotesSection(invoice: Invoice) {
    if (invoice.notes) {
      this.checkPageBreak(30);
      
      this.addText('Notes:', this.margin, this.currentY, { fontSize: 12, fontStyle: 'bold', color: '#212529' });
      this.currentY += 8;
      
      const notesHeight = this.addText(invoice.notes, this.margin, this.currentY, { 
        fontSize: 10, 
        color: '#495057',
        maxWidth: this.pageWidth - 2 * this.margin - 20
      });
      this.currentY += notesHeight + 10;
    }
  }

  private addFooterSections(invoice: Invoice) {
    // Terms & Conditions
    if (invoice.termsAndConditions) {
      this.checkPageBreak(30);
      
      this.addText('Terms & Conditions:', this.margin, this.currentY, { fontSize: 12, fontStyle: 'bold', color: '#212529' });
      this.currentY += 8;
      
      const termsHeight = this.addText(invoice.termsAndConditions, this.margin, this.currentY, { 
        fontSize: 10, 
        color: '#495057',
        maxWidth: this.pageWidth - 2 * this.margin - 20
      });
      this.currentY += termsHeight + 15;
    }

    // Payment Information - Optimized with reduced spacing
    if (invoice.billerInfo.bankName || invoice.billerInfo.upiId) {
      this.checkPageBreak(25);
      
      this.addText('Payment Information:', this.margin, this.currentY, { fontSize: 12, fontStyle: 'bold', color: '#212529' });
      this.currentY += 6; // Reduced from 10 to 6

      // Calculate required height based on content
      let contentLines = 0;
      if (invoice.billerInfo.bankName) contentLines++;
      if (invoice.billerInfo.ifscCode || invoice.billerInfo.upiId) contentLines++;
      
      const paymentBoxHeight = Math.max(18, contentLines * 6 + 8); // Dynamic height with minimum
      
      // Payment info background with reduced height
      this.addRect(this.margin, this.currentY - 2, this.pageWidth - 2 * this.margin, paymentBoxHeight, 'F', '#f8f9fa');
      this.addRect(this.margin, this.currentY - 2, this.pageWidth - 2 * this.margin, paymentBoxHeight, 'S', undefined, '#dee2e6');

      const leftCol = this.margin + 3; // Reduced padding
      const rightCol = this.pageWidth / 2;

      // Compact layout with reduced line spacing
      if (invoice.billerInfo.bankName) {
        this.addText(`Bank: ${invoice.billerInfo.bankName}`, leftCol, this.currentY + 2, { fontSize: 9, color: '#495057' });
        if (invoice.billerInfo.accountNumber) {
          this.addText(`A/C No: ${invoice.billerInfo.accountNumber}`, rightCol, this.currentY + 2, { fontSize: 9, color: '#495057' });
        }
        this.currentY += 5; // Reduced from 6 to 5
      }

      if (invoice.billerInfo.ifscCode) {
        this.addText(`IFSC: ${invoice.billerInfo.ifscCode}`, leftCol, this.currentY + 2, { fontSize: 9, color: '#495057' });
        if (invoice.billerInfo.upiId) {
          this.addText(`UPI: ${invoice.billerInfo.upiId}`, rightCol, this.currentY + 2, { fontSize: 9, color: '#495057' });
        }
        this.currentY += 5; // Reduced from 6 to 5
      } else if (invoice.billerInfo.upiId && !invoice.billerInfo.ifscCode) {
        // If only UPI exists without IFSC
        this.addText(`UPI: ${invoice.billerInfo.upiId}`, leftCol, this.currentY + 2, { fontSize: 9, color: '#495057' });
        this.currentY += 5;
      }
      
      this.currentY += 8; // Reduced from 15 to 8
    }

    // Footer with reduced spacing
    this.addLine(this.margin, this.pageHeight - 25, this.pageWidth - this.margin, this.pageHeight - 25, '#dee2e6'); // Moved up
    this.addText('Thank you for your business!', this.pageWidth / 2, this.pageHeight - 15, { // Moved up
      fontSize: 10, // Reduced font size
      align: 'center', 
      color: '#6c757d',
      fontStyle: 'italic'
    });
  }

  public getBlob(): Blob {
    return this.doc.output('blob');
  }

  public getDataUri(): string {
    return this.doc.output('datauristring');
  }
}