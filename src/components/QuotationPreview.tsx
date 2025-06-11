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
    if (!contentRef.current) return;

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
      const margin = 10;
      const availableWidth = pdfWidth - (margin * 2);
      const availableHeight = pdfHeight - (margin * 2);

      // Better pagination logic - more conservative estimates
      const maxRowsFirstPage = 4; // More space for header
      const maxRowsPerPage = 6; // Conservative estimate for subsequent pages

      const totalRows = quotation.rows.length;
      let totalPages = 1;

      if (totalRows > maxRowsFirstPage) {
        const remainingRows = totalRows - maxRowsFirstPage;
        totalPages = 1 + Math.ceil(remainingRows / maxRowsPerPage);
      }

      // Pre-convert all images to base64 to avoid CORS issues
      const convertImageToBase64 = async (imageUrl: string): Promise<string> => {
        try {
          // Handle Firebase Storage URLs
          if (imageUrl.includes('firebasestorage.googleapis.com')) {
            // Create a proxy fetch to avoid CORS
            const response = await fetch(imageUrl, {
              mode: 'cors',
              credentials: 'omit',
              headers: {
                'Accept': 'image/*',
              }
            });

            if (!response.ok) {
              throw new Error(`Failed to fetch image: ${response.status}`);
            }

            const blob = await response.blob();
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(new Error('Failed to convert to base64'));
              reader.readAsDataURL(blob);
            });
          } else {
            // For other URLs, try direct fetch
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          }
        } catch (error) {
          console.error('Error converting image:', error);
          // Return a placeholder data URL for missing images
          return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMyAxM0gyN1YyN0gxM1YxM1oiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+';
        }
      };

      // Convert all images first
      const imageConversions = new Map<string, string>();
      for (const row of quotation.rows) {
        for (const item of row.items) {
          if (item.type === 'image' && item.value && typeof item.value === 'string') {
            if (!imageConversions.has(item.value)) {
              const base64Image = await convertImageToBase64(item.value);
              imageConversions.set(item.value, base64Image);
            }
          }
        }
      }

      // Generate each page
      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        if (pageIndex > 0) {
          pdf.addPage();
        }

        // Calculate rows for this page with better logic
        let startIndex, endIndex, pageRows;

        if (pageIndex === 0) {
          // First page
          startIndex = 0;
          endIndex = Math.min(maxRowsFirstPage, totalRows);
          pageRows = quotation.rows.slice(startIndex, endIndex);
        } else {
          // Subsequent pages
          startIndex = maxRowsFirstPage + (pageIndex - 1) * maxRowsPerPage;
          endIndex = Math.min(startIndex + maxRowsPerPage, totalRows);
          pageRows = quotation.rows.slice(startIndex, endIndex);
        }

        // Create a temporary container for this page's content
        const pageContainer = document.createElement('div');
        pageContainer.style.cssText = `
          background-color: #ffffff;
          font-family: Arial, sans-serif;
          font-size: 11px;
          line-height: 1.3;
          color: #000000;
          width: 750px;
          padding: 15px;
          margin: 0;
          box-sizing: border-box;
          min-height: 1000px;
        `;

        // Use pre-converted images
        const rowsWithConvertedImages = pageRows.map(row => ({
          ...row,
          items: row.items.map(item => ({
            ...item,
            value: item.type === 'image' && typeof item.value === 'string' 
              ? imageConversions.get(item.value) || item.value
              : item.value
          }))
        }));

        // Add content to page container
        pageContainer.innerHTML = generatePageHTML(quotation, rowsWithConvertedImages, pageIndex, totalPages, startIndex);

        // Temporarily add to DOM for rendering
        document.body.appendChild(pageContainer);

        // Wait longer for images to render
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
          // Create canvas for this page with better settings
          const canvas = await html2canvas(pageContainer, {
            scale: 1.5,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: 750,
            height: 1000,
            imageTimeout: 15000,
            onclone: (clonedDoc) => {
              // Ensure all images are properly loaded
              const images = clonedDoc.querySelectorAll('img');
              images.forEach((img: HTMLImageElement) => {
                img.style.display = 'block';
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.objectFit = 'cover';
                // Force image to load if it hasn't
                if (!img.complete) {
                  img.src = img.src;
                }
              });
            }
          });

          // Convert to image and add to PDF
          const imgData = canvas.toDataURL('image/jpeg', 0.9);

          const canvasWidth = canvas.width;
          const canvasHeight = canvas.height;

          // Convert pixels to mm (assuming 96 DPI)
          const pxToMm = 25.4 / 96;
          const imgWidthMm = (canvasWidth * pxToMm) / 1.5; // Divide by scale factor
          const imgHeightMm = (canvasHeight * pxToMm) / 1.5;

          // Scale to fit page
          const scaleX = availableWidth / imgWidthMm;
          const scaleY = availableHeight / imgHeightMm;
          const scale = Math.min(scaleX, scaleY, 1);

          const finalWidth = imgWidthMm * scale;
          const finalHeight = imgHeightMm * scale;

          const x = (pdfWidth - finalWidth) / 2;
          const y = margin;

          pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight, undefined, 'FAST');

        } finally {
          // Clean up temporary element
          document.body.removeChild(pageContainer);
        }
      }

      // Save the PDF
      pdf.save(`quotation-${quotation.quotationNumber}.pdf`);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  // Helper function to generate complete page HTML
  const generatePageHTML = (quotation: Quotation, pageRows: QuotationRow[], pageIndex: number, totalPages: number, startIndex: number): string => {
    const isFirstPage = pageIndex === 0;
    const isLastPage = pageIndex === totalPages - 1;

    return `
      <div style="min-height: 950px; position: relative;">
        ${isFirstPage ? generateHeaderHTML(quotation) : generateContinuationHeaderHTML(quotation, pageIndex + 1)}
        ${pageRows.length > 0 ? generateRowsTableHTML(pageRows, startIndex, quotation.currency) : ''}
        ${isLastPage ? generateFooterHTML(quotation) : generateContinuationFooterHTML(pageIndex + 1, totalPages)}
      </div>
    `;
  };

// Helper function to generate header HTML
  const generateHeaderHTML = (quotation: Quotation): string => {
    return `
      <div style="margin-bottom: 25mm;">
        <!-- Header Section -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5mm;">
          <div>
            <h1 style="font-size: 24px; font-weight: bold; margin: 0 0 2mm 0; color: #1f2937;">Quotation</h1>
            <p style="color: #6b7280; margin: 0; font-size: 12px;">#${quotation.quotationNumber}</p>
          </div>
          <div style="text-align: right;">
            <div style="background: #f3f4f6; color: #374151; padding: 2mm; border-radius: 2mm; font-size: 10px; font-weight: 500;">
              ${quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
            </div>
          </div>
        </div>

        <!-- Biller and Client Info -->
        <table style="width: 100%; margin-bottom: 5mm; border-collapse: collapse;">
          <tr>
            <!-- Biller Info -->
            <td style="width: 50%; padding-right: 3mm; vertical-align: top;">
              <div style="border: 1px solid #e5e7eb; border-radius: 2mm; padding: 3mm;">
                <h3 style="font-size: 12px; font-weight: 600; margin: 0 0 2mm 0; color: #1f2937;">From</h3>
                <div style="font-weight: 600; font-size: 11px; margin-bottom: 1mm;">${quotation.billerInfo.businessName}</div>
                ${quotation.billerInfo.gstin ? `<p style="font-size: 9px; color: #6b7280; margin: 0 0 1mm 0;">GSTIN: ${quotation.billerInfo.gstin}</p>` : ''}
                <div style="font-size: 9px; line-height: 1.3;">
                  <p style="margin: 0 0 0.5mm 0;">${quotation.billerInfo.addressLine1}</p>
                  ${quotation.billerInfo.addressLine2 ? `<p style="margin: 0 0 0.5mm 0;">${quotation.billerInfo.addressLine2}</p>` : ''}
                  <p style="margin: 0 0 0.5mm 0;">${quotation.billerInfo.city}, ${quotation.billerInfo.state} ${quotation.billerInfo.postalCode}</p>
                  <p style="margin: 0 0 0.5mm 0;">${quotation.billerInfo.country}</p>
                </div>
                ${quotation.billerInfo.phone ? `<p style="font-size: 9px; margin: 1mm 0 0 0;">Phone: ${quotation.billerInfo.phone}</p>` : ''}
                ${quotation.billerInfo.email ? `<p style="font-size: 9px; margin: 0.5mm 0 0 0;">Email: ${quotation.billerInfo.email}</p>` : ''}
              </div>
            </td>

            <!-- Client Info -->
            <td style="width: 50%; padding-left: 3mm; vertical-align: top;">
              <div style="border: 1px solid #e5e7eb; border-radius: 2mm; padding: 3mm;">
                <h3 style="font-size: 12px; font-weight: 600; margin: 0 0 2mm 0; color: #1f2937;">To</h3>
                <div style="font-weight: 600; font-size: 11px; margin-bottom: 1mm;">${quotation.client.name}</div>
                ${quotation.client.gstin ? `<p style="font-size: 9px; color: #6b7280; margin: 0 0 1mm 0;">GSTIN: ${quotation.client.gstin}</p>` : ''}
                <div style="font-size: 9px; line-height: 1.3;">
                  <p style="margin: 0 0 0.5mm 0;">${quotation.client.addressLine1}</p>
                  ${quotation.client.addressLine2 ? `<p style="margin: 0 0 0.5mm 0;">${quotation.client.addressLine2}</p>` : ''}
                  <p style="margin: 0 0 0.5mm 0;">${quotation.client.city}, ${quotation.client.state} ${quotation.client.postalCode}</p>
                  <p style="margin: 0 0 0.5mm 0;">${quotation.client.country}</p>
                </div>
                <p style="font-size: 9px; margin: 1mm 0 0 0;">Phone: ${quotation.client.phone}</p>
                <p style="font-size: 9px; margin: 0.5mm 0 0 0;">Email: ${quotation.client.email}</p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Quotation Details -->
        <div style="border: 1px solid #e5e7eb; border-radius: 2mm; padding: 3mm; margin-bottom: 4mm;">
          <table style="width: 100%; margin-bottom: 3mm; border-collapse: collapse;">
            <tr>
              <td style="width: 33.33%; padding-right: 2mm;">
                <p style="font-size: 10px; font-weight: 500; margin: 0 0 0.5mm 0;">Quotation Date</p>
                <p style="font-size: 9px; color: #6b7280; margin: 0;">${formatDate(quotation.quotationDate)}</p>
              </td>
              <td style="width: 33.33%; padding: 0 1mm;">
                <p style="font-size: 10px; font-weight: 500; margin: 0 0 0.5mm 0;">Valid Until</p>
                <p style="font-size: 9px; color: #6b7280; margin: 0;">${formatDate(quotation.validUntil)}</p>
              </td>
              <td style="width: 33.33%; padding-left: 2mm;">
                <p style="font-size: 10px; font-weight: 500; margin: 0 0 0.5mm 0;">Currency</p>
                <p style="font-size: 9px; color: #6b7280; margin: 0;">${quotation.currency}</p>
              </td>
            </tr>
          </table>
          <div>
            <h3 style="font-size: 12px; font-weight: 600; margin: 0 0 1mm 0;">${quotation.title}</h3>
            ${quotation.description ? `<p style="font-size: 9px; color: #6b7280; margin: 0; word-wrap: break-word;">${quotation.description}</p>` : ''}
          </div>
        </div>
      </div>
    `;
  };

  // Helper function to generate continuation header HTML
  const generateContinuationHeaderHTML = (quotation: Quotation, pageNumber: number): string => {
    return `
      <div style="padding: 24px; background: white;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px;">
          <div>
            <h1 style="font-size: 24px; font-weight: bold; margin: 0; color: #1f2937;">Quotation #${quotation.quotationNumber}</h1>
            <p style="color: #6b7280; margin: 4px 0 0 0; font-size: 14px;">Continued - Page ${pageNumber}</p>
          </div>
          <div style="text-align: right;">
            <p style="font-size: 14px; margin: 0; color: #6b7280;">Client: ${quotation.client.name}</p>
          </div>
        </div>
      </div>
    `;
  };

  // Helper function to generate rows table HTML
  const generateRowsTableHTML = (rows: QuotationRow[], startIndex: number, currency: string): string => {
    if (!rows.length) return '';

    return `
      <div style="margin-bottom: 16px;">
        <div style="border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
          <h3 style="font-size: 14px; font-weight: 600; margin: 0; padding: 10px; background: #f9fafb; border-bottom: 1px solid #e5e7eb;">Items (${startIndex + 1}-${startIndex + rows.length})</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
            <thead>
              <tr style="background: #f9fafb;">
                ${rows[0]?.items.map(item => `
                  <th style="padding: 6px; border-bottom: 1px solid #e5e7eb; text-align: left; font-weight: 500; width: ${item.width || 15}%; font-size: 10px;">
                    ${item.label}
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows.map((row, index) => `
                <tr style="${index % 2 === 0 ? 'background: #ffffff' : 'background: #f9fafb'}; page-break-inside: avoid;">
                  ${row.items.map(item => `
                    <td style="padding: 6px; border-bottom: ${index < rows.length - 1 ? '1px solid #f3f4f6' : 'none'}; vertical-align: top; width: ${item.width || 15}%; max-width: 120px; word-wrap: break-word;">
                      ${item.type === 'image' && item.value ? 
                        `<div style="width: 35px; height: 35px; border: 1px solid #e5e7eb; border-radius: 3px; overflow: hidden; background: #f9fafb; display: inline-block; margin: 0 auto;">
                          <img src="${item.value}" alt="${item.label}" style="width: 100%; height: 100%; object-fit: cover; display: block;" onload="this.style.opacity=1" style="opacity: 0; transition: opacity 0.3s;" />
                        </div>` :
                        item.type === 'date' && item.value ? 
                          formatDate(item.value as Date) :
                          item.type === 'number' && typeof item.value === 'number' ?
                            item.value.toFixed(2) :
                            `<div style="max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.value?.toString() || ''}">${(item.value?.toString() || '').substring(0, 30)}${(item.value?.toString() || '').length > 30 ? '...' : ''}</div>`
                      }
                    </td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  // Helper function to generate footer HTML
  const generateFooterHTML = (quotation: Quotation): string => {
    return `
      <div style="padding: 0 24px;">
        <!-- Summary -->
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <h3 style="font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">Summary</h3>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #6b7280;">Subtotal:</span>
            <span>${quotation.currency} ${quotation.subTotal?.toFixed(2) || '0.00'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="color: #6b7280;">Tax (18%):</span>
            <span>${quotation.currency} ${quotation.totalTax?.toFixed(2) || '0.00'}</span>
          </div>
          <div style="border-top: 1px solid #e5e7eb; padding-top: 12px;">
            <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: bold;">
              <span>Grand Total:</span>
              <span>${quotation.currency} ${quotation.grandTotal?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </div>

        <!-- Notes and Terms -->
        ${(quotation.notes || quotation.termsAndConditions) ? `
          <div style="display: grid; grid-template-columns: ${quotation.notes && quotation.termsAndConditions ? '1fr 1fr' : '1fr'}; gap: 24px;">
            ${quotation.notes ? `
              <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
                <h3 style="font-size: 18px; font-weight: 600; margin: 0 0 12px 0;">Notes</h3>
                <p style="font-size: 14px; white-space: pre-wrap; margin: 0; line-height: 1.6;">${quotation.notes}</p>
              </div>
            ` : ''}
            ${quotation.termsAndConditions ? `
              <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
                <h3 style="font-size: 18px; font-weight: 600; margin: 0 0 12px 0;">Terms & Conditions</h3>
                <p style="font-size: 14px; white-space: pre-wrap; margin: 0; line-height: 1.6;">${quotation.termsAndConditions}</p>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  };

  // Helper function to generate continuation footer HTML
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