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
    text: [33, 33, 33], // Dark text
    mutedText: [107, 114, 126], // Muted text color
    lightGray: [248, 250, 252], // Very light gray background like web
    white: [255, 255, 255],
    border: [229, 231, 235], // Light border color
    tableHeader: [248, 250, 252], // Very light gray for table header (NOT blue)
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
  }): void {
    // Set font properties - using Helvetica for better consistency
    this.doc.setFont('helvetica', options?.fontStyle || 'normal');
    this.doc.setFontSize(options?.fontSize || 10);
    
    // Set text color
    if (options?.color) {
      this.doc.setTextColor(options.color[0], options.color[1], options.color[2]);
    } else {
      this.doc.setTextColor(this.colors.text[0], this.colors.text[1], this.colors.text[2]);
    }

    // Add text with proper alignment
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
      this.doc.setDrawColor(this.colors.border[0], this.colors.border[1], this.colors.border[2]);
    }
    
    this.doc.setLineWidth(0.1);
    
    if (fillColor) {
      this.doc.rect(x, y, width, height, 'FD'); // Fill and Draw
    } else {
      this.doc.rect(x, y, width, height, 'D'); // Draw only
    }
  }

  private addLine(x1: number, y1: number, x2: number, y2: number, color?: number[]): void {
    if (color) {
      this.doc.setDrawColor(color[0], color[1], color[2]);
    } else {
      this.doc.setDrawColor(this.colors.border[0], this.colors.border[1], this.colors.border[2]);
    }
    this.doc.setLineWidth(0.1);
    this.doc.line(x1, y1, x2, y2);
  }

  private addHeader(invoice: Invoice): void {
    // Header background - REDUCED HEIGHT to 45mm
    this.addRectangle(0, 0, this.pageWidth, 45, this.colors.lightGray);

    // Logo placeholder - SMALLER SIZE
    this.addRectangle(this.margin, this.margin, 30, 15, [200, 200, 200], this.colors.border);
    this.addText('Logo', this.margin + 15, this.margin + 9, { 
      align: 'center', 
      fontSize: 7, 
      color: this.colors.white 
    });

    // Company name - MOVED UP and SMALLER
    this.addText(invoice.billerInfo.businessName, this.margin, this.margin + 22, { 
      fontSize: 14, 
      fontStyle: 'bold',
      color: this.colors.primary
    });

    // Company address - COMPACT SPACING, SMALLER TEXT
    let addressY = this.margin + 28;
    this.addText(invoice.billerInfo.addressLine1, this.margin, addressY, { 
      fontSize: 7, 
      color: this.colors.mutedText 
    });
    addressY += 2.5;

    if (invoice.billerInfo.addressLine2) {
      this.addText(invoice.billerInfo.addressLine2, this.margin, addressY, { 
        fontSize: 7, 
        color: this.colors.mutedText 
      });
      addressY += 2.5;
    }

    this.addText(`${invoice.billerInfo.city}, ${invoice.billerInfo.state} - ${invoice.billerInfo.postalCode}`, this.margin, addressY, { 
      fontSize: 7, 
      color: this.colors.mutedText 
    });
    addressY += 2.5;

    if (invoice.billerInfo.gstin) {
      this.addText(`GSTIN: ${invoice.billerInfo.gstin}`, this.margin, addressY, { 
        fontSize: 7, 
        color: this.colors.mutedText 
      });
    }

    // Right side - Invoice title and details - MOVED UP
    this.addText('INVOICE', this.pageWidth - this.margin, this.margin + 12, { 
      fontSize: 20, 
      fontStyle: 'bold', 
      align: 'right',
      color: [119, 119, 119] // Gray color like in web
    });

    this.addText(`# ${invoice.invoiceNumber}`, this.pageWidth - this.margin, this.margin + 20, { 
      fontSize: 10, 
      align: 'right',
      color: this.colors.mutedText
    });

    // Separator line - MOVED UP
    this.addLine(this.pageWidth - this.margin - 50, this.margin + 25, this.pageWidth - this.margin, this.margin + 25, this.colors.border);

    // Invoice dates - MOVED UP and SMALLER
    const invoiceDate = invoice.invoiceDate instanceof Date ? invoice.invoiceDate : invoice.invoiceDate.toDate();
    const dueDate = invoice.dueDate instanceof Date ? invoice.dueDate : invoice.dueDate.toDate();

    this.addText('Date:', this.pageWidth - this.margin - 40, this.margin + 30, { 
      fontSize: 8, 
      fontStyle: 'bold',
      color: this.colors.text
    });
    this.addText(format(invoiceDate, 'dd MMM, yyyy'), this.pageWidth - this.margin, this.margin + 30, { 
      fontSize: 8, 
      align: 'right',
      color: this.colors.text
    });

    this.addText('Due Date:', this.pageWidth - this.margin - 40, this.margin + 35, { 
      fontSize: 8, 
      fontStyle: 'bold',
      color: this.colors.text
    });
    this.addText(format(dueDate, 'dd MMM, yyyy'), this.pageWidth - this.margin, this.margin + 35, { 
      fontSize: 8, 
      align: 'right',
      color: this.colors.text
    });

    // Set current Y to reduced value
    this.currentY = 50;
  }

  private addBillToSection(invoice: Invoice): void {
    this.checkPageBreak(30);

    // Bill To section - REDUCED SPACING
    this.addText('Bill To:', this.margin, this.currentY, { 
      fontSize: 10, 
      fontStyle: 'bold',
      color: this.colors.text
    });
    this.currentY += 5;

    // Client name in primary blue
    this.addText(invoice.client.name, this.margin, this.currentY, { 
      fontSize: 11, 
      fontStyle: 'bold',
      color: this.colors.primary
    });
    this.currentY += 5;

    // Address - VERY COMPACT SPACING
    this.addText(invoice.client.addressLine1, this.margin, this.currentY, { 
      fontSize: 7,
      color: this.colors.mutedText
    });
    this.currentY += 3;

    if (invoice.client.addressLine2) {
      this.addText(invoice.client.addressLine2, this.margin, this.currentY, { 
        fontSize: 7,
        color: this.colors.mutedText
      });
      this.currentY += 3;
    }

    this.addText(`${invoice.client.city}, ${invoice.client.state} - ${invoice.client.postalCode}`, this.margin, this.currentY, { 
      fontSize: 7,
      color: this.colors.mutedText
    });
    this.currentY += 3;

    if (invoice.client.gstin) {
      this.addText(`GSTIN: ${invoice.client.gstin}`, this.margin, this.currentY, { 
        fontSize: 7,
        color: this.colors.mutedText
      });
      this.currentY += 3;
    }

    // MINIMAL SPACING
    this.currentY += 8;
  }

  private addLineItemsTable(invoice: Invoice): void {
    this.checkPageBreak(50);

    const currencySymbol = invoice.currency === "INR" ? "Rs." : (invoice.currency || "Rs.");

    // Prepare table data
    const tableData = invoice.lineItems.map((item, index) => [
      (index + 1).toString(),
      item.productName,
      item.quantity.toString(),
      item.rate.toFixed(2),
      item.discountPercentage.toFixed(2) + '%',
      item.amount.toFixed(2)
    ]);

    // Table with EXACT web styling and OPTIMIZED column widths
    this.doc.autoTable({
      startY: this.currentY,
      head: [['#', 'Item/Service', 'Qty', `Rate (${currencySymbol})`, 'Discount (%)', `Amount (${currencySymbol})`]],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 8, // Smaller font
        cellPadding: 2, // Reduced padding
        lineColor: [229, 231, 235], // Light gray borders
        lineWidth: 0.3,
        textColor: [33, 33, 33], // Dark text
        font: 'helvetica',
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [248, 250, 252], // Very light gray header (NOT blue)
        textColor: [33, 33, 33], // Dark text in header
        fontStyle: 'bold',
        fontSize: 8,
        lineColor: [229, 231, 235],
        lineWidth: 0.3,
        halign: 'center',
        cellPadding: 2.5,
      },
      bodyStyles: {
        fillColor: [255, 255, 255], // White background
        textColor: [33, 33, 33],
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251] // Very light alternating rows
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' }, // # - NARROW
        1: { cellWidth: 70, halign: 'left' },   // Item/Service - WIDE
        2: { cellWidth: 12, halign: 'center' }, // Qty - NARROW
        3: { cellWidth: 25, halign: 'right' },  // Rate - MEDIUM
        4: { cellWidth: 18, halign: 'center' }, // Discount - NARROW
        5: { cellWidth: 30, halign: 'right' }   // Amount - MEDIUM, RIGHT ALIGNED
      },
      margin: { left: this.margin, right: this.margin },
      tableLineColor: [229, 231, 235],
      tableLineWidth: 0.3,
    });

    // MINIMAL SPACING AFTER TABLE
    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
  }

  private addTotalsSection(invoice: Invoice): void {
    this.checkPageBreak(40);

    // Position totals on the right - OPTIMIZED
    const startX = this.pageWidth - 65; // Moved more to the right
    const labelWidth = 30;
    const valueWidth = 30;
    const currencySymbol = invoice.currency === "INR" ? "Rs." : (invoice.currency || "Rs.");

    let totalY = this.currentY;

    // Subtotal - COMPACT
    this.addText('Subtotal:', startX, totalY, { 
      fontSize: 9,
      color: this.colors.mutedText
    });
    this.addText(`${currencySymbol}${invoice.subTotal.toFixed(2)}`, startX + labelWidth + valueWidth, totalY, { 
      fontSize: 9, 
      align: 'right',
      fontStyle: 'bold'
    });
    totalY += 5;

    // Tax details - COMPACT
    if (!invoice.isInterState) {
      this.addText('CGST:', startX, totalY, { 
        fontSize: 9,
        color: this.colors.mutedText
      });
      this.addText(`${currencySymbol}${invoice.totalCGST.toFixed(2)}`, startX + labelWidth + valueWidth, totalY, { 
        fontSize: 9, 
        align: 'right',
        fontStyle: 'bold'
      });
      totalY += 5;

      this.addText('SGST:', startX, totalY, { 
        fontSize: 9,
        color: this.colors.mutedText
      });
      this.addText(`${currencySymbol}${invoice.totalSGST.toFixed(2)}`, startX + labelWidth + valueWidth, totalY, { 
        fontSize: 9, 
        align: 'right',
        fontStyle: 'bold'
      });
      totalY += 5;
    } else {
      this.addText('IGST:', startX, totalY, { 
        fontSize: 9,
        color: this.colors.mutedText
      });
      this.addText(`${currencySymbol}${invoice.totalIGST.toFixed(2)}`, startX + labelWidth + valueWidth, totalY, { 
        fontSize: 9, 
        align: 'right',
        fontStyle: 'bold'
      });
      totalY += 5;
    }

    // Separator line
    this.addLine(startX, totalY + 1, startX + labelWidth + valueWidth, totalY + 1, this.colors.border);
    totalY += 6;

    // Grand Total
    this.addText('Grand Total:', startX, totalY, { 
      fontSize: 11, 
      fontStyle: 'bold',
      color: this.colors.text
    });
    this.addText(`${currencySymbol}${invoice.grandTotal.toFixed(2)}`, startX + labelWidth + valueWidth, totalY, { 
      fontSize: 11, 
      fontStyle: 'bold', 
      align: 'right',
      color: this.colors.primary
    });

    this.currentY = totalY + 15;
  }

  private addNotesAndTerms(invoice: Invoice): void {
    if (invoice.notes || invoice.termsAndConditions) {
      this.checkPageBreak(40);

      if (invoice.notes) {
        this.addText('Notes:', this.margin, this.currentY, { 
          fontSize: 9, 
          fontStyle: 'bold',
          color: this.colors.text
        });
        this.currentY += 5;
        
        // Split text if too long
        const noteLines = this.doc.splitTextToSize(invoice.notes, this.pageWidth - 2 * this.margin);
        if (Array.isArray(noteLines)) {
          noteLines.forEach((line: string, index: number) => {
            this.addText(line, this.margin, this.currentY + (index * 3.5), { 
              fontSize: 8,
              color: this.colors.mutedText
            });
          });
          this.currentY += noteLines.length * 3.5 + 6;
        } else {
          this.addText(invoice.notes, this.margin, this.currentY, { 
            fontSize: 8,
            color: this.colors.mutedText
          });
          this.currentY += 10;
        }
      }

      if (invoice.termsAndConditions) {
        this.checkPageBreak(20);
        this.addText('Terms & Conditions:', this.margin, this.currentY, { 
          fontSize: 9, 
          fontStyle: 'bold',
          color: this.colors.text
        });
        this.currentY += 5;
        
        const termLines = this.doc.splitTextToSize(invoice.termsAndConditions, this.pageWidth - 2 * this.margin);
        if (Array.isArray(termLines)) {
          termLines.forEach((line: string, index: number) => {
            this.addText(line, this.margin, this.currentY + (index * 3.5), { 
              fontSize: 8,
              color: this.colors.mutedText
            });
          });
          this.currentY += termLines.length * 3.5 + 6;
        } else {
          this.addText(invoice.termsAndConditions, this.margin, this.currentY, { 
            fontSize: 8,
            color: this.colors.mutedText
          });
          this.currentY += 10;
        }
      }
    }
  }

  private addPaymentInfo(invoice: Invoice): void {
    if (invoice.billerInfo.bankName || invoice.billerInfo.upiId) {
      this.checkPageBreak(30);

      this.addText('Payment Information:', this.margin, this.currentY, { 
        fontSize: 9, 
        fontStyle: 'bold',
        color: this.colors.text
      });
      this.currentY += 6;

      // Light background box - REDUCED HEIGHT
      const boxHeight = 20;
      this.addRectangle(this.margin, this.currentY, this.pageWidth - 2 * this.margin, boxHeight, [248, 250, 252], this.colors.border);

      // Two column layout - COMPACT
      const leftCol = this.margin + 5;
      const rightCol = this.margin + (this.pageWidth - 2 * this.margin) / 2;
      let leftY = this.currentY + 4;
      let rightY = this.currentY + 4;

      if (invoice.billerInfo.bankName) {
        this.addText('Bank:', leftCol, leftY, { 
          fontSize: 7, 
          fontStyle: 'bold',
          color: this.colors.text
        });
        this.addText(invoice.billerInfo.bankName, leftCol + 15, leftY, { 
          fontSize: 7,
          color: this.colors.mutedText
        });
        leftY += 4;
      }

      if (invoice.billerInfo.accountNumber) {
        this.addText('A/C No:', leftCol, leftY, { 
          fontSize: 7, 
          fontStyle: 'bold',
          color: this.colors.text
        });
        this.addText(invoice.billerInfo.accountNumber, leftCol + 15, leftY, { 
          fontSize: 7,
          color: this.colors.mutedText
        });
      }

      if (invoice.billerInfo.ifscCode) {
        this.addText('IFSC:', rightCol, rightY, { 
          fontSize: 7, 
          fontStyle: 'bold',
          color: this.colors.text
        });
        this.addText(invoice.billerInfo.ifscCode, rightCol + 15, rightY, { 
          fontSize: 7,
          color: this.colors.mutedText
        });
        rightY += 4;
      }

      if (invoice.billerInfo.upiId) {
        this.addText('UPI:', rightCol, rightY, { 
          fontSize: 7, 
          fontStyle: 'bold',
          color: this.colors.text
        });
        this.addText(invoice.billerInfo.upiId, rightCol + 15, rightY, { 
          fontSize: 7,
          color: this.colors.mutedText
        });
      }

      this.currentY += boxHeight + 8;
    }
  }

  public generatePDF(invoice: Invoice): jsPDF {
    // Reset document
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.currentY = this.margin;

    // Add all sections in order
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