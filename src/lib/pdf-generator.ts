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

  // Colors matching your web preview exactly
  private colors = {
    primary: [63, 81, 181], // #3F51B5 - Deep blue from your app
    accent: [255, 152, 0], // #FF9800 - Orange accent
    text: [33, 33, 33], // Dark text
    mutedText: [107, 114, 126], // Muted text color
    lightGray: [236, 239, 241], // #ECEFF1 - Light gray background
    mediumGray: [158, 158, 158],
    white: [255, 255, 255],
    border: [229, 231, 235], // Light border color
    tableHeader: [248, 250, 252], // Very light gray for table header
    green: [34, 197, 94], // For paid status
    red: [239, 68, 68], // For overdue status
    blue: [59, 130, 246], // For sent status
    yellow: [245, 158, 11], // For cancelled status
    gray: [107, 114, 126] // For draft status
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
  }): number {
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
        return y + (lines.length * (options.fontSize || 10) * 0.35);
      }
    }

    this.addSingleLineText(text, x, y, options);
    return y + (options?.fontSize || 10) * 0.35;
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

  private addRectangle(x: number, y: number, width: number, height: number, fillColor?: number[], strokeColor?: number[], lineWidth?: number): void {
    if (fillColor) {
      this.doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
    }
    if (strokeColor) {
      this.doc.setDrawColor(strokeColor[0], strokeColor[1], strokeColor[2]);
    } else {
      this.doc.setDrawColor(this.colors.border[0], this.colors.border[1], this.colors.border[2]);
    }
    
    if (lineWidth) {
      this.doc.setLineWidth(lineWidth);
    } else {
      this.doc.setLineWidth(0.1);
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
      this.doc.setDrawColor(this.colors.border[0], this.colors.border[1], this.colors.border[2]);
    }
    if (lineWidth) {
      this.doc.setLineWidth(lineWidth);
    } else {
      this.doc.setLineWidth(0.1);
    }
    this.doc.line(x1, y1, x2, y2);
  }

  private addHeader(invoice: Invoice): void {
    // Header background matching web preview
    this.addRectangle(0, 0, this.pageWidth, 70, this.colors.lightGray);

    // Logo placeholder (matching web preview style)
    if (invoice.billerInfo.logoUrl) {
      this.addRectangle(this.margin, this.margin, 40, 20, this.colors.white, this.colors.border);
      this.addText('Logo', this.margin + 20, this.margin + 12, { 
        align: 'center', 
        fontSize: 8, 
        color: this.colors.mutedText 
      });
    } else {
      // Gray placeholder box like in web preview
      this.addRectangle(this.margin, this.margin, 40, 20, [200, 200, 200]);
      this.addText('Logo', this.margin + 20, this.margin + 12, { 
        align: 'center', 
        fontSize: 8, 
        color: this.colors.white 
      });
    }

    // Company name with primary blue color (matching web)
    this.addText(invoice.billerInfo.businessName, this.margin, this.margin + 35, { 
      fontSize: 20, 
      fontStyle: 'bold',
      color: this.colors.primary
    });

    // Company address (smaller, muted text like web)
    let addressY = this.margin + 45;
    this.addText(invoice.billerInfo.addressLine1, this.margin, addressY, { 
      fontSize: 9, 
      color: this.colors.mutedText 
    });
    addressY += 4;

    if (invoice.billerInfo.addressLine2) {
      this.addText(invoice.billerInfo.addressLine2, this.margin, addressY, { 
        fontSize: 9, 
        color: this.colors.mutedText 
      });
      addressY += 4;
    }

    this.addText(`${invoice.billerInfo.city}, ${invoice.billerInfo.state} - ${invoice.billerInfo.postalCode}`, this.margin, addressY, { 
      fontSize: 9, 
      color: this.colors.mutedText 
    });
    addressY += 4;

    if (invoice.billerInfo.gstin) {
      this.addText(`GSTIN: ${invoice.billerInfo.gstin}`, this.margin, addressY, { 
        fontSize: 9, 
        color: this.colors.mutedText 
      });
    }

    // Right side - Invoice title and details (matching web layout exactly)
    this.addText('INVOICE', this.pageWidth - this.margin, this.margin + 15, { 
      fontSize: 32, 
      fontStyle: 'bold', 
      align: 'right',
      color: [119, 119, 119] // Gray color like in web
    });

    this.addText(`# ${invoice.invoiceNumber}`, this.pageWidth - this.margin, this.margin + 28, { 
      fontSize: 16, 
      align: 'right',
      color: this.colors.mutedText
    });

    // Status badge (matching web colors exactly)
    const statusColors = {
      'paid': this.colors.green,
      'sent': this.colors.blue,
      'overdue': this.colors.red,
      'draft': this.colors.gray,
      'cancelled': this.colors.yellow
    };
    
    const statusColor = statusColors[invoice.status] || this.colors.gray;
    const statusText = invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1);
    
    // Status badge with rounded corners effect
    this.addRectangle(this.pageWidth - this.margin - 35, this.margin + 35, 35, 10, statusColor);
    this.addText(statusText, this.pageWidth - this.margin - 17.5, this.margin + 41, {
      fontSize: 8,
      fontStyle: 'bold',
      align: 'center',
      color: this.colors.white
    });

    // Separator line
    this.addLine(this.pageWidth - this.margin - 50, this.margin + 50, this.pageWidth - this.margin, this.margin + 50, this.colors.border);

    // Invoice dates (matching web style)
    const invoiceDate = invoice.invoiceDate instanceof Date ? invoice.invoiceDate : invoice.invoiceDate.toDate();
    const dueDate = invoice.dueDate instanceof Date ? invoice.dueDate : invoice.dueDate.toDate();

    this.addText('Date:', this.pageWidth - this.margin - 45, this.margin + 57, { 
      fontSize: 9, 
      fontStyle: 'bold',
      color: this.colors.text
    });
    this.addText(format(invoiceDate, 'dd MMM, yyyy'), this.pageWidth - this.margin, this.margin + 57, { 
      fontSize: 9, 
      align: 'right',
      color: this.colors.text
    });

    this.addText('Due Date:', this.pageWidth - this.margin - 45, this.margin + 64, { 
      fontSize: 9, 
      fontStyle: 'bold',
      color: this.colors.text
    });
    this.addText(format(dueDate, 'dd MMM, yyyy'), this.pageWidth - this.margin, this.margin + 64, { 
      fontSize: 9, 
      align: 'right',
      color: this.colors.text
    });

    this.currentY = 85;
  }

  private addBillToSection(invoice: Invoice): void {
    this.checkPageBreak(50);

    // Bill To section (matching web layout)
    this.addText('Bill To:', this.margin, this.currentY, { 
      fontSize: 14, 
      fontStyle: 'bold',
      color: this.colors.text
    });
    this.currentY += 8;

    // Client name in primary blue (like web)
    this.addText(invoice.client.name, this.margin, this.currentY, { 
      fontSize: 14, 
      fontStyle: 'bold',
      color: this.colors.primary
    });
    this.currentY += 8;

    // Address in muted text
    this.addText(invoice.client.addressLine1, this.margin, this.currentY, { 
      fontSize: 10,
      color: this.colors.mutedText
    });
    this.currentY += 5;

    if (invoice.client.addressLine2) {
      this.addText(invoice.client.addressLine2, this.margin, this.currentY, { 
        fontSize: 10,
        color: this.colors.mutedText
      });
      this.currentY += 5;
    }

    this.addText(`${invoice.client.city}, ${invoice.client.state} - ${invoice.client.postalCode}`, this.margin, this.currentY, { 
      fontSize: 10,
      color: this.colors.mutedText
    });
    this.currentY += 5;

    if (invoice.client.gstin) {
      this.addText(`GSTIN: ${invoice.client.gstin}`, this.margin, this.currentY, { 
        fontSize: 10,
        color: this.colors.mutedText
      });
      this.currentY += 5;
    }

    this.currentY += 15;
  }

  private addLineItemsTable(invoice: Invoice): void {
    this.checkPageBreak(80);

    const currencySymbol = invoice.currency === "INR" ? "Rs." : (invoice.currency || "Rs.");

    // Table headers (matching web exactly)
    const tableColumns = [
      { header: '#', dataKey: 'sno', width: 15 },
      { header: 'Item/Service', dataKey: 'productName', width: 65 },
      { header: 'Qty', dataKey: 'quantity', width: 20 },
      { header: `Rate (${currencySymbol})`, dataKey: 'rate', width: 30 },
      { header: 'Discount (%)', dataKey: 'discount', width: 25 },
      { header: `Amount (${currencySymbol})`, dataKey: 'amount', width: 30 }
    ];

    const tableRows = invoice.lineItems.map((item, index) => ({
      sno: (index + 1).toString(),
      productName: item.productName,
      quantity: item.quantity.toString(),
      rate: item.rate.toFixed(2),
      discount: item.discountPercentage.toFixed(2) + '%',
      amount: item.amount.toFixed(2)
    }));

    // Custom table to match web design exactly
    this.doc.autoTable({
      startY: this.currentY,
      head: [tableColumns.map(col => col.header)],
      body: tableRows.map(row => tableColumns.map(col => row[col.dataKey as keyof typeof row])),
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 6,
        lineColor: this.colors.border,
        lineWidth: 0.1,
        textColor: this.colors.text,
      },
      headStyles: {
        fillColor: this.colors.tableHeader,
        textColor: this.colors.text,
        fontStyle: 'bold',
        fontSize: 10,
        lineColor: this.colors.border,
        lineWidth: 0.1,
      },
      alternateRowStyles: {
        fillColor: [252, 252, 252] // Very light alternating rows
      },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 65, halign: 'left' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 30, halign: 'right' }
      },
      margin: { left: this.margin, right: this.margin },
      tableLineColor: this.colors.border,
      tableLineWidth: 0.1,
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 20;
  }

  private addTotalsSection(invoice: Invoice): void {
    this.checkPageBreak(80);

    const startX = this.pageWidth - 100;
    const labelWidth = 50;
    const valueWidth = 40;
    const currencySymbol = invoice.currency === "INR" ? "Rs." : (invoice.currency || "Rs.");

    let totalY = this.currentY;

    // Subtotal
    this.addText('Subtotal:', startX, totalY, { 
      fontSize: 11,
      color: this.colors.mutedText
    });
    this.addText(`${currencySymbol}${invoice.subTotal.toFixed(2)}`, startX + labelWidth + valueWidth, totalY, { 
      fontSize: 11, 
      align: 'right',
      fontStyle: 'bold'
    });
    totalY += 8;

    // Tax details (matching web layout)
    if (!invoice.isInterState) {
      this.addText('CGST:', startX, totalY, { 
        fontSize: 11,
        color: this.colors.mutedText
      });
      this.addText(`${currencySymbol}${invoice.totalCGST.toFixed(2)}`, startX + labelWidth + valueWidth, totalY, { 
        fontSize: 11, 
        align: 'right',
        fontStyle: 'bold'
      });
      totalY += 8;

      this.addText('SGST:', startX, totalY, { 
        fontSize: 11,
        color: this.colors.mutedText
      });
      this.addText(`${currencySymbol}${invoice.totalSGST.toFixed(2)}`, startX + labelWidth + valueWidth, totalY, { 
        fontSize: 11, 
        align: 'right',
        fontStyle: 'bold'
      });
      totalY += 8;
    } else {
      this.addText('IGST:', startX, totalY, { 
        fontSize: 11,
        color: this.colors.mutedText
      });
      this.addText(`${currencySymbol}${invoice.totalIGST.toFixed(2)}`, startX + labelWidth + valueWidth, totalY, { 
        fontSize: 11, 
        align: 'right',
        fontStyle: 'bold'
      });
      totalY += 8;
    }

    // Separator line
    this.addLine(startX, totalY + 2, startX + labelWidth + valueWidth, totalY + 2, this.colors.border);
    totalY += 10;

    // Grand Total (matching web style with larger text and primary color)
    this.addText('Grand Total:', startX, totalY, { 
      fontSize: 16, 
      fontStyle: 'bold',
      color: this.colors.text
    });
    this.addText(`${currencySymbol}${invoice.grandTotal.toFixed(2)}`, startX + labelWidth + valueWidth, totalY, { 
      fontSize: 16, 
      fontStyle: 'bold', 
      align: 'right',
      color: this.colors.primary
    });

    this.currentY = totalY + 25;
  }

  private addNotesAndTerms(invoice: Invoice): void {
    if (invoice.notes || invoice.termsAndConditions) {
      this.checkPageBreak(60);

      if (invoice.notes) {
        this.addText('Notes:', this.margin, this.currentY, { 
          fontSize: 12, 
          fontStyle: 'bold',
          color: this.colors.text
        });
        this.currentY += 8;
        
        const noteLines = this.doc.splitTextToSize(invoice.notes, this.pageWidth - 2 * this.margin);
        if (Array.isArray(noteLines)) {
          noteLines.forEach((line: string, index: number) => {
            this.addText(line, this.margin, this.currentY + (index * 5), { 
              fontSize: 10,
              color: this.colors.mutedText
            });
          });
          this.currentY += noteLines.length * 5 + 10;
        } else {
          this.addText(invoice.notes, this.margin, this.currentY, { 
            fontSize: 10,
            color: this.colors.mutedText
          });
          this.currentY += 15;
        }
      }

      if (invoice.termsAndConditions) {
        this.checkPageBreak(30);
        this.addText('Terms & Conditions:', this.margin, this.currentY, { 
          fontSize: 12, 
          fontStyle: 'bold',
          color: this.colors.text
        });
        this.currentY += 8;
        
        const termLines = this.doc.splitTextToSize(invoice.termsAndConditions, this.pageWidth - 2 * this.margin);
        if (Array.isArray(termLines)) {
          termLines.forEach((line: string, index: number) => {
            this.addText(line, this.margin, this.currentY + (index * 5), { 
              fontSize: 10,
              color: this.colors.mutedText
            });
          });
          this.currentY += termLines.length * 5 + 10;
        } else {
          this.addText(invoice.termsAndConditions, this.margin, this.currentY, { 
            fontSize: 10,
            color: this.colors.mutedText
          });
          this.currentY += 15;
        }
      }
    }
  }

  private addPaymentInfo(invoice: Invoice): void {
    if (invoice.billerInfo.bankName || invoice.billerInfo.upiId) {
      this.checkPageBreak(50);

      this.addText('Payment Information:', this.margin, this.currentY, { 
        fontSize: 12, 
        fontStyle: 'bold',
        color: this.colors.text
      });
      this.currentY += 10;

      // Two column layout like web
      const leftCol = this.margin;
      const rightCol = this.margin + (this.pageWidth - 2 * this.margin) / 2;
      let leftY = this.currentY;
      let rightY = this.currentY;

      if (invoice.billerInfo.bankName) {
        this.addText('Bank:', leftCol, leftY, { 
          fontSize: 10, 
          fontStyle: 'bold',
          color: this.colors.text
        });
        this.addText(invoice.billerInfo.bankName, leftCol + 20, leftY, { 
          fontSize: 10,
          color: this.colors.mutedText
        });
        leftY += 6;
      }

      if (invoice.billerInfo.accountNumber) {
        this.addText('A/C No:', leftCol, leftY, { 
          fontSize: 10, 
          fontStyle: 'bold',
          color: this.colors.text
        });
        this.addText(invoice.billerInfo.accountNumber, leftCol + 20, leftY, { 
          fontSize: 10,
          color: this.colors.mutedText
        });
        leftY += 6;
      }

      if (invoice.billerInfo.ifscCode) {
        this.addText('IFSC:', rightCol, rightY, { 
          fontSize: 10, 
          fontStyle: 'bold',
          color: this.colors.text
        });
        this.addText(invoice.billerInfo.ifscCode, rightCol + 20, rightY, { 
          fontSize: 10,
          color: this.colors.mutedText
        });
        rightY += 6;
      }

      if (invoice.billerInfo.upiId) {
        this.addText('UPI:', rightCol, rightY, { 
          fontSize: 10, 
          fontStyle: 'bold',
          color: this.colors.text
        });
        this.addText(invoice.billerInfo.upiId, rightCol + 20, rightY, { 
          fontSize: 10,
          color: this.colors.mutedText
        });
        rightY += 6;
      }

      this.currentY = Math.max(leftY, rightY) + 10;
    }
  }

  public generatePDF(invoice: Invoice): jsPDF {
    // Reset document
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.currentY = this.margin;

    // Add all sections in order (matching web layout)
    this.addHeader(invoice);
    this.addBillToSection(invoice);
    this.addLineItemsTable(invoice);
    this.addTotalsSection(invoice);
    this.addNotesAndTerms(invoice);
    this.addPaymentInfo(invoice);

    return this.doc;
  }

  public downloadPDF(invoice: Invoice, filename?: string): void {
    const pdf = this.generatePDF(invoice);
    const fileName = filename || `invoice-${invoice.invoiceNumber || 'details'}.pdf`;
    pdf.save(fileName);
  }
}