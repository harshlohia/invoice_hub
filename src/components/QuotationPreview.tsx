
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Quotation, QuotationRow, QuotationItem } from "@/lib/types";
import { format } from "date-fns";
import Image from "next/image";
import { Download } from "lucide-react";
import React, { forwardRef, useImperativeHandle, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface QuotationPreviewProps {
  quotation: Quotation;
  showHeader?: boolean;
}

export interface QuotationPreviewHandle {
  downloadPdf: () => Promise<void>;
}

export const QuotationPreview = forwardRef<QuotationPreviewHandle, QuotationPreviewProps>(
  ({ quotation, showHeader = true }, ref) => {
  const contentRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    downloadPdf
  }));

  const downloadPdf = async () => {
    try {
      // Create PDF with proper A4 dimensions
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = pageHeight - (margin * 2);

      // Convert images to base64 using a different approach
      const imagePromises = new Map();
      const processedImages = new Map();

      // First pass: collect all image URLs
      for (const row of quotation.rows) {
        for (const item of row.items) {
          if (item.type === 'image' && item.value && typeof item.value === 'string') {
            if (!imagePromises.has(item.value)) {
              imagePromises.set(item.value, convertImageToBase64Safe(item.value));
            }
          }
        }
      }

      // Wait for all images to be processed
      for (const [url, promise] of imagePromises) {
        try {
          const base64 = await promise;
          processedImages.set(url, base64);
        } catch (error) {
          console.error('Failed to process image:', url, error);
          // Use placeholder for failed images
          processedImages.set(url, createPlaceholderImage());
        }
      }

      // Calculate pagination
      const headerHeight = 80; // mm
      const footerHeight = 50; // mm
      const rowHeight = 15; // mm per row
      const availableRowSpace = contentHeight - headerHeight - footerHeight;
      const maxRowsPerPage = Math.floor(availableRowSpace / rowHeight);
      const totalPages = Math.ceil(quotation.rows.length / maxRowsPerPage);

      // Generate each page
      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        if (pageIndex > 0) {
          pdf.addPage();
        }

        const startIndex = pageIndex * maxRowsPerPage;
        const endIndex = Math.min(startIndex + maxRowsPerPage, quotation.rows.length);
        const pageRows = quotation.rows.slice(startIndex, endIndex);

        // Generate page content
        let yPosition = margin;

        if (pageIndex === 0) {
          yPosition = addHeader(pdf, quotation, margin, contentWidth, yPosition);
        } else {
          yPosition = addContinuationHeader(pdf, quotation, pageIndex + 1, margin, contentWidth, yPosition);
        }

        yPosition = addRowsTable(pdf, pageRows, processedImages, margin, contentWidth, yPosition, startIndex);

        if (pageIndex === totalPages - 1) {
          addFooter(pdf, quotation, margin, contentWidth, pageHeight - margin - footerHeight);
        }
      }

      // Save the PDF
      pdf.save(`quotation-${quotation.quotationNumber}.pdf`);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  // Safe image conversion that handles CORS issues
  const convertImageToBase64Safe = async (imageUrl: string): Promise<string> => {
    try {
      // Create a temporary image element
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      
      return new Promise((resolve, reject) => {
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = img.width;
            canvas.height = img.height;
            
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const dataURL = canvas.toDataURL('image/jpeg', 0.8);
              resolve(dataURL);
            } else {
              reject(new Error('Canvas context not available'));
            }
          } catch (error) {
            reject(error);
          }
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };

        // For Firebase Storage URLs, try to get a direct download URL
        if (imageUrl.includes('firebasestorage.googleapis.com')) {
          // Extract the token or use the URL directly
          img.src = imageUrl;
        } else {
          img.src = imageUrl;
        }
        
        // Timeout after 10 seconds
        setTimeout(() => {
          reject(new Error('Image load timeout'));
        }, 10000);
      });
    } catch (error) {
      console.error('Error converting image:', error);
      throw error;
    }
  };

  // Create a placeholder image as base64
  const createPlaceholderImage = (): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, 100, 100);
      ctx.strokeStyle = '#d1d5db';
      ctx.strokeRect(0, 0, 100, 100);
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('No Image', 50, 50);
    }
    
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  // Helper functions for PDF generation
  const addHeader = (pdf: jsPDF, quotation: Quotation, x: number, width: number, y: number): number => {
    let currentY = y;

    // Title and quotation number
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Quotation', x, currentY);
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`#${quotation.quotationNumber}`, x, currentY + 8);
    
    // Status badge
    pdf.setFontSize(10);
    pdf.text(`Status: ${quotation.status.toUpperCase()}`, x + width - 40, currentY + 5);
    
    currentY += 20;

    // Biller and Client info side by side
    const colWidth = width / 2 - 5;
    
    // Biller info
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('From:', x, currentY);
    currentY += 6;
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(quotation.billerInfo.businessName, x, currentY);
    currentY += 4;
    if (quotation.billerInfo.gstin) {
      pdf.text(`GSTIN: ${quotation.billerInfo.gstin}`, x, currentY);
      currentY += 4;
    }
    pdf.text(quotation.billerInfo.addressLine1, x, currentY);
    currentY += 4;
    if (quotation.billerInfo.addressLine2) {
      pdf.text(quotation.billerInfo.addressLine2, x, currentY);
      currentY += 4;
    }
    pdf.text(`${quotation.billerInfo.city}, ${quotation.billerInfo.state} ${quotation.billerInfo.postalCode}`, x, currentY);
    currentY += 4;
    pdf.text(quotation.billerInfo.country, x, currentY);
    if (quotation.billerInfo.phone) {
      currentY += 4;
      pdf.text(`Phone: ${quotation.billerInfo.phone}`, x, currentY);
    }
    if (quotation.billerInfo.email) {
      currentY += 4;
      pdf.text(`Email: ${quotation.billerInfo.email}`, x, currentY);
    }

    // Client info
    let clientY = y + 26;
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('To:', x + colWidth + 10, clientY);
    clientY += 6;
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(quotation.client.name, x + colWidth + 10, clientY);
    clientY += 4;
    if (quotation.client.gstin) {
      pdf.text(`GSTIN: ${quotation.client.gstin}`, x + colWidth + 10, clientY);
      clientY += 4;
    }
    pdf.text(quotation.client.addressLine1, x + colWidth + 10, clientY);
    clientY += 4;
    if (quotation.client.addressLine2) {
      pdf.text(quotation.client.addressLine2, x + colWidth + 10, clientY);
      clientY += 4;
    }
    pdf.text(`${quotation.client.city}, ${quotation.client.state} ${quotation.client.postalCode}`, x + colWidth + 10, clientY);
    clientY += 4;
    pdf.text(quotation.client.country, x + colWidth + 10, clientY);
    clientY += 4;
    pdf.text(`Phone: ${quotation.client.phone}`, x + colWidth + 10, clientY);
    clientY += 4;
    pdf.text(`Email: ${quotation.client.email}`, x + colWidth + 10, clientY);

    currentY = Math.max(currentY, clientY) + 10;

    // Quotation details
    pdf.setFontSize(10);
    pdf.text(`Quotation Date: ${formatDate(quotation.quotationDate)}`, x, currentY);
    pdf.text(`Valid Until: ${formatDate(quotation.validUntil)}`, x + 60, currentY);
    pdf.text(`Currency: ${quotation.currency}`, x + 120, currentY);
    currentY += 8;

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(quotation.title, x, currentY);
    currentY += 6;
    
    if (quotation.description) {
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      const lines = pdf.splitTextToSize(quotation.description, width);
      pdf.text(lines, x, currentY);
      currentY += lines.length * 4;
    }

    return currentY + 10;
  };

  const addContinuationHeader = (pdf: jsPDF, quotation: Quotation, pageNumber: number, x: number, width: number, y: number): number => {
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Quotation #${quotation.quotationNumber} (Continued)`, x, y);
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Page ${pageNumber} - Client: ${quotation.client.name}`, x, y + 8);
    
    return y + 20;
  };

  const addRowsTable = (pdf: jsPDF, rows: QuotationRow[], processedImages: Map<string, string>, x: number, width: number, y: number, startIndex: number): number => {
    if (!rows.length) return y;

    let currentY = y;

    // Table header
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Items (${startIndex + 1}-${startIndex + rows.length})`, x, currentY);
    currentY += 8;

    // Column headers
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    
    const colWidths = rows[0]?.items.map(item => (item.width || 15) * width / 100) || [];
    let colX = x;
    
    rows[0]?.items.forEach((item, index) => {
      pdf.text(item.label, colX, currentY);
      colX += colWidths[index];
    });
    
    currentY += 6;

    // Table rows
    pdf.setFont('helvetica', 'normal');
    
    rows.forEach((row, rowIndex) => {
      colX = x;
      let rowHeight = 12;
      
      row.items.forEach((item, itemIndex) => {
        const colWidth = colWidths[itemIndex];
        
        if (item.type === 'image' && item.value && typeof item.value === 'string') {
          const base64Image = processedImages.get(item.value);
          if (base64Image) {
            try {
              pdf.addImage(base64Image, 'JPEG', colX, currentY - 8, 8, 8);
            } catch (error) {
              console.error('Error adding image to PDF:', error);
              pdf.text('Image Error', colX, currentY);
            }
          } else {
            pdf.text('No Image', colX, currentY);
          }
        } else if (item.type === 'date' && item.value) {
          pdf.text(formatDate(item.value as Date), colX, currentY);
        } else if (item.type === 'number' && typeof item.value === 'number') {
          pdf.text(item.value.toFixed(2), colX, currentY);
        } else {
          const text = item.value?.toString() || '';
          const lines = pdf.splitTextToSize(text, colWidth - 2);
          pdf.text(lines.slice(0, 2), colX, currentY); // Limit to 2 lines
          rowHeight = Math.max(rowHeight, lines.length * 4);
        }
        
        colX += colWidth;
      });
      
      currentY += rowHeight;
    });

    return currentY + 10;
  };

  const addFooter = (pdf: jsPDF, quotation: Quotation, x: number, width: number, y: number): void => {
    let currentY = y;

    // Summary
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Summary', x, currentY);
    currentY += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Subtotal: ${quotation.currency} ${quotation.subTotal?.toFixed(2) || '0.00'}`, x, currentY);
    currentY += 5;
    pdf.text(`Tax (18%): ${quotation.currency} ${quotation.totalTax?.toFixed(2) || '0.00'}`, x, currentY);
    currentY += 5;
    
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Grand Total: ${quotation.currency} ${quotation.grandTotal?.toFixed(2) || '0.00'}`, x, currentY);
    currentY += 10;

    // Notes and Terms
    if (quotation.notes) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Notes:', x, currentY);
      currentY += 5;
      pdf.setFont('helvetica', 'normal');
      const noteLines = pdf.splitTextToSize(quotation.notes, width / 2 - 10);
      pdf.text(noteLines, x, currentY);
    }

    if (quotation.termsAndConditions) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Terms & Conditions:', x + width / 2, currentY - (quotation.notes ? noteLines.length * 4 : 0));
      pdf.setFont('helvetica', 'normal');
      const termLines = pdf.splitTextToSize(quotation.termsAndConditions, width / 2 - 10);
      pdf.text(termLines, x + width / 2, currentY - (quotation.notes ? noteLines.length * 4 : 0) + 5);
    }
  };

  const formatDate = (date: Date | string): string => {
    if (typeof date === 'string') {
      return format(new Date(date), 'dd/MM/yyyy');
    }
    return format(date, 'dd/MM/yyyy');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'declined': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderItemValue = (item: QuotationItem) => {
    switch (item.type) {
      case 'image':
        if (item.value && typeof item.value === 'string') {
          return (
            <div className="relative w-16 h-16 border border-gray-200 rounded overflow-hidden bg-gray-50">
              <Image
                src={item.value}
                alt={item.label}
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
          );
        }
        return (
          <div className="w-16 h-16 border border-gray-200 rounded flex items-center justify-center bg-gray-50 text-gray-400 text-xs">
            No image
          </div>
        );
      case 'date':
        return item.value ? formatDate(item.value as Date) : '';
      case 'number':
        return typeof item.value === 'number' ? item.value.toFixed(2) : item.value;
      default:
        return item.value?.toString() || '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 bg-white">
      {showHeader && (
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Quotation</h1>
            <p className="text-muted-foreground">#{quotation.quotationNumber}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={downloadPdf} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
            <Badge className={getStatusColor(quotation.status)}>
              {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
            </Badge>
          </div>
        </div>
      )}

      <div ref={contentRef} className="space-y-6">

      {/* Header Information */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Biller Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">From</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="font-semibold text-lg">{quotation.billerInfo.businessName}</div>
            {quotation.billerInfo.gstin && (
              <p className="text-sm text-muted-foreground">GSTIN: {quotation.billerInfo.gstin}</p>
            )}
            <div className="text-sm">
              <p>{quotation.billerInfo.addressLine1}</p>
              {quotation.billerInfo.addressLine2 && <p>{quotation.billerInfo.addressLine2}</p>}
              <p>{quotation.billerInfo.city}, {quotation.billerInfo.state} {quotation.billerInfo.postalCode}</p>
              <p>{quotation.billerInfo.country}</p>
            </div>
            {quotation.billerInfo.phone && (
              <p className="text-sm">Phone: {quotation.billerInfo.phone}</p>
            )}
            {quotation.billerInfo.email && (
              <p className="text-sm">Email: {quotation.billerInfo.email}</p>
            )}
          </CardContent>
        </Card>

        {/* Client Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">To</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="font-semibold text-lg">{quotation.client.name}</div>
            {quotation.client.gstin && (
              <p className="text-sm text-muted-foreground">GSTIN: {quotation.client.gstin}</p>
            )}
            <div className="text-sm">
              <p>{quotation.client.addressLine1}</p>
              {quotation.client.addressLine2 && <p>{quotation.client.addressLine2}</p>}
              <p>{quotation.client.city}, {quotation.client.state} {quotation.client.postalCode}</p>
              <p>{quotation.client.country}</p>
            </div>
            <p className="text-sm">Phone: {quotation.client.phone}</p>
            <p className="text-sm">Email: {quotation.client.email}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quotation Details */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div>
              <p className="text-sm font-medium">Quotation Date</p>
              <p className="text-sm text-muted-foreground">{formatDate(quotation.quotationDate)}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Valid Until</p>
              <p className="text-sm text-muted-foreground">{formatDate(quotation.validUntil)}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Currency</p>
              <p className="text-sm text-muted-foreground">{quotation.currency}</p>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">{quotation.title}</h3>
            {quotation.description && (
              <p className="text-sm text-muted-foreground">{quotation.description}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quotation Items */}
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {quotation.rows.map((row: QuotationRow, rowIndex: number) => (
              <div key={row.id} className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-2 bg-gray-50 p-3 text-sm font-medium">
                  {row.items.map((item, itemIndex) => (
                    <div
                      key={item.id}
                      className={`col-span-${Math.max(1, Math.floor(item.width / 8.33))}`}
                      style={{ gridColumn: `span ${Math.max(1, Math.floor(item.width / 8.33))}` }}
                    >
{item.label}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-12 gap-2 p-3 text-sm">
                  {row.items.map((item, itemIndex) => (
                    <div
                      key={`${item.id}-value`}
                      className={`col-span-${Math.max(1, Math.floor(item.width / 8.33))} flex items-center`}
                      style={{ gridColumn: `span ${Math.max(1, Math.floor(item.width / 8.33))}` }}
                    >
                      {renderItemValue(item)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal:</span>
            <span>{quotation.currency} {quotation.subTotal?.toFixed(2) || '0.00'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax (18%):</span>
            <span>{quotation.currency} {quotation.totalTax?.toFixed(2) || '0.00'}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-xl font-bold">
            <span>Grand Total:</span>
            <span>{quotation.currency} {quotation.grandTotal?.toFixed(2) || '0.00'}</span>
          </div>
        </CardContent>
      </Card>

      {/* Notes and Terms */}
      {(quotation.notes || quotation.termsAndConditions) && (
        <div className="grid md:grid-cols-2 gap-6">
          {quotation.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{quotation.notes}</p>
              </CardContent>
            </Card>
          )}
          {quotation.termsAndConditions && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Terms & Conditions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{quotation.termsAndConditions}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      </div>
    </div>
  );
});

QuotationPreview.displayName = "QuotationPreview";
