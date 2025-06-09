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
    lightGray: [248, 250, 252], // Very light gray background like web
    mediumGray: [158, 158, 158],
    white: [255, 255, 255],
    border: [229, 231, 235], // Light border color
    tableHeader: [248, 250, 252], // Very light gray for table header (NOT blue)
    green: [34, 197, 94], // For paid status
    red: [239, 68, 68], // For overdue status
    blue: [59, 130, 246], // For sent status
    yellow: [245, 158, 11], // For cancelled status
    gray: [107, 114, 126], // For draft status
    overdueRed: [220, 38, 38], // Darker red for overdue badge
    overdueBackground: [254, 242, 242] // Light red background for overdue
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
    // Set font properties - using Helvetica for better consistency
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
    // Header background matching web preview (very light gray) - REDUCED HEIGHT
    this.addRectangle(0, 0, this.pageWidth, 55, this.colors.lightGray);

    // Logo placeholder (matching web preview style exactly) - SMALLER SIZE
    this.addRectangle(this.margin, this.margin, 35, 20, [200, 200, 200], this.colors.border);
    this.addText('Logo', this.margin + 17.5, this.margin + 12, { 
      align: 'center', 
      fontSize: 8, 
      color: this.colors.white 
    });

    // Company name with primary blue color (matching web exactly) - MOVED UP
    this.addText(invoice.billerInfo.businessName, this.margin, this.margin + 30, { 
      fontSize: 16, 
      fontStyle: 'bold',
      color: this.colors.primary
    });

    // Company address (smaller, muted text like web) - COMPACT SPACING
    let addressY = this.margin + 38;
    this.addText(invoice.billerInfo.addressLine1, this.margin, addressY, { 
      fontSize: 8, 
      color: this.colors.mutedText 
    });
    addressY += 3;

    if (invoice.billerInfo.addressLine2) {
      this.addText(invoice.billerInfo.addressLine2, this.margin, addressY, { 
        fontSize: 8, 
        color: this.colors.mutedText 
      });
      addressY += 3;
    }

    this.addText(`${invoice.billerInfo.city}, ${invoice.billerInfo.state} - ${invoice.billerInfo.postalCode}`, this.margin, addressY, { 
      fontSize: 8, 
      color: this.colors.mutedText 
    });
    addressY += 3;

    if (invoice.billerInfo.gstin) {
      this.addText(`GSTIN: ${invoice.billerInfo.gstin}`, this.margin, addressY, { 
        fontSize: 8, 
        color: this.colors.mutedText 
      });
    }

    // Right side - Invoice title and details (matching web layout exactly) - MOVED UP
    this.addText('INVOICE', this.pageWidth - this.margin, this.margin + 15, { 
      fontSize: 24, 
      fontStyle: 'bold', 
      align: 'right',
      color: [119, 119, 119] // Gray color like in web
    });

    this.addText(`# ${invoice.invoiceNumber}`, this.pageWidth - this.margin, this.margin + 25, { 
      fontSize: 12, 
      align: 'right',
      color: this.colors.mutedText
    });

    // REMOVED STATUS BADGE as requested

    // Separator line - MOVED UP
    this.addLine(this.pageWidth - this.margin - 60, this.margin + 35, this.pageWidth - this.margin, this.margin + 35, this.colors.border);

    // Invoice dates (matching web style exactly) - MOVED UP
    const invoiceDate = invoice.invoiceDate instanceof Date ? invoice.invoiceDate : invoice.invoiceDate.toDate();
    const dueDate = invoice.dueDate instanceof Date ? invoice.dueDate : invoice.dueDate.toDate();

    this.addText('Date:', this.pageWidth - this.margin - 50, this.margin + 42, { 
      fontSize: 9, 
      fontStyle: 'bold',
      color: this.colors.text
    });
    this.addText(format(invoiceDate, 'dd MMM, yyyy'), this.pageWidth - this.margin, this.margin + 42, { 
      fontSize: 9, 
      align: 'right',
      color: this.colors.text
    });

    this.addText('Due Date:', this.pageWidth - this.margin - 50, this.margin + 49, { 
      fontSize: 9, 
      fontStyle: 'bold',
      color: this.colors.text
    });
    this.addText(format(dueDate, 'dd MMM, yyyy'), this.pageWidth - this.margin, this.margin + 49, { 
      fontSize: 9, 
      align: 'right',
      color: this.colors.text
    });

    // REDUCED CURRENT Y to minimize space
    this.currentY = 65;
  }

  private addBillToSection(invoice: Invoice): void {
    this.checkPageBreak(40);

    // Bill To section (matching web layout exactly) - REDUCED SPACING
    this.addText('Bill To:', this.margin, this.currentY, { 
      fontSize: 11, 
      fontStyle: 'bold',
      color: this.colors.text
    });
    this.currentY += 6;

    // Client name in primary blue (like web)
    this.addText(invoice.client.name, this.margin, this.currentY, { 
      fontSize: 12, 
      fontStyle: 'bold',
      color: this.colors.primary
    });
    this.currentY += 6;

    // Address in muted text (exactly like web) - COMPACT SPACING
    this.addText(invoice.client.addressLine1, this.margin, this.currentY, { 
      fontSize: 8,
      color: this.colors.mutedText
    });
    this.currentY += 4;

    if (invoice.client.addressLine2) {
      this.addText(invoice.client.addressLine2, this.margin, this.currentY, { 
        fontSize: 8,
        color: this.colors.mutedText
      });
      this.currentY += 4;
    }

    this.addText(`${invoice.client.city}, ${invoice.client.state} - ${invoice.client.postalCode}`, this.margin, this.currentY, { 
      fontSize: 8,
      color: this.colors.mutedText
    });
    this.currentY += 4;

    if (invoice.client.gstin) {
      this.addText(`GSTIN: ${invoice.client.gstin}`, this.margin, this.currentY, { 
        fontSize: 8,
        color: this.colors.mutedText
      });
      this.currentY += 4;
    }

    // REDUCED SPACING
    this.currentY += 10;
  }

  private addLineItemsTable(invoice: Invoice): void {
    this.checkPageBreak(60);

    const currencySymbol = invoice.currency === "INR" ? "Rs." : (invoice.currency || "Rs.");

    // Prepare table data exactly like web
    const tableData = invoice.lineItems.map((item, index) => [
      (index + 1).toString(),
      item.productName,
      item.quantity.toString(),
      item.rate.toFixed(2),
      item.discountPercentage.toFixed(2) + '%',
      item.amount.toFixed(2)
    ]);

    // Table with exact web styling - OPTIMIZED COLUMN WIDTHS
    this.doc.autoTable({
      startY: this.currentY,
      head: [['#', 'Item/Service', 'Qty', `Rate (${currencySymbol})`, 'Discount (%)', `Amount (${currencySymbol})`]],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3, // Reduced padding
        lineColor: [229, 231, 235], // Light gray borders
        lineWidth: 0.5,
        textColor: [33, 33, 33], // Dark text
        font: 'helvetica',
      },
      headStyles: {
        fillColor: [248, 250, 252], // Very light gray header (NOT blue)
        textColor: [33, 33, 33], // Dark text in header
        fontStyle: 'bold',
        fontSize: 9,
        lineColor: [229, 231, 235],
        lineWidth: 0.5,
        halign: 'center',
      },
      bodyStyles: {
        fillColor: [255, 255, 255], // White background
        textColor: [33, 33, 33],
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251] // Very light alternating rows
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' }, // # - REDUCED WIDTH
        1: { cellWidth: 65, halign: 'left' },   // Item/Service - OPTIMIZED
        2: { cellWidth: 15, halign: 'center' }, // Qty - REDUCED
        3: { cellWidth: 30, halign: 'right' },  // Rate - OPTIMIZED
        4: { cellWidth: 22, halign: 'center' }, // Discount - REDUCED
        5: { cellWidth: 35, halign: 'right' }   // Amount - OPTIMIZED
      },
      margin: { left: this.margin, right: this.margin },
      tableLineColor: [229, 231, 235],
      tableLineWidth: 0.5,
      didDrawPage: (data: any) => {
        // Ensure consistent styling across pages
      }
    });

    // REDUCED SPACING AFTER TABLE
    this.currentY = (this.doc as any).lastAutoTable.finalY + 15;
  }

  private addTotalsSection(invoice: Invoice): void {
    this.checkPageBreak(60);

    // OPTIMIZED POSITIONING - moved more to the right and made more compact
    const startX = this.pageWidth - 80;
    const labelWidth = 35;
    const valueWidth = 35;
    const currencySymbol = invoice.currency === "INR" ? "Rs." : (invoice.currency || "Rs.");

    let totalY = this.currentY;

    // Subtotal - COMPACT SPACING
    this.addText('Subtotal:', startX, totalY, { 
      fontSize: 10,
      color: this.colors.mutedText
    });
    this.addText(`${currencySymbol}${invoice.subTotal.toFixed(2)}`, startX + labelWidth + valueWidth, totalY, { 
      fontSize: 10, 
      align: 'right',
      fontStyle: 'bold'
    });
    totalY += 6; // REDUCED SPACING

    // Tax details (matching web layout exactly) - COMPACT
    if (!invoice.isInterState) {
      this.addText('CGST:', startX, totalY, { 
        fontSize: 10,
        color: this.colors.mutedText
      });
      this.addText(`${currencySymbol}${invoice.totalCGST.toFixed(2)}`, startX + labelWidth + valueWidth, totalY, { 
        fontSize: 10, 
        align: 'right',
        fontStyle: 'bold'
      });
      totalY += 6;

      this.addText('SGST:', startX, totalY, { 
        fontSize: 10,
        color: this.colors.mutedText
      });
      this.addText(`${currencySymbol}${invoice.totalSGST.toFixed(2)}`, startX + labelWidth + valueWidth, totalY, { 
        fontSize: 10, 
        align: 'right',
        fontStyle: 'bold'
      });
      totalY += 6;
    } else {
      this.addText('IGST:', startX, totalY, { 
        fontSize: 10,
        color: this.colors.mutedText
      });
      this.addText(`${currencySymbol}${invoice.totalIGST.toFixed(2)}`, startX + labelWidth + valueWidth, totalY, { 
        fontSize: 10, 
        align: 'right',
        fontStyle: 'bold'
      });
      totalY += 6;
    }

    // Separator line
    this.addLine(startX, totalY + 2, startX + labelWidth + valueWidth, totalY + 2, this.colors.border);
    totalY += 8; // REDUCED SPACING

    // Grand Total (matching web style with primary color)
    this.addText('Grand Total:', startX, totalY, { 
      fontSize: 12, 
      fontStyle: 'bold',
      color: this.colors.text
    });
    this.addText(`${currencySymbol}${invoice.grandTotal.toFixed(2)}`, startX + labelWidth + valueWidth, totalY, { 
      fontSize: 12, 
      fontStyle: 'bold', 
      align: 'right',
      color: this.colors.primary
    });

    // REDUCED SPACING
    this.currentY = totalY + 20;
  }

  private addNotesAndTerms(invoice: Invoice): void {
    if (invoice.notes || invoice.termsAndConditions) {
      this.checkPageBreak(50);

      if (invoice.notes) {
        this.addText('Notes:', this.margin, this.currentY, { 
          fontSize: 10, 
          fontStyle: 'bold',
          color: this.colors.text
        });
        this.currentY += 6;
        
        const noteLines = this.doc.splitTextToSize(invoice.notes, this.pageWidth - 2 * this.margin);
        if (Array.isArray(noteLines)) {
          noteLines.forEach((line: string, index: number) => {
            this.addText(line, this.margin, this.currentY + (index * 4), { 
              fontSize: 9,
              color: this.colors.mutedText
            });
          });
          this.currentY += noteLines.length * 4 + 8;
        } else {
          this.addText(invoice.notes, this.margin, this.currentY, { 
            fontSize: 9,
            color: this.colors.mutedText
          });
          this.currentY += 12;
        }
      }

      if (invoice.termsAndConditions) {
        this.checkPageBreak(25);
        this.addText('Terms & Conditions:', this.margin, this.currentY, { 
          fontSize: 10, 
          fontStyle: 'bold',
          color: this.colors.text
        });
        this.currentY += 6;
        
        const termLines = this.doc.splitTextToSize(invoice.termsAndConditions, this.pageWidth - 2 * this.margin);
        if (Array.isArray(termLines)) {
          termLines.forEach((line: string, index: number) => {
            this.addText(line, this.margin, this.currentY + (index * 4), { 
              fontSize: 9,
              color: this.colors.mutedText
            });
          });
          this.currentY += termLines.length * 4 + 8;
        } else {
          this.addText(invoice.termsAndConditions, this.margin, this.currentY, { 
            fontSize: 9,
            color: this.colors.mutedText
          });
          this.currentY += 12;
        }
      }
    }
  }

  private addPaymentInfo(invoice: Invoice): void {
    if (invoice.billerInfo.bankName || invoice.billerInfo.upiId) {
      this.checkPageBreak(40);

      this.addText('Payment Information:', this.margin, this.currentY, { 
        fontSize: 10, 
        fontStyle: 'bold',
        color: this.colors.text
      });
      this.currentY += 8;

      // Light background box for payment info (like web) - REDUCED HEIGHT
      const boxHeight = 30;
      this.addRectangle(this.margin, this.currentY, this.pageWidth - 2 * this.margin, boxHeight, [248, 250, 252], this.colors.border);

      // Two column layout like web - COMPACT
      const leftCol = this.margin + 8;
      const rightCol = this.margin + (this.pageWidth - 2 * this.margin) / 2;
      let leftY = this.currentY + 6;
      let rightY = this.currentY + 6;

      if (invoice.billerInfo.bankName) {
        this.addText('Bank:', leftCol, leftY, { 
          fontSize: 8, 
          fontStyle: 'bold',
          color: this.colors.text
        });
        this.addText(invoice.billerInfo.bankName, leftCol + 20, leftY, { 
          fontSize: 8,
          color: this.colors.mutedText
        });
        leftY += 5;
      }

      if (invoice.billerInfo.accountNumber) {
        this.addText('A/C No:', leftCol, leftY, { 
          fontSize: 8, 
          fontStyle: 'bold',
          color: this.colors.text
        });
        this.addText(invoice.billerInfo.accountNumber, leftCol + 20, leftY, { 
          fontSize: 8,
          color: this.colors.mutedText
        });
        leftY += 5;
      }

      if (invoice.billerInfo.ifscCode) {
        this.addText('IFSC:', rightCol, rightY, { 
          fontSize: 8, 
          fontStyle: 'bold',
          color: this.colors.text
        });
        this.addText(invoice.billerInfo.ifscCode, rightCol + 20, rightY, { 
          fontSize: 8,
          color: this.colors.mutedText
        });
        rightY += 5;
      }

      if (invoice.billerInfo.upiId) {
        this.addText('UPI:', rightCol, rightY, { 
          fontSize: 8, 
          fontStyle: 'bold',
          color: this.colors.text
        });
        this.addText(invoice.billerInfo.upiId, rightCol + 20, rightY, { 
          fontSize: 8,
          color: this.colors.mutedText
        });
        rightY += 5;
      }

      this.currentY += boxHeight + 10;
    }
  }

  public generatePDF(invoice: Invoice): jsPDF {
    // Reset document
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.currentY = this.margin;

    // Add all sections in order (matching web layout exactly)
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