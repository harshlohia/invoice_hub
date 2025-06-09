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
    
    // Set up fonts
    this.setupFonts();
  }

  private setupFonts() {
    // Use Helvetica as the closest to Poppins in jsPDF's built-in fonts
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

    // Header Section with vibrant colors
    this.addHeader(invoice);
    
    // Bill To Section
    this.addBillToSection(invoice);
    
    // Line Items Table with colorful design
    this.addLineItemsTable(invoice);
    
    // Totals Section with enhanced colors
    this.addTotalsSection(invoice);
    
    // Notes Section
    this.addNotesSection(invoice);
    
    // Terms and Payment Info with colorful backgrounds
    this.addFooterSections(invoice);

    if (download) {
      this.doc.save(filename);
    }
  }

  private addHeader(invoice: Invoice) {
    // Vibrant gradient-style header background
    this.addRect(this.margin, this.margin, this.pageWidth - 2 * this.margin, 25, 'F', '#667eea');
    
    // Company Logo placeholder with modern design
    this.addRect(this.margin + 5, this.margin + 5, 35, 15, 'F', '#ffffff');
    this.addText('LOGO', this.margin + 22.5, this.margin + 14, { 
      align: 'center', 
      fontSize: 10, 
      color: '#667eea',
      fontStyle: 'bold'
    });

    // Company Info with white text on colored background
    this.addText(invoice.billerInfo.businessName, this.margin + 5, this.margin + 30, { 
      fontSize: 16, 
      fontStyle: 'bold', 
      color: '#ffffff'
    });
    
    let companyY = this.margin + 38;
    this.addText(invoice.billerInfo.addressLine1, this.margin + 5, companyY, { fontSize: 9, color: '#f0f4f8' });
    companyY += 4;
    
    if (invoice.billerInfo.addressLine2) {
      this.addText(invoice.billerInfo.addressLine2, this.margin + 5, companyY, { fontSize: 9, color: '#f0f4f8' });
      companyY += 4;
    }
    
    this.addText(`${invoice.billerInfo.city}, ${invoice.billerInfo.state} - ${invoice.billerInfo.postalCode}`, this.margin + 5, companyY, { fontSize: 9, color: '#f0f4f8' });
    
    if (invoice.billerInfo.gstin) {
      companyY += 4;
      this.addText(`GSTIN: ${invoice.billerInfo.gstin}`, this.margin + 5, companyY, { fontSize: 9, color: '#f0f4f8' });
    }

    // Invoice Title with vibrant styling
    this.addText('INVOICE', this.pageWidth - this.margin - 5, this.margin + 15, { 
      fontSize: 24, 
      fontStyle: 'bold', 
      align: 'right',
      color: '#ffffff'
    });
    
    this.addText(`# ${invoice.invoiceNumber}`, this.pageWidth - this.margin - 5, this.margin + 25, { 
      fontSize: 12, 
      align: 'right',
      color: '#f0f4f8'
    });
    
    // Enhanced status badge with vibrant colors
    const statusColors = {
      paid: '#10b981',
      sent: '#3b82f6',
      overdue: '#ef4444',
      draft: '#6b7280',
      cancelled: '#f59e0b'
    };
    
    const statusBgColors = {
      paid: '#d1fae5',
      sent: '#dbeafe',
      overdue: '#fee2e2',
      draft: '#f3f4f6',
      cancelled: '#fef3c7'
    };
    
    // Status background with rounded corners effect
    const statusText = invoice.status.toUpperCase();
    const statusWidth = this.doc.getTextWidth(statusText) + 10;
    this.addRect(this.pageWidth - this.margin - statusWidth - 5, this.margin + 32, statusWidth, 8, 'F', statusBgColors[invoice.status]);
    this.addRect(this.pageWidth - this.margin - statusWidth - 5, this.margin + 32, statusWidth, 8, 'S', statusColors[invoice.status]);
    this.addText(statusText, this.pageWidth - this.margin - (statusWidth/2) - 5, this.margin + 37.5, { 
      fontSize: 9, 
      align: 'center', 
      color: statusColors[invoice.status],
      fontStyle: 'bold'
    });

    // Dates with enhanced styling
    const invoiceDate = invoice.invoiceDate instanceof Date ? invoice.invoiceDate : new Date(invoice.invoiceDate);
    const dueDate = invoice.dueDate instanceof Date ? invoice.dueDate : new Date(invoice.dueDate);
    
    this.currentY = this.margin + 55;
    
    // Date section with colorful background
    this.addRect(this.pageWidth - 60, this.currentY, 55, 20, 'F', '#f8fafc');
    this.addRect(this.pageWidth - 60, this.currentY, 55, 20, 'S', '#e2e8f0');
    
    this.addText(`Date: ${format(invoiceDate, 'dd MMM, yyyy')}`, this.pageWidth - this.margin - 5, this.currentY + 8, { 
      fontSize: 10, 
      align: 'right',
      color: '#1e293b'
    });
    this.addText(`Due Date: ${format(dueDate, 'dd MMM, yyyy')}`, this.pageWidth - this.margin - 5, this.currentY + 16, { 
      fontSize: 10, 
      align: 'right',
      color: '#1e293b'
    });

    this.currentY += 30;
  }

  private addBillToSection(invoice: Invoice) {
    this.checkPageBreak(40);
    
    // Bill To section with colorful accent
    this.addRect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, 2, 'F', '#667eea');
    this.currentY += 5;
    
    this.addText('Bill To:', this.margin, this.currentY, { fontSize: 12, fontStyle: 'bold', color: '#1e293b' });
    this.currentY += 8;
    
    // Client info box with subtle background
    const clientBoxHeight = 35;
    this.addRect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, clientBoxHeight, 'F', '#f1f5f9');
    this.addRect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, clientBoxHeight, 'S', '#cbd5e1');
    
    this.currentY += 5;
    
    this.addText(invoice.client.name, this.margin + 5, this.currentY, { 
      fontSize: 11, 
      fontStyle: 'bold', 
      color: '#1e293b' 
    });
    this.currentY += 6;
    
    this.addText(invoice.client.addressLine1, this.margin + 5, this.currentY, { fontSize: 9, color: '#475569' });
    this.currentY += 4;
    
    if (invoice.client.addressLine2) {
      this.addText(invoice.client.addressLine2, this.margin + 5, this.currentY, { fontSize: 9, color: '#475569' });
      this.currentY += 4;
    }
    
    this.addText(`${invoice.client.city}, ${invoice.client.state} - ${invoice.client.postalCode}`, this.margin + 5, this.currentY, { fontSize: 9, color: '#475569' });
    this.currentY += 4;
    
    if (invoice.client.gstin) {
      this.addText(`GSTIN: ${invoice.client.gstin}`, this.margin + 5, this.currentY, { fontSize: 9, color: '#475569' });
      this.currentY += 4;
    }

    this.currentY += 15;
  }

  private addLineItemsTable(invoice: Invoice) {
    this.checkPageBreak(50);
    
    const tableStartY = this.currentY;
    const rowHeight = 8;
    const headerHeight = 12;

    // Calculate table width and column positions
    const tableWidth = this.pageWidth - 2 * this.margin;
    const tableStartX = this.margin;
    const tableEndX = this.pageWidth - this.margin;

    // Table headers
    const headers = ['#', 'Item/Service', 'Qty', 'Rate (Rs.)', 'Discount (%)', 'Amount (Rs.)'];
    
    // Optimized column widths to prevent overlapping
    const columnWidths = [8, 60, 12, 25, 22, 33]; // Total: 160mm
    const columnPositions = [tableStartX];
    
    for (let i = 0; i < columnWidths.length - 1; i++) {
      columnPositions.push(columnPositions[i] + columnWidths[i]);
    }

    // Vibrant header background with gradient effect
    this.addRect(tableStartX, tableStartY, tableWidth, headerHeight, 'F', '#4f46e5');
    
    // Header text with white color for contrast
    headers.forEach((header, index) => {
      const align = index === 0 ? 'left' : index === 1 ? 'left' : 'right';
      let x: number;
      
      if (align === 'right') {
        if (index === headers.length - 1) {
          x = tableEndX - 2;
        } else {
          x = columnPositions[index] + columnWidths[index] - 2;
        }
      } else {
        x = columnPositions[index] + 2;
      }
      
      this.addText(header, x, tableStartY + 8, { 
        fontSize: 9, 
        fontStyle: 'bold', 
        align,
        color: '#ffffff'
      });
    });

    this.currentY = tableStartY + headerHeight;

    // Table rows with alternating vibrant colors
    invoice.lineItems.forEach((item, index) => {
      this.checkPageBreak(rowHeight + 5);
      
      const rowY = this.currentY;
      
      // Alternating row backgrounds with vibrant colors
      if (index % 2 === 0) {
        this.addRect(tableStartX, rowY, tableWidth, rowHeight, 'F', '#f0f9ff');
      } else {
        this.addRect(tableStartX, rowY, tableWidth, rowHeight, 'F', '#fef3c7');
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
          if (colIndex === rowData.length - 1) {
            x = tableEndX - 2;
          } else {
            x = columnPositions[colIndex] + columnWidths[colIndex] - 2;
          }
        } else {
          x = columnPositions[colIndex] + 2;
        }
        
        // Truncate long text for item name to prevent overflow
        let displayText = data;
        if (colIndex === 1 && data.length > 25) {
          displayText = data.substring(0, 23) + '...';
        }
        
        this.addText(displayText, x, rowY + 6, { 
          fontSize: 9, 
          align,
          color: '#1e293b'
        });
      });

      this.currentY += rowHeight;
    });

    // Table border with vibrant color
    this.addRect(tableStartX, tableStartY, tableWidth, this.currentY - tableStartY, 'S', undefined, '#4f46e5');
    
    // Vertical lines
    for (let i = 1; i < columnPositions.length; i++) {
      this.addLine(columnPositions[i], tableStartY, columnPositions[i], this.currentY, '#6366f1');
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
    
    // Vibrant totals container with gradient effect
    this.addRect(boxX, boxY, boxWidth, boxHeight, 'F', '#ecfdf5');
    this.addRect(boxX, boxY, boxWidth, boxHeight, 'S', '#10b981', 1);
    
    // Text positioning within the box
    const labelStartX = boxX + 5;
    const valueEndX = boxX + boxWidth - 5;
    let textY = boxY + 12;
    const lineSpacing = 8;
    
    // Subtotal
    this.addText('Subtotal:', labelStartX, textY, { 
      fontSize: 10, 
      color: '#065f46' 
    });
    this.addText(`Rs. ${invoice.subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valueEndX, textY, { 
      fontSize: 10, 
      align: 'right',
      color: '#1e293b'
    });
    textY += lineSpacing;

    // Tax lines with color coding
    if (!invoice.isInterState) {
      // CGST
      this.addText('CGST:', labelStartX, textY, { 
        fontSize: 10, 
        color: '#dc2626' 
      });
      this.addText(`Rs. ${invoice.totalCGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valueEndX, textY, { 
        fontSize: 10, 
        align: 'right',
        color: '#1e293b'
      });
      textY += lineSpacing;

      // SGST
      this.addText('SGST:', labelStartX, textY, { 
        fontSize: 10, 
        color: '#dc2626' 
      });
      this.addText(`Rs. ${invoice.totalSGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valueEndX, textY, { 
        fontSize: 10, 
        align: 'right',
        color: '#1e293b'
      });
      textY += lineSpacing;
    } else {
      // IGST
      this.addText('IGST:', labelStartX, textY, { 
        fontSize: 10, 
        color: '#dc2626' 
      });
      this.addText(`Rs. ${invoice.totalIGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valueEndX, textY, { 
        fontSize: 10, 
        align: 'right',
        color: '#1e293b'
      });
      textY += lineSpacing;
    }

    // Vibrant separator line
    this.addLine(labelStartX, textY - 3, valueEndX, textY - 3, '#10b981', 1);
    textY += 2;

    // Grand Total with enhanced styling
    this.addText('Grand Total:', labelStartX, textY, { 
      fontSize: 12, 
      fontStyle: 'bold', 
      color: '#065f46' 
    });
    this.addText(`Rs. ${invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, valueEndX, textY, { 
      fontSize: 12, 
      fontStyle: 'bold', 
      color: '#1e293b', 
      align: 'right'
    });
    
    // Update currentY to be below the totals box
    this.currentY = boxY + boxHeight + 20;
  }

  private addNotesSection(invoice: Invoice) {
    if (invoice.notes) {
      this.checkPageBreak(30);
      
      // Notes section with colorful accent
      this.addRect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, 2, 'F', '#f59e0b');
      this.currentY += 5;
      
      this.addText('Notes:', this.margin, this.currentY, { fontSize: 12, fontStyle: 'bold', color: '#1e293b' });
      this.currentY += 8;
      
      // Notes background
      const notesHeight = 20;
      this.addRect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, notesHeight, 'F', '#fffbeb');
      this.addRect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, notesHeight, 'S', '#f59e0b');
      
      this.currentY += 5;
      const textHeight = this.addText(invoice.notes, this.margin + 5, this.currentY, { 
        fontSize: 10, 
        color: '#92400e',
        maxWidth: this.pageWidth - 2 * this.margin - 10
      });
      this.currentY += Math.max(textHeight, 15) + 10;
    }
  }

  private addFooterSections(invoice: Invoice) {
    // Terms & Conditions with vibrant styling
    if (invoice.termsAndConditions) {
      this.checkPageBreak(30);
      
      // Terms section with colorful accent
      this.addRect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, 2, 'F', '#8b5cf6');
      this.currentY += 5;
      
      this.addText('Terms & Conditions:', this.margin, this.currentY, { 
        fontSize: 12, 
        fontStyle: 'bold', 
        color: '#1e293b' 
      });
      this.currentY += 8;
      
      // Terms background
      const termsHeight = 20;
      this.addRect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, termsHeight, 'F', '#faf5ff');
      this.addRect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, termsHeight, 'S', '#8b5cf6');
      
      this.currentY += 5;
      const textHeight = this.addText(invoice.termsAndConditions, this.margin + 5, this.currentY, { 
        fontSize: 10, 
        color: '#6b21a8',
        maxWidth: this.pageWidth - 2 * this.margin - 10
      });
      this.currentY += Math.max(textHeight, 15) + 15;
    }

    // Payment Information with vibrant design
    if (invoice.billerInfo.bankName || invoice.billerInfo.upiId) {
      this.checkPageBreak(25);
      
      // Payment section with colorful accent
      this.addRect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, 2, 'F', '#06b6d4');
      this.currentY += 5;
      
      this.addText('Payment Information:', this.margin, this.currentY, { 
        fontSize: 12, 
        fontStyle: 'bold', 
        color: '#1e293b' 
      });
      this.currentY += 6;

      // Calculate required height based on content
      let contentLines = 0;
      if (invoice.billerInfo.bankName) contentLines++;
      if (invoice.billerInfo.ifscCode || invoice.billerInfo.upiId) contentLines++;
      
      const paymentBoxHeight = Math.max(18, contentLines * 6 + 8);
      
      // Payment info background with vibrant colors
      this.addRect(this.margin, this.currentY - 2, this.pageWidth - 2 * this.margin, paymentBoxHeight, 'F', '#ecfeff');
      this.addRect(this.margin, this.currentY - 2, this.pageWidth - 2 * this.margin, paymentBoxHeight, 'S', '#06b6d4');

      const leftCol = this.margin + 3;
      const rightCol = this.pageWidth / 2;

      // Compact layout with enhanced colors
      if (invoice.billerInfo.bankName) {
        this.addText(`Bank: ${invoice.billerInfo.bankName}`, leftCol, this.currentY + 2, { 
          fontSize: 9, 
          color: '#0e7490' 
        });
        if (invoice.billerInfo.accountNumber) {
          this.addText(`A/C No: ${invoice.billerInfo.accountNumber}`, rightCol, this.currentY + 2, { 
            fontSize: 9, 
            color: '#0e7490' 
          });
        }
        this.currentY += 5;
      }

      if (invoice.billerInfo.ifscCode) {
        this.addText(`IFSC: ${invoice.billerInfo.ifscCode}`, leftCol, this.currentY + 2, { 
          fontSize: 9, 
          color: '#0e7490' 
        });
        if (invoice.billerInfo.upiId) {
          this.addText(`UPI: ${invoice.billerInfo.upiId}`, rightCol, this.currentY + 2, { 
            fontSize: 9, 
            color: '#0e7490' 
          });
        }
        this.currentY += 5;
      } else if (invoice.billerInfo.upiId && !invoice.billerInfo.ifscCode) {
        this.addText(`UPI: ${invoice.billerInfo.upiId}`, leftCol, this.currentY + 2, { 
          fontSize: 9, 
          color: '#0e7490' 
        });
        this.currentY += 5;
      }
      
      this.currentY += 8;
    }

    // Vibrant footer
    this.addLine(this.margin, this.pageHeight - 25, this.pageWidth - this.margin, this.pageHeight - 25, '#667eea', 1);
    this.addText('Thank you for your business!', this.pageWidth / 2, this.pageHeight - 15, {
      fontSize: 11,
      align: 'center', 
      color: '#4f46e5',
      fontStyle: 'bold'
    });
  }

  public getBlob(): Blob {
    return this.doc.output('blob');
  }

  public getDataUri(): string {
    return this.doc.output('datauristring');
  }
}