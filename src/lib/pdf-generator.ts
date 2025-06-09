import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { Invoice } from '@/lib/types';
import { format } from 'date-fns';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export class InvoicePDFGenerator {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 20;
  private currentY: number = 20;

  // Color scheme matching your app
  private colors = {
    primary: [63, 81, 181], // Deep blue
    accent: [255, 152, 0], // Orange
    text: [33, 33, 33], // Dark text
    lightGray: [245, 245, 245],
    mediumGray: [158, 158, 158],
    white: [255, 255, 255]
  };

  constructor() {
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
  }

  private checkPageBreak(requiredHeight: number): void {
    if (this.currentY + requiredHeight > this.pageHeight - this.margin) {
      this.doc.addPage();
      this.currentY = this.margin;
    }
  }

  private addText(text: string, x: number, y: number, options?: { 
    fontSize?: number; 
    fontStyle?: 'normal' | 'bold' | 'italic'; 
    align?: 'left' | 'center' | 'right';
    color?: number[];
    maxWidth?: number;
  }): void {
    // Set font properties
    if (options?.fontSize) this.doc.setFontSize(options.fontSize);
    if (options?.fontStyle) {
      this.doc.setFont('helvetica', options.fontStyle);
    } else {
      this.doc.setFont('helvetica', 'normal');
    }
    
    // Set text color
    if (options?.color) {
      this.doc.setTextColor(options.color[0], options.color[1], options.color[2]);
    } else {
      this.doc.setTextColor(this.colors.text[0], this.colors.text[1], this.colors.text[2]);
    }

    // Handle text wrapping if maxWidth is specified
    if (options?.maxWidth) {
      const lines = this.doc.splitTextToSize(text, options.maxWidth);
      if (Array.isArray(lines)) {
        lines.forEach((line: string, index: number) => {
          const lineY = y + (index * (options.fontSize || 10) * 0.35);
          this.addSingleLineText(line, x, lineY, options);
        });
        return;
      }
    }

    this.addSingleLineText(text, x, y, options);
  }

  private addSingleLineText(text: string, x: number, y: number, options?: { align?: 'left' | 'center' | 'right' }): void {
    if (options?.align === 'right') {
      this.doc.text(text, x, y, { align: 'right' });
    } else if (options?.align === 'center') {
      this.doc.text(text, x, y, { align: 'center' });
    } else {
      this.doc.text(text, x, y);
    }
  }

  private addRectangle(x: number, y: number, width: number, height: number, fillColor?: number[], strokeColor?: number[]): void {
    if (fillColor) {
      this.doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
    }
    if (strokeColor) {
      this.doc.setDrawColor(strokeColor[0], strokeColor[1], strokeColor[2]);
    } else {
      this.doc.setDrawColor(200, 200, 200); // Default light gray border
    }
    
    if (fillColor) {
      this.doc.rect(x, y, width, height, 'FD'); // Fill and Draw
    } else {
      this.doc.rect(x, y, width, height, 'D'); // Draw only
    }
  }

  private addLine(x1: number, y1: number, x2: number, y2: number, color?: number[], lineWidth?: number): void {
    if (color) {
      this.doc.setDrawColor(color[0], color[1], color[2]);
    } else {
      this.doc.setDrawColor(200, 200, 200);
    }
    if (lineWidth) {
      this.doc.setLineWidth(lineWidth);
    } else {
      this.doc.setLineWidth(0.5);
    }
    this.doc.line(x1, y1, x2, y2);
  }

  private addHeader(invoice: Invoice): void {
    // Header background
    this.addRectangle(0, 0, this.pageWidth, 60, this.colors.lightGray);

    // Logo placeholder
    if (invoice.billerInfo.logoUrl) {
      this.addRectangle(this.margin, this.margin, 40, 20, this.colors.white, this.colors.mediumGray);
      this.addText('LOGO', this.margin + 20, this.margin + 12, { 
        align: 'center', 
        fontSize: 8, 
        color: this.colors.mediumGray 
      });
    }

    // Company name with primary color
    this.addText(invoice.billerInfo.businessName, this.margin, this.margin + 35, { 
      fontSize: 18, 
      fontStyle: 'bold',
      color: this.colors.primary
    });

    // Company address
    let addressY = this.margin + 45;
    this.addText(invoice.billerInfo.addressLine1, this.margin, addressY, { fontSize: 9 });
    addressY += 4;

    if (invoice.billerInfo.addressLine2) {
      this.addText(invoice.billerInfo.addressLine2, this.margin, addressY, { fontSize: 9 });
      addressY += 4;
    }

    this.addText(`${invoice.billerInfo.city}, ${invoice.billerInfo.state} - ${invoice.billerInfo.postalCode}`, this.margin, addressY, { fontSize: 9 });
    addressY += 4;

    if (invoice.billerInfo.gstin) {
      this.addText(`GSTIN: ${invoice.billerInfo.gstin}`, this.margin, addressY, { fontSize: 9, fontStyle: 'bold' });
    }

    // Invoice title and details (right side)
    this.addText('INVOICE', this.pageWidth - this.margin, this.margin + 15, { 
      fontSize: 28, 
      fontStyle: 'bold', 
      align: 'right',
      color: this.colors.text
    });

    this.addText(`# ${invoice.invoiceNumber}`, this.pageWidth - this.margin, this.margin + 25, { 
      fontSize: 14, 
      align: 'right',
      color: this.colors.primary
    });

    // Status badge
    const statusColors = {
      'paid': [76, 175, 80],
      'sent': [33, 150, 243],
      'overdue': [244, 67, 54],
      'draft': [158, 158, 158],
      'cancelled': [255, 193, 7]
    };
    
    const statusColor = statusColors[invoice.status] || this.colors.mediumGray;
    this.addRectangle(this.pageWidth - this.margin - 30, this.margin + 30, 30, 8, statusColor);
    this.addText(invoice.status.toUpperCase(), this.pageWidth - this.margin - 15, this.margin + 36, {
      fontSize: 8,
      fontStyle: 'bold',
      align: 'center',
      color: this.colors.white
    });

    // Invoice dates
    const invoiceDate = invoice.invoiceDate instanceof Date ? invoice.invoiceDate : invoice.invoiceDate.toDate();
    const dueDate = invoice.dueDate instanceof Date ? invoice.dueDate : invoice.dueDate.toDate();

    this.addText(`Date: ${format(invoiceDate, 'dd MMM, yyyy')}`, this.pageWidth - this.margin, this.margin + 45, { 
      fontSize: 9, 
      align: 'right' 
    });
    this.addText(`Due Date: ${format(dueDate, 'dd MMM, yyyy')}`, this.pageWidth - this.margin, this.margin + 52, { 
      fontSize: 9, 
      align: 'right' 
    });

    this.currentY = 75;
  }

  private addBillToSection(invoice: Invoice): void {
    this.checkPageBreak(50);

    // Bill To section with background
    this.addRectangle(this.margin, this.currentY, this.pageWidth - 2 * this.margin, 35, this.colors.lightGray);
    
    this.addText('Bill To:', this.margin + 5, this.currentY + 8, { 
      fontSize: 12, 
      fontStyle: 'bold',
      color: this.colors.primary
    });

    this.addText(invoice.client.name, this.margin + 5, this.currentY + 16, { 
      fontSize: 11, 
      fontStyle: 'bold' 
    });

    let addressText = invoice.client.addressLine1;
    if (invoice.client.addressLine2) {
      addressText += `, ${invoice.client.addressLine2}`;
    }
    addressText += `, ${invoice.client.city}, ${invoice.client.state} - ${invoice.client.postalCode}`;

    this.addText(addressText, this.margin + 5, this.currentY + 23, { 
      fontSize: 9,
      maxWidth: this.pageWidth - 2 * this.margin - 10
    });

    if (invoice.client.gstin) {
      this.addText(`GSTIN: ${invoice.client.gstin}`, this.margin + 5, this.currentY + 30, { 
        fontSize: 9, 
        fontStyle: 'bold' 
      });
    }

    this.currentY += 45;
  }

  private addLineItemsTable(invoice: Invoice): void {
    this.checkPageBreak(80);

    const tableColumns = [
      { header: '#', dataKey: 'sno', width: 15 },
      { header: 'Item/Service', dataKey: 'productName', width: 70 },
      { header: 'Qty', dataKey: 'quantity', width: 20 },
      { header: 'Rate (₹)', dataKey: 'rate', width: 25 },
      { header: 'Discount (%)', dataKey: 'discount', width: 25 },
      { header: 'Amount (₹)', dataKey: 'amount', width: 30 }
    ];

    const tableRows = invoice.lineItems.map((item, index) => ({
      sno: (index + 1).toString(),
      productName: item.productName,
      quantity: item.quantity.toString(),
      rate: item.rate.toFixed(2),
      discount: item.discountPercentage.toFixed(1),
      amount: item.amount.toFixed(2)
    }));

    this.doc.autoTable({
      startY: this.currentY,
      head: [tableColumns.map(col => col.header)],
      body: tableRows.map(row => tableColumns.map(col => row[col.dataKey as keyof typeof row])),
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 4,
        lineColor: [220, 220, 220],
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: this.colors.primary,
        textColor: this.colors.white,
        fontStyle: 'bold',
        fontSize: 10
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 70, halign: 'left' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 30, halign: 'right' }
      },
      margin: { left: this.margin, right: this.margin },
      tableLineColor: [220, 220, 220],
      tableLineWidth: 0.5,
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 15;
  }

  private addTotalsSection(invoice: Invoice): void {
    this.checkPageBreak(80);

    const startX = this.pageWidth - 90;
    const boxWidth = 70;
    const currencySymbol = invoice.currency === "INR" ? "₹" : (invoice.currency || "₹");

    // Totals background
    this.addRectangle(startX, this.currentY, boxWidth, 60, this.colors.lightGray);

    let totalY = this.currentY + 8;

    // Subtotal
    this.addText('Subtotal:', startX + 5, totalY, { fontSize: 10 });
    this.addText(`${currencySymbol}${invoice.subTotal.toFixed(2)}`, startX + boxWidth - 5, totalY, { 
      fontSize: 10, 
      align: 'right' 
    });
    totalY += 8;

    // Tax details
    if (!invoice.isInterState) {
      this.addText('CGST:', startX + 5, totalY, { fontSize: 10 });
      this.addText(`${currencySymbol}${invoice.totalCGST.toFixed(2)}`, startX + boxWidth - 5, totalY, { 
        fontSize: 10, 
        align: 'right' 
      });
      totalY += 6;

      this.addText('SGST:', startX + 5, totalY, { fontSize: 10 });
      this.addText(`${currencySymbol}${invoice.totalSGST.toFixed(2)}`, startX + boxWidth - 5, totalY, { 
        fontSize: 10, 
        align: 'right' 
      });
      totalY += 6;
    } else {
      this.addText('IGST:', startX + 5, totalY, { fontSize: 10 });
      this.addText(`${currencySymbol}${invoice.totalIGST.toFixed(2)}`, startX + boxWidth - 5, totalY, { 
        fontSize: 10, 
        align: 'right' 
      });
      totalY += 6;
    }

    // Line above total
    this.addLine(startX + 5, totalY + 2, startX + boxWidth - 5, totalY + 2, this.colors.primary, 1);
    totalY += 8;

    // Grand Total with accent background
    this.addRectangle(startX, totalY - 3, boxWidth, 12, this.colors.primary);
    this.addText('Grand Total:', startX + 5, totalY + 3, { 
      fontSize: 12, 
      fontStyle: 'bold',
      color: this.colors.white
    });
    this.addText(`${currencySymbol}${invoice.grandTotal.toFixed(2)}`, startX + boxWidth - 5, totalY + 3, { 
      fontSize: 12, 
      fontStyle: 'bold', 
      align: 'right',
      color: this.colors.white
    });

    this.currentY += 75;
  }

  private addNotesAndTerms(invoice: Invoice): void {
    if (invoice.notes || invoice.termsAndConditions) {
      this.checkPageBreak(60);

      if (invoice.notes) {
        this.addText('Notes:', this.margin, this.currentY, { 
          fontSize: 12, 
          fontStyle: 'bold',
          color: this.colors.primary
        });
        this.currentY += 8;
        
        this.addText(invoice.notes, this.margin, this.currentY, { 
          fontSize: 10,
          maxWidth: this.pageWidth - 2 * this.margin
        });
        
        // Calculate lines for proper spacing
        const noteLines = this.doc.splitTextToSize(invoice.notes, this.pageWidth - 2 * this.margin);
        this.currentY += (Array.isArray(noteLines) ? noteLines.length : 1) * 4 + 8;
      }

      if (invoice.termsAndConditions) {
        this.checkPageBreak(30);
        this.addText('Terms & Conditions:', this.margin, this.currentY, { 
          fontSize: 12, 
          fontStyle: 'bold',
          color: this.colors.primary
        });
        this.currentY += 8;
        
        this.addText(invoice.termsAndConditions, this.margin, this.currentY, { 
          fontSize: 10,
          maxWidth: this.pageWidth - 2 * this.margin
        });
        
        const termLines = this.doc.splitTextToSize(invoice.termsAndConditions, this.pageWidth - 2 * this.margin);
        this.currentY += (Array.isArray(termLines) ? termLines.length : 1) * 4 + 8;
      }
    }
  }

  private addPaymentInfo(invoice: Invoice): void {
    if (invoice.billerInfo.bankName || invoice.billerInfo.upiId) {
      this.checkPageBreak(50);

      // Payment info background
      this.addRectangle(this.margin, this.currentY, this.pageWidth - 2 * this.margin, 40, this.colors.lightGray);

      this.addText('Payment Information:', this.margin + 5, this.currentY + 8, { 
        fontSize: 12, 
        fontStyle: 'bold',
        color: this.colors.primary
      });

      let paymentY = this.currentY + 16;
      const leftCol = this.margin + 5;
      const rightCol = this.margin + (this.pageWidth - 2 * this.margin) / 2;

      if (invoice.billerInfo.bankName) {
        this.addText(`Bank: ${invoice.billerInfo.bankName}`, leftCol, paymentY, { fontSize: 10 });
        paymentY += 6;
      }

      if (invoice.billerInfo.accountNumber) {
        this.addText(`A/C No: ${invoice.billerInfo.accountNumber}`, leftCol, paymentY, { fontSize: 10 });
        paymentY += 6;
      }

      // Reset Y for right column
      paymentY = this.currentY + 16;

      if (invoice.billerInfo.ifscCode) {
        this.addText(`IFSC: ${invoice.billerInfo.ifscCode}`, rightCol, paymentY, { fontSize: 10 });
        paymentY += 6;
      }

      if (invoice.billerInfo.upiId) {
        this.addText(`UPI: ${invoice.billerInfo.upiId}`, rightCol, paymentY, { fontSize: 10 });
      }

      this.currentY += 50;
    }
  }

  private addFooter(): void {
    // Add a subtle footer
    const footerY = this.pageHeight - 15;
    this.addLine(this.margin, footerY - 5, this.pageWidth - this.margin, footerY - 5, this.colors.mediumGray);
    this.addText('Generated by BillFlow', this.pageWidth / 2, footerY, {
      fontSize: 8,
      align: 'center',
      color: this.colors.mediumGray
    });
  }

  public generatePDF(invoice: Invoice): jsPDF {
    // Reset document
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.currentY = this.margin;

    // Add all sections
    this.addHeader(invoice);
    this.addBillToSection(invoice);
    this.addLineItemsTable(invoice);
    this.addTotalsSection(invoice);
    this.addNotesAndTerms(invoice);
    this.addPaymentInfo(invoice);
    this.addFooter();

    return this.doc;
  }

  public downloadPDF(invoice: Invoice, filename?: string): void {
    const pdf = this.generatePDF(invoice);
    const fileName = filename || `invoice-${invoice.invoiceNumber || 'details'}.pdf`;
    pdf.save(fileName);
  }
}