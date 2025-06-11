
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

  const convertImageToBase64 = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Failed to convert image to base64:', error);
      throw error;
    }
  };

  const downloadPdf = async () => {
    try {
      // Create a new jsPDF instance
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (2 * margin);
      let yPos = margin;

      // Set fonts
      pdf.setFont('helvetica', 'bold');
      
      // Header
      pdf.setFontSize(24);
      pdf.text('QUOTATION', pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`#${quotation.quotationNumber}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;

      // Status badge
      pdf.setFontSize(10);
      pdf.text(`Status: ${quotation.status.toUpperCase()}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;

      // Company and Client Info - Two columns
      const leftColumnX = margin;
      const rightColumnX = pageWidth / 2 + 5;
      
      // FROM section
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('FROM', leftColumnX, yPos);
      yPos += 8;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      
      if (quotation.billerInfo.businessName) {
        pdf.setFont('helvetica', 'bold');
        pdf.text(quotation.billerInfo.businessName, leftColumnX, yPos);
        yPos += 5;
        pdf.setFont('helvetica', 'normal');
      }
      
      if (quotation.billerInfo.gstin) {
        pdf.text(`GSTIN: ${quotation.billerInfo.gstin}`, leftColumnX, yPos);
        yPos += 5;
      }
      
      if (quotation.billerInfo.addressLine1) {
        pdf.text(quotation.billerInfo.addressLine1, leftColumnX, yPos);
        yPos += 5;
      }
      
      if (quotation.billerInfo.addressLine2) {
        pdf.text(quotation.billerInfo.addressLine2, leftColumnX, yPos);
        yPos += 5;
      }
      
      const cityStateZip = [
        quotation.billerInfo.city,
        quotation.billerInfo.state,
        quotation.billerInfo.postalCode
      ].filter(Boolean).join(', ');
      
      if (cityStateZip) {
        pdf.text(cityStateZip, leftColumnX, yPos);
        yPos += 5;
      }
      
      if (quotation.billerInfo.country) {
        pdf.text(quotation.billerInfo.country, leftColumnX, yPos);
        yPos += 5;
      }
      
      if (quotation.billerInfo.phone) {
        pdf.text(`Phone: ${quotation.billerInfo.phone}`, leftColumnX, yPos);
        yPos += 5;
      }
      
      if (quotation.billerInfo.email) {
        pdf.text(`Email: ${quotation.billerInfo.email}`, leftColumnX, yPos);
        yPos += 5;
      }

      // Reset yPos for TO section
      let toYPos = margin + 23;

      // TO section
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('TO', rightColumnX, toYPos);
      toYPos += 8;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      
      if (quotation.client.name) {
        pdf.setFont('helvetica', 'bold');
        pdf.text(quotation.client.name, rightColumnX, toYPos);
        toYPos += 5;
        pdf.setFont('helvetica', 'normal');
      }
      
      if (quotation.client.gstin) {
        pdf.text(`GSTIN: ${quotation.client.gstin}`, rightColumnX, toYPos);
        toYPos += 5;
      }
      
      if (quotation.client.addressLine1) {
        pdf.text(quotation.client.addressLine1, rightColumnX, toYPos);
        toYPos += 5;
      }
      
      if (quotation.client.addressLine2) {
        pdf.text(quotation.client.addressLine2, rightColumnX, toYPos);
        toYPos += 5;
      }
      
      const clientCityStateZip = [
        quotation.client.city,
        quotation.client.state,
        quotation.client.postalCode
      ].filter(Boolean).join(', ');
      
      if (clientCityStateZip) {
        pdf.text(clientCityStateZip, rightColumnX, toYPos);
        toYPos += 5;
      }
      
      if (quotation.client.country) {
        pdf.text(quotation.client.country, rightColumnX, toYPos);
        toYPos += 5;
      }
      
      if (quotation.client.phone) {
        pdf.text(`Phone: ${quotation.client.phone}`, rightColumnX, toYPos);
        toYPos += 5;
      }
      
      if (quotation.client.email) {
        pdf.text(`Email: ${quotation.client.email}`, rightColumnX, toYPos);
        toYPos += 5;
      }

      yPos = Math.max(yPos, toYPos) + 10;

      // Quotation Details
      pdf.setFillColor(245, 245, 245);
      pdf.rect(margin, yPos, contentWidth, 25, 'F');
      
      yPos += 8;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      
      const detailsY = yPos;
      pdf.text('Quotation Date:', leftColumnX, detailsY);
      pdf.text('Valid Until:', rightColumnX, detailsY);
      
      yPos += 6;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(formatDate(quotation.quotationDate), leftColumnX, yPos);
      pdf.text(formatDate(quotation.validUntil), rightColumnX, yPos);
      
      yPos += 15;

      // Title and Description
      if (quotation.title) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.text(quotation.title, margin, yPos);
        yPos += 8;
      }

      if (quotation.description) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        const lines = pdf.splitTextToSize(quotation.description, contentWidth);
        pdf.text(lines, margin, yPos);
        yPos += lines.length * 5 + 5;
      }

      yPos += 10;

      // Items Table
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('ITEMS', margin, yPos);
      yPos += 10;

      // Process each row
      for (const row of quotation.rows) {
        // Check if we need a new page
        if (yPos > pageHeight - 50) {
          pdf.addPage();
          yPos = margin;
        }

        // Draw row header
        pdf.setFillColor(240, 240, 240);
        pdf.rect(margin, yPos, contentWidth, 8, 'F');
        
        yPos += 6;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        
        let xPos = margin + 5;
        const columnWidth = contentWidth / row.items.length;
        
        // Headers
        for (const item of row.items) {
          pdf.text(item.label, xPos, yPos);
          xPos += columnWidth;
        }
        
        yPos += 5;
        
        // Values
        xPos = margin + 5;
        pdf.setFont('helvetica', 'normal');
        
        let maxRowHeight = 8;
        
        for (const item of row.items) {
          if (item.type === 'image' && item.value && typeof item.value === 'string') {
            try {
              const base64Image = await convertImageToBase64(item.value);
              const imgWidth = 20;
              const imgHeight = 15;
              pdf.addImage(base64Image, 'JPEG', xPos, yPos, imgWidth, imgHeight);
              maxRowHeight = Math.max(maxRowHeight, imgHeight + 2);
            } catch (error) {
              pdf.text('Image Error', xPos, yPos + 4);
            }
          } else if (item.type === 'date' && item.value) {
            pdf.text(formatDate(item.value as Date), xPos, yPos + 4);
          } else if (item.type === 'number') {
            pdf.text(String(item.value || 0), xPos, yPos + 4);
          } else {
            const text = String(item.value || '');
            const lines = pdf.splitTextToSize(text, columnWidth - 5);
            pdf.text(lines, xPos, yPos + 4);
            maxRowHeight = Math.max(maxRowHeight, lines.length * 4 + 4);
          }
          xPos += columnWidth;
        }
        
        yPos += maxRowHeight + 5;
      }

      yPos += 10;

      // Summary
      const summaryStartX = pageWidth - margin - 80;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('SUMMARY', summaryStartX, yPos);
      yPos += 8;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      
      pdf.text('Subtotal:', summaryStartX, yPos);
      pdf.text(`${quotation.currency} ${quotation.subTotal?.toFixed(2) || '0.00'}`, summaryStartX + 40, yPos);
      yPos += 6;
      
      pdf.text('Tax (18%):', summaryStartX, yPos);
      pdf.text(`${quotation.currency} ${quotation.totalTax?.toFixed(2) || '0.00'}`, summaryStartX + 40, yPos);
      yPos += 8;
      
      pdf.setFont('helvetica', 'bold');
      pdf.text('Grand Total:', summaryStartX, yPos);
      pdf.text(`${quotation.currency} ${quotation.grandTotal?.toFixed(2) || '0.00'}`, summaryStartX + 40, yPos);
      yPos += 15;

      // Notes and Terms
      if (quotation.notes || quotation.termsAndConditions) {
        yPos += 10;
        
        if (quotation.notes) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(12);
          pdf.text('NOTES', margin, yPos);
          yPos += 8;
          
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          const noteLines = pdf.splitTextToSize(quotation.notes, contentWidth);
          pdf.text(noteLines, margin, yPos);
          yPos += noteLines.length * 5 + 10;
        }
        
        if (quotation.termsAndConditions) {
          if (yPos > pageHeight - 50) {
            pdf.addPage();
            yPos = margin;
          }
          
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(12);
          pdf.text('TERMS & CONDITIONS', margin, yPos);
          yPos += 8;
          
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          const termLines = pdf.splitTextToSize(quotation.termsAndConditions, contentWidth);
          pdf.text(termLines, margin, yPos);
        }
      }

      // Save the PDF
      pdf.save(`quotation-${quotation.quotationNumber}.pdf`);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
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

  const formatDate = (date: Date | string): string => {
    if (typeof date === 'string') {
      return format(new Date(date), 'dd/MM/yyyy');
    }
    return format(date, 'dd/MM/yyyy');
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
                crossOrigin="anonymous"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = '<div class="w-full h-full flex items-center justify-center text-xs text-gray-500">Image Error</div>';
                  }
                }}
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
            <Button 
              onClick={downloadPdf} 
              className="flex items-center gap-2"
              data-download-button
            >
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
            <Badge className={getStatusColor(quotation.status)}>
              {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
            </Badge>
          </div>
        </div>
      )}

      <div ref={contentRef} className="space-y-6 p-6">
        {/* Header Information */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Quotation</h1>
          <div className="flex justify-center items-center gap-8 text-sm">
            <span>#{quotation.quotationNumber}</span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(quotation.status)}`}>
              {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
            </span>
          </div>
        </div>

        {/* Biller and Client Info */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Biller Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-blue-600">From</h3>
            <div className="space-y-2">
              <div className="font-semibold text-lg">{quotation.billerInfo.businessName}</div>
              {quotation.billerInfo.gstin && (
                <p className="text-sm text-gray-600">GSTIN: {quotation.billerInfo.gstin}</p>
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
            </div>
          </div>

          {/* Client Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-green-600">To</h3>
            <div className="space-y-2">
              <div className="font-semibold text-lg">{quotation.client.name}</div>
              {quotation.client.gstin && (
                <p className="text-sm text-gray-600">GSTIN: {quotation.client.gstin}</p>
              )}
              <div className="text-sm">
                <p>{quotation.client.addressLine1}</p>
                {quotation.client.addressLine2 && <p>{quotation.client.addressLine2}</p>}
                <p>{quotation.client.city}, {quotation.client.state} {quotation.client.postalCode}</p>
                <p>{quotation.client.country}</p>
              </div>
              <p className="text-sm">Phone: {quotation.client.phone}</p>
              <p className="text-sm">Email: {quotation.client.email}</p>
            </div>
          </div>
        </div>

        {/* Quotation Details */}
        <div className="bg-gray-50 p-6 rounded-lg mb-8">
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div>
              <p className="text-sm font-medium text-gray-600">Quotation Date</p>
              <p className="text-lg">{formatDate(quotation.quotationDate)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Valid Until</p>
              <p className="text-lg">{formatDate(quotation.validUntil)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Currency</p>
              <p className="text-lg">{quotation.currency}</p>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-xl font-bold mb-2">{quotation.title}</h3>
            {quotation.description && (
              <p className="text-gray-700">{quotation.description}</p>
            )}
          </div>
        </div>

        {/* Quotation Items */}
        <div className="mb-8">
          <h3 className="text-xl font-bold mb-6">Items</h3>
          <div className="space-y-4">
            {quotation.rows.map((row: QuotationRow, rowIndex: number) => (
              <div key={row.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="grid gap-4 bg-gray-100 p-4 text-sm font-medium" style={{ gridTemplateColumns: row.items.map(item => `${item.width || 25}%`).join(' ') }}>
                  {row.items.map((item, itemIndex) => (
                    <div key={item.id}>
                      {item.label}
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 p-4 text-sm" style={{ gridTemplateColumns: row.items.map(item => `${item.width || 25}%`).join(' ') }}>
                  {row.items.map((item, itemIndex) => (
                    <div key={`${item.id}-value`} className="flex items-center">
                      {renderItemValue(item)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-blue-50 p-6 rounded-lg mb-8">
          <h3 className="text-xl font-bold mb-4">Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-lg">
              <span>Subtotal:</span>
              <span>{quotation.currency} {quotation.subTotal?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between text-lg">
              <span>Tax (18%):</span>
              <span>{quotation.currency} {quotation.totalTax?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="border-t border-blue-200 pt-3">
              <div className="flex justify-between text-2xl font-bold">
                <span>Grand Total:</span>
                <span>{quotation.currency} {quotation.grandTotal?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes and Terms */}
        {(quotation.notes || quotation.termsAndConditions) && (
          <div className="grid md:grid-cols-2 gap-8">
            {quotation.notes && (
              <div>
                <h3 className="text-lg font-bold mb-3">Notes</h3>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{quotation.notes}</p>
                </div>
              </div>
            )}
            {quotation.termsAndConditions && (
              <div>
                <h3 className="text-lg font-bold mb-3">Terms & Conditions</h3>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{quotation.termsAndConditions}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

QuotationPreview.displayName = "QuotationPreview";
