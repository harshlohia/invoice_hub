
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

  const downloadPdf = async () => {
    try {
      // Create PDF with proper A4 dimensions
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10; // 10mm margin
      const availableWidth = pdfWidth - (margin * 2);
      const availableHeight = pdfHeight - (margin * 2);

      // Calculate how many quotation rows can fit per page
      const headerHeight = 80; // Approximate height for header section in mm
      const footerHeight = 60; // Approximate height for totals and footer in mm
      const rowHeight = 12; // Height per quotation row in mm
      const maxRowsPerPage = Math.floor((availableHeight - headerHeight - footerHeight) / rowHeight);
      
      const totalRows = quotation.rows.length;
      const totalPages = Math.ceil(totalRows / maxRowsPerPage);

      // Generate each page
      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        if (pageIndex > 0) {
          pdf.addPage();
        }

        // Calculate rows for this page
        const startIndex = pageIndex * maxRowsPerPage;
        const endIndex = Math.min(startIndex + maxRowsPerPage, totalRows);
        const pageRows = quotation.rows.slice(startIndex, endIndex);
        
        // Create a temporary container for this page's content
        const pageContainer = document.createElement('div');
        pageContainer.style.backgroundColor = '#ffffff';
        pageContainer.style.fontFamily = 'Arial, sans-serif';
        pageContainer.style.fontSize = '14px';
        pageContainer.style.lineHeight = '1.5';
        pageContainer.style.color = '#000000';
        pageContainer.style.width = '900px';
        pageContainer.style.padding = '0';
        pageContainer.style.margin = '0';

        // Add content to page container
        pageContainer.innerHTML = `
          ${pageIndex === 0 ? generateHeaderHTML(quotation) : generateContinuationHeaderHTML(quotation, pageIndex + 1)}
          ${generateRowsTableHTML(pageRows, startIndex, quotation.currency)}
          ${pageIndex === totalPages - 1 ? generateFooterHTML(quotation) : generateContinuationFooterHTML(pageIndex + 1, totalPages)}
        `;

        // Temporarily add to DOM for rendering
        document.body.appendChild(pageContainer);

        try {
          // Create canvas for this page
          const canvas = await html2canvas(pageContainer, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: 900,
            height: Math.min(pageContainer.scrollHeight, 1200) // Limit height per page
          });

          // Convert to image and add to PDF
          const imgData = canvas.toDataURL('image/png', 1.0);
          
          const canvasWidth = canvas.width;
          const canvasHeight = canvas.height;
          
          // Convert pixels to mm
          const pxToMm = 25.4 / 96;
          const imgWidthMm = canvasWidth * pxToMm / 2;
          const imgHeightMm = canvasHeight * pxToMm / 2;
          
          // Scale to fit
          const scaleX = availableWidth / imgWidthMm;
          const scaleY = availableHeight / imgHeightMm;
          const scale = Math.min(scaleX, scaleY, 1);
          
          const finalWidth = imgWidthMm * scale;
          const finalHeight = imgHeightMm * scale;
          
          const x = (pdfWidth - finalWidth) / 2;
          const y = margin;

          pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight, undefined, 'FAST');
          
        } finally {
          // Clean up temporary element
          document.body.removeChild(pageContainer);
        }
      }
      
      // Save the PDF
      pdf.save(`quotation-${quotation.quotationNumber || 'document'}.pdf`);

    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  useImperativeHandle(ref, () => ({
    downloadPdf,
  }));

  // Helper functions for PDF generation
  const generateHeaderHTML = (quotation: Quotation): string => {
    return `
      <div style="background-color: #f8f9fa; padding: 24px; border-bottom: 2px solid #e5e7eb; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 24px;">
          <div>
            <h1 style="font-size: 32px; font-weight: bold; color: #1f2937; margin: 0 0 8px 0;">Quotation</h1>
            <p style="font-size: 16px; color: #6b7280; margin: 0;">#${quotation.quotationNumber}</p>
          </div>
          <div style="background-color: #3b82f6; color: white; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;">
            ${quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px;">
          <div>
            <h3 style="font-size: 18px; font-weight: 600; margin: 0 0 16px 0; color: #374151;">From</h3>
            <div style="font-weight: 600; font-size: 16px; margin-bottom: 8px;">${quotation.billerInfo.businessName}</div>
            ${quotation.billerInfo.gstin ? `<p style="font-size: 14px; color: #6b7280; margin: 0 0 8px 0;">GSTIN: ${quotation.billerInfo.gstin}</p>` : ''}
            <div style="font-size: 14px; line-height: 1.5;">
              <p style="margin: 0;">${quotation.billerInfo.addressLine1}</p>
              ${quotation.billerInfo.addressLine2 ? `<p style="margin: 0;">${quotation.billerInfo.addressLine2}</p>` : ''}
              <p style="margin: 0;">${quotation.billerInfo.city}, ${quotation.billerInfo.state} ${quotation.billerInfo.postalCode}</p>
              <p style="margin: 0;">${quotation.billerInfo.country}</p>
              ${quotation.billerInfo.phone ? `<p style="margin: 4px 0 0 0;">Phone: ${quotation.billerInfo.phone}</p>` : ''}
              ${quotation.billerInfo.email ? `<p style="margin: 4px 0 0 0;">Email: ${quotation.billerInfo.email}</p>` : ''}
            </div>
          </div>
          
          <div>
            <h3 style="font-size: 18px; font-weight: 600; margin: 0 0 16px 0; color: #374151;">To</h3>
            <div style="font-weight: 600; font-size: 16px; margin-bottom: 8px;">${quotation.client.name}</div>
            ${quotation.client.gstin ? `<p style="font-size: 14px; color: #6b7280; margin: 0 0 8px 0;">GSTIN: ${quotation.client.gstin}</p>` : ''}
            <div style="font-size: 14px; line-height: 1.5;">
              <p style="margin: 0;">${quotation.client.addressLine1}</p>
              ${quotation.client.addressLine2 ? `<p style="margin: 0;">${quotation.client.addressLine2}</p>` : ''}
              <p style="margin: 0;">${quotation.client.city}, ${quotation.client.state} ${quotation.client.postalCode}</p>
              <p style="margin: 0;">${quotation.client.country}</p>
              <p style="margin: 4px 0 0 0;">Phone: ${quotation.client.phone}</p>
              <p style="margin: 4px 0 0 0;">Email: ${quotation.client.email}</p>
            </div>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
          <div>
            <p style="font-size: 14px; font-weight: 500; margin: 0 0 4px 0;">Quotation Date</p>
            <p style="font-size: 14px; color: #6b7280; margin: 0;">${formatDate(quotation.quotationDate)}</p>
          </div>
          <div>
            <p style="font-size: 14px; font-weight: 500; margin: 0 0 4px 0;">Valid Until</p>
            <p style="font-size: 14px; color: #6b7280; margin: 0;">${formatDate(quotation.validUntil)}</p>
          </div>
          <div>
            <p style="font-size: 14px; font-weight: 500; margin: 0 0 4px 0;">Currency</p>
            <p style="font-size: 14px; color: #6b7280; margin: 0;">${quotation.currency}</p>
          </div>
        </div>
        
        <div style="margin-top: 24px;">
          <h3 style="font-size: 18px; font-weight: 600; margin: 0 0 8px 0;">${quotation.title}</h3>
          ${quotation.description ? `<p style="font-size: 14px; color: #6b7280; margin: 0;">${quotation.description}</p>` : ''}
        </div>
      </div>
    `;
  };

  const generateContinuationHeaderHTML = (quotation: Quotation, pageNumber: number): string => {
    return `
      <div style="background-color: #f8f9fa; padding: 16px 24px; border-bottom: 1px solid #e5e7eb; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h2 style="font-size: 18px; font-weight: bold; color: #3f51b5; margin: 0;">${quotation.billerInfo.businessName}</h2>
            <p style="font-size: 14px; color: #6b7280; margin: 0;">Quotation #${quotation.quotationNumber}</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 14px; color: #6b7280; margin: 0;">Page ${pageNumber}</p>
            <p style="font-size: 12px; color: #9ca3af; margin: 0;">Continued...</p>
          </div>
        </div>
      </div>
    `;
  };

  const generateRowsTableHTML = (rows: QuotationRow[], startIndex: number, currency: string): string => {
    if (!rows.length) return '';
    
    // Get headers from first row
    const headers = rows[0].items.map(item => ({
      label: item.label,
      width: Math.max(1, Math.floor(item.width / 8.33))
    }));
    
    return `
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">Items</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
          <thead>
            <tr style="background-color: #f9fafb;">
              ${headers.map(header => `
                <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 14px; border-bottom: 1px solid #e5e7eb; width: ${header.width * 8.33}%;">
                  ${header.label}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr style="border-bottom: 1px solid #f3f4f6;">
                ${row.items.map((item, index) => `
                  <td style="padding: 12px; font-size: 14px; vertical-align: top; width: ${Math.max(1, Math.floor(item.width / 8.33)) * 8.33}%;">
                    ${renderItemValueForPDF(item)}
                  </td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  const renderItemValueForPDF = (item: QuotationItem): string => {
    switch (item.type) {
      case 'image':
        if (item.value && typeof item.value === 'string') {
          return `<img src="${item.value}" alt="${item.label}" style="width: 64px; height: 64px; object-fit: cover; border: 1px solid #e5e7eb; border-radius: 4px;" />`;
        }
        return '<div style="width: 64px; height: 64px; border: 1px solid #e5e7eb; border-radius: 4px; display: flex; align-items: center; justify-content: center; background-color: #f9fafb; color: #9ca3af; font-size: 12px;">No image</div>';
      case 'date':
        return item.value ? formatDate(item.value as Date) : '';
      case 'number':
        return typeof item.value === 'number' ? item.value.toFixed(2) : (item.value?.toString() || '');
      default:
        return item.value?.toString() || '';
    }
  };

  const generateFooterHTML = (quotation: Quotation): string => {
    return `
      <div style="margin-top: 32px;">
        <div style="background-color: #f8f9fa; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
          <h3 style="font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">Summary</h3>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #6b7280;">Subtotal:</span>
            <span>${quotation.currency} ${quotation.subTotal?.toFixed(2) || '0.00'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
            <span style="color: #6b7280;">Tax (18%):</span>
            <span>${quotation.currency} ${quotation.totalTax?.toFixed(2) || '0.00'}</span>
          </div>
          <div style="border-top: 1px solid #e5e7eb; padding-top: 16px;">
            <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: bold;">
              <span>Grand Total:</span>
              <span>${quotation.currency} ${quotation.grandTotal?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </div>
        
        ${(quotation.notes || quotation.termsAndConditions) ? `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
            ${quotation.notes ? `
              <div>
                <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">Notes</h3>
                <p style="font-size: 14px; white-space: pre-wrap; line-height: 1.5; margin: 0;">${quotation.notes}</p>
              </div>
            ` : ''}
            ${quotation.termsAndConditions ? `
              <div>
                <h3 style="font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">Terms & Conditions</h3>
                <p style="font-size: 14px; white-space: pre-wrap; line-height: 1.5; margin: 0;">${quotation.termsAndConditions}</p>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  };

  const generateContinuationFooterHTML = (pageNumber: number, totalPages: number): string => {
    return `
      <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; margin-top: 24px; text-align: center;">
        <p style="font-size: 12px; color: #6b7280; margin: 0;">Page ${pageNumber} of ${totalPages} - Continued on next page...</p>
      </div>
    `;
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
