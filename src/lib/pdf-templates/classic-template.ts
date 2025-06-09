import { BasePDFTemplate } from './base-template';
import type { Invoice } from '@/lib/types';
import { format } from 'date-fns';

export class ClassicTemplate extends BasePDFTemplate {
  protected addHeader(invoice: Invoice): void {
    // Light gray header background - EXACT height as web
    this.addRect(0, 0, this.pageWidth, 40, this.colors.lightGray);

    // Logo placeholder - EXACT size and position as web
    this.addRect(this.margin, this.margin, 35, 18, [200, 200, 200]);
    this.addText('Logo', this.margin + 17.5, this.margin + 11, { 
      align: 'center', 
      fontSize: 8, 
      color: this.colors.white 
    });

    // Company name - EXACT position and styling as web
    this.addText(invoice.billerInfo.businessName, this.margin, this.margin + 25, { 
      fontSize: 16, 
      fontStyle: 'bold',
      color: this.colors.primary
    });

    // Company address - EXACT spacing as web
    let addressY = this.margin + 30;
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

    // Right side - EXACT positioning as web
    this.addText('INVOICE', this.pageWidth - this.margin, this.margin + 8, { 
      fontSize: 24, 
      fontStyle: 'bold', 
      align: 'right',
      color: [119, 119, 119] // Gray like web
    });

    this.addText(`# ${invoice.invoiceNumber}`, this.pageWidth - this.margin, this.margin + 16, { 
      fontSize: 11, 
      align: 'right',
      color: this.colors.mutedText
    });

    // Dates - EXACT positioning as web
    const invoiceDate = invoice.invoiceDate instanceof Date ? invoice.invoiceDate : invoice.invoiceDate.toDate();
    const dueDate = invoice.dueDate instanceof Date ? invoice.dueDate : invoice.dueDate.toDate();

    this.addText('Date:', this.pageWidth - this.margin - 35, this.margin + 25, { 
      fontSize: 9, 
      fontStyle: 'bold'
    });
    this.addText(format(invoiceDate, 'dd MMM, yyyy'), this.pageWidth - this.margin, this.margin + 25, { 
      fontSize: 9, 
      align: 'right'
    });

    this.addText('Due Date:', this.pageWidth - this.margin - 35, this.margin + 30, { 
      fontSize: 9, 
      fontStyle: 'bold'
    });
    this.addText(format(dueDate, 'dd MMM, yyyy'), this.pageWidth - this.margin, this.margin + 30, { 
      fontSize: 9, 
      align: 'right'
    });

    this.currentY = 45; // EXACT spacing as web
  }

  protected addBillToSection(invoice: Invoice): void {
    this.checkPageBreak(25);

    // Bill To - EXACT styling as web
    this.addText('Bill To:', this.margin, this.currentY, { 
      fontSize: 11, 
      fontStyle: 'bold'
    });
    this.currentY += 6;

    // Client name in primary blue - EXACT styling as web
    this.addText(invoice.client.name, this.margin, this.currentY, { 
      fontSize: 13, 
      fontStyle: 'bold',
      color: this.colors.primary
    });
    this.currentY += 6;

    // Address - EXACT spacing as web
    this.addText(invoice.client.addressLine1, this.margin, this.currentY, { 
      fontSize: 8,
      color: this.colors.mutedText
    });
    this.currentY += 3.5;

    if (invoice.client.addressLine2) {
      this.addText(invoice.client.addressLine2, this.margin, this.currentY, { 
        fontSize: 8,
        color: this.colors.mutedText
      });
      this.currentY += 3.5;
    }

    this.addText(`${invoice.client.city}, ${invoice.client.state} - ${invoice.client.postalCode}`, this.margin, this.currentY, { 
      fontSize: 8,
      color: this.colors.mutedText
    });
    this.currentY += 3.5;

    if (invoice.client.gstin) {
      this.addText(`GSTIN: ${invoice.client.gstin}`, this.margin, this.currentY, { 
        fontSize: 8,
        color: this.colors.mutedText
      });
      this.currentY += 3.5;
    }

    this.currentY += 10; // EXACT spacing as web
  }

  protected addLineItemsTable(invoice: Invoice): void {
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

    // Table with EXACT web styling
    this.doc.autoTable({
      startY: this.currentY,
      head: [['#', 'Item/Service', 'Qty', `Rate (${currencySymbol})`, 'Discount (%)', `Amount (${currencySymbol})`]],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        lineColor: [229, 231, 235],
        lineWidth: 0.2,
        textColor: [17, 24, 39],
        font: 'helvetica',
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [248, 250, 252], // Light gray header
        textColor: [17, 24, 39],
        fontStyle: 'bold',
        fontSize: 9,
        lineColor: [229, 231, 235],
        lineWidth: 0.2,
        halign: 'center',
        cellPadding: 3,
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [17, 24, 39],
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251]
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' }, // # 
        1: { cellWidth: 65, halign: 'left' },   // Item/Service - WIDER
        2: { cellWidth: 15, halign: 'center' }, // Qty
        3: { cellWidth: 25, halign: 'right' },  // Rate
        4: { cellWidth: 20, halign: 'center' }, // Discount
        5: { cellWidth: 33, halign: 'right' }   // Amount - WIDER, RIGHT ALIGNED
      },
      margin: { left: this.margin, right: this.margin },
      tableLineColor: [229, 231, 235],
      tableLineWidth: 0.2,
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 8;
  }

  protected addTotalsSection(invoice: Invoice): void {
    this.checkPageBreak(35);

    // Position totals on the right - EXACT as web
    const startX = this.pageWidth - 70;
    const labelWidth = 35;
    const valueWidth = 30;
    const currencySymbol = invoice.currency === "INR" ? "Rs." : (invoice.currency || "Rs.");

    let totalY = this.currentY;

    // Subtotal
    this.addText('Subtotal:', startX, totalY, { 
      fontSize: 10,
      color: this.colors.mutedText
    });
    this.addText(`${currencySymbol}${invoice.subTotal.toFixed(2)}`, startX + labelWidth + valueWidth, totalY, { 
      fontSize: 10, 
      align: 'right',
      fontStyle: 'bold'
    });
    totalY += 5;

    // Tax details
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
      totalY += 5;

      this.addText('SGST:', startX, totalY, { 
        fontSize: 10,
        color: this.colors.mutedText
      });
      this.addText(`${currencySymbol}${invoice.totalSGST.toFixed(2)}`, startX + labelWidth + valueWidth, totalY, { 
        fontSize: 10, 
        align: 'right',
        fontStyle: 'bold'
      });
      totalY += 5;
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
      totalY += 5;
    }

    // Separator line
    this.addLine(startX, totalY + 2, startX + labelWidth + valueWidth, totalY + 2);
    totalY += 8;

    // Grand Total - EXACT styling as web
    this.addText('Grand Total:', startX, totalY, { 
      fontSize: 12, 
      fontStyle: 'bold'
    });
    this.addText(`${currencySymbol}${invoice.grandTotal.toFixed(2)}`, startX + labelWidth + valueWidth, totalY, { 
      fontSize: 12, 
      fontStyle: 'bold', 
      align: 'right',
      color: this.colors.primary
    });

    this.currentY = totalY + 15;
  }

  protected addNotesSection(invoice: Invoice): void {
    if (invoice.notes || invoice.termsAndConditions) {
      this.checkPageBreak(30);

      if (invoice.termsAndConditions) {
        this.addText('Terms & Conditions:', this.margin, this.currentY, { 
          fontSize: 10, 
          fontStyle: 'bold'
        });
        this.currentY += 6;
        
        const height = this.addText(invoice.termsAndConditions, this.margin, this.currentY, { 
          fontSize: 9,
          color: this.colors.mutedText,
          maxWidth: this.pageWidth - 2 * this.margin
        });
        this.currentY += height + 8;
      }

      if (invoice.notes) {
        this.addText('Notes:', this.margin, this.currentY, { 
          fontSize: 10, 
          fontStyle: 'bold'
        });
        this.currentY += 6;
        
        const height = this.addText(invoice.notes, this.margin, this.currentY, { 
          fontSize: 9,
          color: this.colors.mutedText,
          maxWidth: this.pageWidth - 2 * this.margin
        });
        this.currentY += height + 8;
      }
    }
  }

  protected addPaymentInfo(invoice: Invoice): void {
    if (invoice.billerInfo.bankName || invoice.billerInfo.upiId) {
      this.checkPageBreak(25);

      this.addText('Payment Information:', this.margin, this.currentY, { 
        fontSize: 10, 
        fontStyle: 'bold'
      });
      this.currentY += 6;

      // Light background box - EXACT as web
      const boxHeight = 18;
      this.addRect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, boxHeight, this.colors.lightGray);

      // Two column layout - EXACT as web
      const leftCol = this.margin + 4;
      const rightCol = this.margin + (this.pageWidth - 2 * this.margin) / 2 + 2;
      let leftY = this.currentY + 5;
      let rightY = this.currentY + 5;

      if (invoice.billerInfo.bankName) {
        this.addText('Bank:', leftCol, leftY, { 
          fontSize: 8, 
          fontStyle: 'bold'
        });
        this.addText(invoice.billerInfo.bankName, leftCol + 18, leftY, { 
          fontSize: 8,
          color: this.colors.mutedText
        });
        leftY += 4;
      }

      if (invoice.billerInfo.accountNumber) {
        this.addText('A/C No:', leftCol, leftY, { 
          fontSize: 8, 
          fontStyle: 'bold'
        });
        this.addText(invoice.billerInfo.accountNumber, leftCol + 18, leftY, { 
          fontSize: 8,
          color: this.colors.mutedText
        });
      }

      if (invoice.billerInfo.ifscCode) {
        this.addText('IFSC:', rightCol, rightY, { 
          fontSize: 8, 
          fontStyle: 'bold'
        });
        this.addText(invoice.billerInfo.ifscCode, rightCol + 18, rightY, { 
          fontSize: 8,
          color: this.colors.mutedText
        });
        rightY += 4;
      }

      if (invoice.billerInfo.upiId) {
        this.addText('UPI:', rightCol, rightY, { 
          fontSize: 8, 
          fontStyle: 'bold'
        });
        this.addText(invoice.billerInfo.upiId, rightCol + 18, rightY, { 
          fontSize: 8,
          color: this.colors.mutedText
        });
      }

      this.currentY += boxHeight + 8;
    }
  }
}