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

  private addText(text: string, x: number, y: number, options?: { fontSize?: number; fontStyle?: string; align?: 'left' | 'center' | 'right' }): void {
    if (options?.fontSize) this.doc.setFontSize(options.fontSize);
    if (options?.fontStyle) this.doc.setFont('helvetica', options.fontStyle);
    
    if (options?.align === 'right') {
      this.doc.text(text, x, y, { align: 'right' });
    } else if (options?.align === 'center') {
      this.doc.text(text, x, y, { align: 'center' });
    } else {
      this.doc.text(text, x, y);
    }
  }

  private addLine(x1: number, y1: number, x2: number, y2: number): void {
    this.doc.line(x1, y1, x2, y2);
  }

  private addHeader(invoice: Invoice): void {
    // Company Logo placeholder (if logoUrl exists, you could load and add it)
    if (invoice.billerInfo.logoUrl) {
      // For now, just add a placeholder box
      this.doc.rect(this.margin, this.currentY, 40, 20);
      this.addText('LOGO', this.margin + 20, this.currentY + 12, { align: 'center', fontSize: 10 });
    }

    // Company Info
    this.addText(invoice.billerInfo.businessName, this.margin, this.currentY + 30, { fontSize: 16, fontStyle: 'bold' });
    this.currentY += 40;

    this.addText(invoice.billerInfo.addressLine1, this.margin, this.currentY, { fontSize: 10 });
    this.currentY += 5;

    if (invoice.billerInfo.addressLine2) {
      this.addText(invoice.billerInfo.addressLine2, this.margin, this.currentY, { fontSize: 10 });
      this.currentY += 5;
    }

    this.addText(`${invoice.billerInfo.city}, ${invoice.billerInfo.state} - ${invoice.billerInfo.postalCode}`, this.margin, this.currentY, { fontSize: 10 });
    this.currentY += 5;

    if (invoice.billerInfo.gstin) {
      this.addText(`GSTIN: ${invoice.billerInfo.gstin}`, this.margin, this.currentY, { fontSize: 10 });
      this.currentY += 5;
    }

    // Invoice Title and Number (Right side)
    this.addText('INVOICE', this.pageWidth - this.margin, this.currentY - 35, { fontSize: 24, fontStyle: 'bold', align: 'right' });
    this.addText(`# ${invoice.invoiceNumber}`, this.pageWidth - this.margin, this.currentY - 25, { fontSize: 14, align: 'right' });

    // Invoice dates
    const invoiceDate = invoice.invoiceDate instanceof Date ? invoice.invoiceDate : invoice.invoiceDate.toDate();
    const dueDate = invoice.dueDate instanceof Date ? invoice.dueDate : invoice.dueDate.toDate();

    this.addText(`Date: ${format(invoiceDate, 'dd MMM, yyyy')}`, this.pageWidth - this.margin, this.currentY - 15, { fontSize: 10, align: 'right' });
    this.addText(`Due Date: ${format(dueDate, 'dd MMM, yyyy')}`, this.pageWidth - this.margin, this.currentY - 8, { fontSize: 10, align: 'right' });

    this.currentY += 15;
  }

  private addBillToSection(invoice: Invoice): void {
    this.checkPageBreak(40);

    // Bill To section
    this.addText('Bill To:', this.margin, this.currentY, { fontSize: 12, fontStyle: 'bold' });
    this.currentY += 8;

    this.addText(invoice.client.name, this.margin, this.currentY, { fontSize: 11, fontStyle: 'bold' });
    this.currentY += 6;

    this.addText(invoice.client.addressLine1, this.margin, this.currentY, { fontSize: 10 });
    this.currentY += 5;

    if (invoice.client.addressLine2) {
      this.addText(invoice.client.addressLine2, this.margin, this.currentY, { fontSize: 10 });
      this.currentY += 5;
    }

    this.addText(`${invoice.client.city}, ${invoice.client.state} - ${invoice.client.postalCode}`, this.margin, this.currentY, { fontSize: 10 });
    this.currentY += 5;

    if (invoice.client.gstin) {
      this.addText(`GSTIN: ${invoice.client.gstin}`, this.margin, this.currentY, { fontSize: 10 });
      this.currentY += 5;
    }

    this.currentY += 10;
  }

  private addLineItemsTable(invoice: Invoice): void {
    this.checkPageBreak(60);

    const tableColumns = [
      { header: '#', dataKey: 'sno' },
      { header: 'Item/Service', dataKey: 'productName' },
      { header: 'Qty', dataKey: 'quantity' },
      { header: 'Rate', dataKey: 'rate' },
      { header: 'Discount %', dataKey: 'discount' },
      { header: 'Amount', dataKey: 'amount' }
    ];

    const tableRows = invoice.lineItems.map((item, index) => ({
      sno: (index + 1).toString(),
      productName: item.productName,
      quantity: item.quantity.toString(),
      rate: `₹${item.rate.toFixed(2)}`,
      discount: `${item.discountPercentage.toFixed(1)}%`,
      amount: `₹${item.amount.toFixed(2)}`
    }));

    this.doc.autoTable({
      startY: this.currentY,
      head: [tableColumns.map(col => col.header)],
      body: tableRows.map(row => tableColumns.map(col => row[col.dataKey as keyof typeof row])),
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [63, 81, 181], // Primary color
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 15 }, // S.No
        1: { cellWidth: 60 }, // Item/Service
        2: { cellWidth: 20 }, // Qty
        3: { cellWidth: 25 }, // Rate
        4: { cellWidth: 25 }, // Discount
        5: { cellWidth: 25 }  // Amount
      },
      margin: { left: this.margin, right: this.margin },
    });

    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
  }

  private addTotalsSection(invoice: Invoice): void {
    this.checkPageBreak(60);

    const startX = this.pageWidth - 80;
    const currencySymbol = invoice.currency === "INR" ? "₹" : (invoice.currency || "₹");

    // Subtotal
    this.addText('Subtotal:', startX, this.currentY, { fontSize: 10 });
    this.addText(`${currencySymbol}${invoice.subTotal.toFixed(2)}`, this.pageWidth - this.margin, this.currentY, { fontSize: 10, align: 'right' });
    this.currentY += 6;

    // Tax details
    if (!invoice.isInterState) {
      this.addText('CGST:', startX, this.currentY, { fontSize: 10 });
      this.addText(`${currencySymbol}${invoice.totalCGST.toFixed(2)}`, this.pageWidth - this.margin, this.currentY, { fontSize: 10, align: 'right' });
      this.currentY += 6;

      this.addText('SGST:', startX, this.currentY, { fontSize: 10 });
      this.addText(`${currencySymbol}${invoice.totalSGST.toFixed(2)}`, this.pageWidth - this.margin, this.currentY, { fontSize: 10, align: 'right' });
      this.currentY += 6;
    } else {
      this.addText('IGST:', startX, this.currentY, { fontSize: 10 });
      this.addText(`${currencySymbol}${invoice.totalIGST.toFixed(2)}`, this.pageWidth - this.margin, this.currentY, { fontSize: 10, align: 'right' });
      this.currentY += 6;
    }

    // Line above total
    this.addLine(startX, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 8;

    // Grand Total
    this.addText('Grand Total:', startX, this.currentY, { fontSize: 12, fontStyle: 'bold' });
    this.addText(`${currencySymbol}${invoice.grandTotal.toFixed(2)}`, this.pageWidth - this.margin, this.currentY, { fontSize: 12, fontStyle: 'bold', align: 'right' });
    this.currentY += 15;
  }

  private addNotesAndTerms(invoice: Invoice): void {
    if (invoice.notes || invoice.termsAndConditions) {
      this.checkPageBreak(40);

      if (invoice.notes) {
        this.addText('Notes:', this.margin, this.currentY, { fontSize: 11, fontStyle: 'bold' });
        this.currentY += 6;
        
        // Split notes into lines if too long
        const noteLines = this.doc.splitTextToSize(invoice.notes, this.pageWidth - 2 * this.margin);
        noteLines.forEach((line: string) => {
          this.checkPageBreak(6);
          this.addText(line, this.margin, this.currentY, { fontSize: 10 });
          this.currentY += 5;
        });
        this.currentY += 5;
      }

      if (invoice.termsAndConditions) {
        this.checkPageBreak(20);
        this.addText('Terms & Conditions:', this.margin, this.currentY, { fontSize: 11, fontStyle: 'bold' });
        this.currentY += 6;
        
        const termLines = this.doc.splitTextToSize(invoice.termsAndConditions, this.pageWidth - 2 * this.margin);
        termLines.forEach((line: string) => {
          this.checkPageBreak(6);
          this.addText(line, this.margin, this.currentY, { fontSize: 10 });
          this.currentY += 5;
        });
        this.currentY += 5;
      }
    }
  }

  private addPaymentInfo(invoice: Invoice): void {
    if (invoice.billerInfo.bankName || invoice.billerInfo.upiId) {
      this.checkPageBreak(40);

      this.addText('Payment Information:', this.margin, this.currentY, { fontSize: 11, fontStyle: 'bold' });
      this.currentY += 8;

      if (invoice.billerInfo.bankName) {
        this.addText(`Bank: ${invoice.billerInfo.bankName}`, this.margin, this.currentY, { fontSize: 10 });
        this.currentY += 5;
      }

      if (invoice.billerInfo.accountNumber) {
        this.addText(`A/C No: ${invoice.billerInfo.accountNumber}`, this.margin, this.currentY, { fontSize: 10 });
        this.currentY += 5;
      }

      if (invoice.billerInfo.ifscCode) {
        this.addText(`IFSC: ${invoice.billerInfo.ifscCode}`, this.margin, this.currentY, { fontSize: 10 });
        this.currentY += 5;
      }

      if (invoice.billerInfo.upiId) {
        this.addText(`UPI: ${invoice.billerInfo.upiId}`, this.margin, this.currentY, { fontSize: 10 });
        this.currentY += 5;
      }
    }
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

    return this.doc;
  }

  public downloadPDF(invoice: Invoice, filename?: string): void {
    const pdf = this.generatePDF(invoice);
    const fileName = filename || `invoice-${invoice.invoiceNumber || 'details'}.pdf`;
    pdf.save(fileName);
  }
}