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
  private headerBgColor: string = '#f8f9fa'; // Light gray background for header

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

  private async addLogo(logoUrl: string, x: number, y: number, width: number, height: number): Promise<boolean> {
    try {
      if (!logoUrl || logoUrl.trim() === '') {
        return false;
      }

      // Create a promise to load the image
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          try {
            // Create a canvas to convert the image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              resolve(false);
              return;
            }

            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            // Get image data as base64
            const dataURL = canvas.toDataURL('image/jpeg', 0.8);
            
            // Add image to PDF
            this.doc.addImage(dataURL, 'JPEG', x, y, width, height);
            resolve(true);
          } catch (error) {
            console.warn('Error processing logo image:', error);
            resolve(false);
          }
        };
        
        img.onerror = () => {
          console.warn('Failed to load logo image:', logoUrl);
          resolve(false);
        };
        
        // Set a timeout to avoid hanging
        setTimeout(() => {
          resolve(false);
        }, 5000);
        
        img.src = logoUrl;
      });
    } catch (error) {
      console.warn('Error loading logo:', error);
      return false;
    }
  }

  private addLogoPlaceholder(x: number, y: number, width: number, height: number) {
    // Add a simple logo placeholder rectangle
    this.addRect(x, y, width, height, 'S', undefined, '#dee2e6');
    this.addText('LOGO', x + width/2, y + height/2 + 2, { 
      align: 'center', 
      fontSize: 8, 
      color: '#6c757d'
    });
  }

  public async generateInvoicePDF(invoice: Invoice, options: PDFGenerationOptions = {}): Promise<void> {
    const { filename = `invoice-${invoice.invoiceNumber}.pdf`, download = true } = options;

    // Header Section with background - Clean design matching the image
    await this.addHeader(invoice);
    
    // Bill To Section
    this.addBillToSection(invoice);
    
    // Line Items Table - Clean table design
    this.addLineItemsTable(invoice);
    
    // Totals Section - Right aligned
    this.addTotalsSection(invoice);
    
    // Notes and Payment Info with divider (removed terms and conditions)
    this.addFooterSections(invoice);

    if (download) {
      this.doc.save(filename);
    }
  }

  private async addHeader(invoice: Invoice) {
    // Header background - light gray background like in the preview
    const headerHeight = 55;
    this.addRect(0, 0, this.pageWidth, headerHeight, 'F', this.headerBgColor);
    
    // Header layout matching the design exactly
    const headerY = this.margin;
    
    // Logo section - try to load actual logo or show placeholder
    const logoWidth = 25;
    const logoHeight = 20;
    
    let logoLoaded = false;
    if (invoice.billerInfo.logoUrl) {
      logoLoaded = await this.addLogo(invoice.billerInfo.logoUrl, this.margin, headerY, logoWidth, logoHeight);
    }
    
    if (!logoLoaded) {
      // Show placeholder if no logo or failed to load
      this.addLogoPlaceholder(this.margin, headerY, logoWidth, logoHeight);
    }

    // Company name and details - positioned next to logo
    const companyStartX = this.margin + logoWidth + 5;
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
      // Highlight the GSTIN with background color and bold text
      const gstinText = `GSTIN: ${invoice.billerInfo.gstin}`;
      const textWidth = this.doc.getTextWidth(gstinText) + 4;
      
      // Add background rectangle for GSTIN
      this.addRect(companyStartX - 2, companyY - 3, textWidth, 6, 'F', '#e3f2fd');
      
      // Add highlighted GSTIN text
      this.addText(gstinText, companyStartX, companyY, { 
        fontSize: 9, 
        fontStyle: 'bold', 
        color: this.themeColor 
      });
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

    this.currentY = headerHeight + 10;
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

    // Updated column widths - removed qty and discount columns
    const columnWidths = [10, 60, 30]; // #, Item/Service, Rate, Amount
    const columnPositions = [tableStartX];
    
    for (let i = 0; i < columnWidths.length - 1; i++) {
      columnPositions.push(columnPositions[i] + columnWidths[i]);
    }

    // Updated table headers - removed qty and discount columns
    const headers = ['#', 'Item/Service', 'Rate (Rs.)', 'Amount (Rs.)'];
    
    // Header background
    this.addRect(tableStartX, tableStartY, tableWidth, headerHeight, 'F', '#f8f9fa');
    
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

    // Table rows - clean design with updated columns
    invoice.lineItems.forEach((item, index) => {
      this.checkPageBreak(rowHeight + 5);
      
      const rowY = this.currentY;

      // Updated row data - removed qty and discount
      const rowData = [
        (index + 1).toString(),
        item.productName,
        item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
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
        
        // Truncate long text for item name
        let displayText = data;
        if (colIndex === 1 && data.length > 35) {
          displayText = data.substring(0, 33) + '...';
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

    // Tax lines with percentages
    const taxRate = invoice.lineItems[0]?.taxRate || 18;
    
    if (!invoice.isInterState) {
      // CGST with percentage
      this.addText(`CGST (${taxRate / 2}%):`, totalsX, totalsY, { 
        fontSize: 9, 
        color: '#6c757d' 
      });
      this.addText(`Rs.${invoice.totalCGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, totalsX + totalsWidth - 5, totalsY, { 
        fontSize: 9, 
        align: 'right',
        color: '#212529'
      });
      totalsY += lineSpacing;

      // SGST with percentage
      this.addText(`SGST (${taxRate / 2}%):`, totalsX, totalsY, { 
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
      // IGST with percentage
      this.addText(`IGST (${taxRate}%):`, totalsX, totalsY, { 
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
    // Notes section (if present)
    if (invoice.notes) {
      this.checkPageBreak(25);
      
      this.addText('Notes:', this.margin, this.currentY, { 
        fontSize: 11, 
        fontStyle: 'bold', 
        color: '#212529' 
      });
      this.currentY += 6;
      
      const textHeight = this.addText(invoice.notes, this.margin, this.currentY, { 
        fontSize: 9, 
        color: '#6c757d',
        maxWidth: this.pageWidth - 2 * this.margin
      });
      this.currentY += Math.max(textHeight, 10) + 15;
    }

    // Payment Information with divider (removed terms and conditions)
    if (invoice.billerInfo.bankName || invoice.billerInfo.upiId) {
      this.checkPageBreak(30);
      
      // Add divider line before payment information
      this.addLine(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY, '#dee2e6', 0.5);
      this.currentY += 8;
      
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