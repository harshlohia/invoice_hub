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
  private themeColor: string = '#3F51B5'; // Deep blue theme color

  constructor() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    
    // Set up fonts
    this.setupFonts();
  }

  private setupFonts() {
    // Use Helvetica as the closest to the design
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

    // Header Section - Clean design matching the image
    this.addHeader(invoice);
    
    // Bill To Section
    this.addBillToSection(invoice);
    
    // Line Items Table - Clean table design
    this.addLineItemsTable(invoice);
    
    // Totals Section - Right aligned
    this.addTotalsSection(invoice);
    
    // Terms and Payment Info
    this.addFooterSections(invoice);

    if (download) {
      this.doc.save(filename);
    }
  }

  private addHeader(invoice: Invoice) {
    // Header layout matching the design exactly
    const headerY = this.margin;
    
    // Logo placeholder - simple rectangle
    this.addRect(this.margin, headerY, 25, 20, 'S', undefined, '#dee2e6');
    this.addText('LOGO', this.margin + 12.5, headerY + 12, { 
      align: 'center', 
      fontSize: 8, 
      color: '#6c757d'
    });

    // Company name and details - positioned next to logo
    const companyStartX = this.margin + 30;
    this.addText(invoice.billerInfo.businessName, companyStartX, headerY + 8, { 
      fontSize: 14, 
      fontStyle: 'bold', 
      color: this.themeColor
    });
    
    let companyY = headerY + 15;
    this.addText(invoice.billerInfo.addressLine1, companyStartX, companyY, { fontSize: 9, color: '#6c757d' });
    companyY += 4;
    
    if (invoice.billerInfo.addressLine2) {
      this.addText(invoice.billerInfo.addressLine2, companyStartX, companyY, { fontSize: 9, color: '#6c757d' });
      companyY += 4;
    }
    
    this.addText(`${invoice.billerInfo.city}, ${invoice.billerInfo.state} - ${invoice.billerInfo.postalCode}`, companyStartX, companyY, { fontSize: 9, color: '#6c757d' });
    
    if (invoice.billerInfo.gstin) {
      companyY += 4;
      this.addText(`GSTIN: ${invoice.billerInfo.gstin}`, companyStartX, companyY, { fontSize: 9, color: '#6c757d' });
    }

    // Invoice title and details - right aligned
    this.addText('INVOICE', this.pageWidth - this.margin - 5, headerY + 12, { 
      fontSize: 28, 
      fontStyle: 'bold', 
      align: 'right',
      color: '#212529'
    });
    
    this.addText(`# ${invoice.invoiceNumber}`, this.pageWidth - this.margin - 5, headerY + 22, { 
      fontSize: 12, 
      align: 'right',
      color: '#6c757d'
    });
    
    // Status badge - clean design
    const statusColors = {
      paid: '#28a745',
      sent: '#007bff',
      overdue: '#dc3545',
      draft: '#6c757d',
      cancelled: '#fd7e14'
    };
    
    const statusText = invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1);
    const statusWidth = this.doc.getTextWidth(statusText) + 8;
    this.addRect(this.pageWidth - this.margin - statusWidth - 5, headerY + 28, statusWidth, 6, 'S', undefined, statusColors[invoice.status]);
    this.addText(statusText, this.pageWidth - this.margin - (statusWidth/2) - 5, headerY + 32, { 
      fontSize: 8, 
      align: 'center', 
      color: statusColors[invoice.status]
    });

    // Dates - positioned below status
    const invoiceDate = invoice.invoiceDate instanceof Date ? invoice.invoiceDate : new Date(invoice.invoiceDate);
    const dueDate = invoice.dueDate instanceof Date ? invoice.dueDate : new Date(invoice.dueDate);
    
    this.addText(`Date: ${format(invoiceDate, 'dd MMM, yyyy')}`, this.pageWidth - this.margin - 5, headerY + 40, { 
      fontSize: 9, 
      align: 'right',
      color: '#212529'
    });
    this.addText(`Due Date: ${format(dueDate, 'dd MMM, yyyy')}`, this.pageWidth - this.margin - 5, headerY + 47, { 
      fontSize: 9, 
      align: 'right',
      color: '#212529'
    });

    this.currentY = headerY + 60;
  }

  private addBillToSection(invoice: Invoice) {
    this.checkPageBreak(30);
    
    // Bill To section with clean styling
    this.addText('Bill To:', this.margin, this.currentY, { fontSize: 11, fontStyle: 'bold', color: this.themeColor });
    this.currentY += 8;
    
    this.addText(invoice.client.name, this.margin, this.currentY, { 
      fontSize: 12, 
      fontStyle: 'bold', 
      color: this.themeColor 
    });
    this.currentY += 6;
    
    this.addText(invoice.client.addressLine1, this.margin, this.currentY, { fontSize: 9, color: '#6c757d' });
    this.currentY += 4;
    
    if (invoice.client.addressLine2) {
      this.addText(invoice.client.addressLine2, this.margin, this.currentY, { fontSize: 9, color: '#6c757d' });
      this.currentY += 4;
    }
    
    this.addText(`${invoice.client.city}, ${invoice.client.state} - ${invoice.client.postalCode}`, this.margin, this.currentY, { fontSize: 9, color: '#6c757d' });
    this.currentY += 4;
    
    if (invoice.client.gstin) {
      this.addText(`GSTIN: ${invoice.client.gstin}`, this.margin, this.currentY, { fontSize: 9, color: '#6c757d' });
      this.currentY += 4;
    }

    this.currentY += 15;
  }

  private addLineItemsTable(invoice: Invoice) {
    this.checkPageBreak(50);
    
    const tableStartY = this.currentY;
    const rowHeight = 8;
    const headerHeight = 10;

    // Table dimensions
    const tableWidth = this.pageWidth - 2 * this.margin;
    const tableStartX = this.margin;
    const tableEndX = this.pageWidth - this.margin;

    // Column widths matching the design
    const columnWidths = [8, 60, 15, 25, 22, 25];
    const columnPositions = [tableStartX];
    
    for (let i = 0; i < columnWidths.length - 1; i++) {
      columnPositions.push(columnPositions[i] + columnWidths[i]);
    }

    // Table headers - clean design with bottom border only
    const headers = ['#', 'Item/Service', 'Qty', 'Rate (Rs.)', 'Discount (%)', 'Amount (Rs.)'];
    
    headers.forEach((header, index) => {
      const align = index === 0 ? 'left' : index === 1 ? 'left' : index === 2 ? 'center' : 'right';
      let x: number;
      
      if (align === 'right') {
        if (index === headers.length - 1) {
          x = tableEndX - 2;
        } else {
          x = columnPositions[index] + columnWidths[index] - 2;
        }
      } else if (align === 'center') {
        x = columnPositions[index] + columnWidths[index] / 2;
      } else {
        x = columnPositions[index] + 2;
      }
      
      this.addText(header, x, tableStartY + 7, { 
        fontSize: 9, 
        fontStyle: 'bold', 
        align,
        color: '#212529'
      });
    });

    // Header bottom border
    this.addLine(tableStartX, tableStartY + headerHeight, tableEndX, tableStartY + headerHeight, '#dee2e6', 1);

    this.currentY = tableStartY + headerHeight + 2;

    // Table rows - clean design
    invoice.lineItems.forEach((item, index) => {
      this.checkPageBreak(rowHeight + 5);
      
      const rowY = this.currentY;

      // Row data
      const rowData = [
        (index + 1).toString(),
        item.productName,
        item.quantity.toString(),
        item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        `${item.discountPercentage.toFixed(1)}%`,
        item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      ];

      rowData.forEach((data, colIndex) => {
        const align = colIndex === 0 ? 'left' : colIndex === 1 ? 'left' : colIndex === 2 ? 'center' : 'right';
        let x: number;
        
        if (align === 'right') {
          if (colIndex === rowData.length - 1) {
            x = tableEndX - 2;
          } else {
            x = columnPositions[colIndex] + columnWidths[colIndex] - 2;
          }
        } else if (align === 'center') {
          x = columnPositions[colIndex] + columnWidths[colIndex] / 2;
        } else {
          x = columnPositions[colIndex] + 2;
        }
        
        // Truncate long text for item name
        let displayText = data;
        if (colIndex === 1 && data.length > 30) {
          displayText = data.substring(0, 28) + '...';
        }
        
        this.addText(displayText, x, rowY + 6, { 
          fontSize: 9, 
          align,
          color: '#212529'
        });
      });

      // Light bottom border for each row
      this.addLine(tableStartX, rowY + rowHeight, tableEndX, rowY + rowHeight, '#f1f3f4', 0.3);

      this.currentY += rowHeight;
    });

    this.currentY += 10;
  }

  private addTotalsSection(invoice: Invoice) {
    this.checkPageBreak(60);
    
    // Right-aligned totals section matching the design
    const totalsWidth = 70;
    const totalsX = this.pageWidth - this.margin - totalsWidth;
    let totalsY = this.currentY;
    
    const lineSpacing = 6;
    
    // Subtotal
    this.addText('Subtotal:', totalsX, totalsY, { 
      fontSize: 9, 
      color: '#6c757d' 
    });
    this.addText(`Rs.${invoice.subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, totalsX + totalsWidth - 5, totalsY, { 
      fontSize: 9, 
      align: 'right',
      color: '#212529'
    });
    totalsY += lineSpacing;

    // Tax lines
    if (!invoice.isInterState) {
      // CGST
      this.addText('CGST:', totalsX, totalsY, { 
        fontSize: 9, 
        color: '#6c757d' 
      });
      this.addText(`Rs.${invoice.totalCGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, totalsX + totalsWidth - 5, totalsY, { 
        fontSize: 9, 
        align: 'right',
        color: '#212529'
      });
      totalsY += lineSpacing;

      // SGST
      this.addText('SGST:', totalsX, totalsY, { 
        fontSize: 9, 
        color: '#6c757d' 
      });
      this.addText(`Rs.${invoice.totalSGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, totalsX + totalsWidth - 5, totalsY, { 
        fontSize: 9, 
        align: 'right',
        color: '#212529'
      });
      totalsY += lineSpacing;
    } else {
      // IGST
      this.addText('IGST:', totalsX, totalsY, { 
        fontSize: 9, 
        color: '#6c757d' 
      });
      this.addText(`Rs.${invoice.totalIGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, totalsX + totalsWidth - 5, totalsY, { 
        fontSize: 9, 
        align: 'right',
        color: '#212529'
      });
      totalsY += lineSpacing;
    }

    totalsY += 3;

    // Grand Total with emphasis
    this.addText('Grand Total:', totalsX, totalsY, { 
      fontSize: 12, 
      fontStyle: 'bold', 
      color: '#212529' 
    });
    this.addText(`Rs.${invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, totalsX + totalsWidth - 5, totalsY, { 
      fontSize: 12, 
      fontStyle: 'bold', 
      color: this.themeColor, 
      align: 'right'
    });
    
    this.currentY = totalsY + 20;
  }

  private addFooterSections(invoice: Invoice) {
    // Terms & Conditions
    if (invoice.termsAndConditions) {
      this.checkPageBreak(25);
      
      this.addText('Terms & Conditions:', this.margin, this.currentY, { 
        fontSize: 11, 
        fontStyle: 'bold', 
        color: '#212529' 
      });
      this.currentY += 6;
      
      const textHeight = this.addText(invoice.termsAndConditions, this.margin, this.currentY, { 
        fontSize: 9, 
        color: '#6c757d',
        maxWidth: this.pageWidth - 2 * this.margin
      });
      this.currentY += Math.max(textHeight, 10) + 15;
    }

    // Payment Information
    if (invoice.billerInfo.bankName || invoice.billerInfo.upiId) {
      this.checkPageBreak(25);
      
      this.addText('Payment Information:', this.margin, this.currentY, { 
        fontSize: 11, 
        fontStyle: 'bold', 
        color: '#212529' 
      });
      this.currentY += 6;

      const leftCol = this.margin;
      const rightCol = this.pageWidth / 2;

      if (invoice.billerInfo.bankName) {
        this.addText(`Bank: ${invoice.billerInfo.bankName}`, leftCol, this.currentY, { 
          fontSize: 9, 
          color: '#6c757d' 
        });
        if (invoice.billerInfo.accountNumber) {
          this.addText(`A/C No: ${invoice.billerInfo.accountNumber}`, rightCol, this.currentY, { 
            fontSize: 9, 
            color: '#6c757d' 
          });
        }
        this.currentY += 5;
      }

      if (invoice.billerInfo.ifscCode) {
        this.addText(`IFSC: ${invoice.billerInfo.ifscCode}`, leftCol, this.currentY, { 
          fontSize: 9, 
          color: '#6c757d' 
        });
        if (invoice.billerInfo.upiId) {
          this.addText(`UPI: ${invoice.billerInfo.upiId}`, rightCol, this.currentY, { 
            fontSize: 9, 
            color: '#6c757d' 
          });
        }
        this.currentY += 5;
      } else if (invoice.billerInfo.upiId && !invoice.billerInfo.ifscCode) {
        this.addText(`UPI: ${invoice.billerInfo.upiId}`, leftCol, this.currentY, { 
          fontSize: 9, 
          color: '#6c757d' 
        });
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