
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Quotation, QuotationRow, QuotationItem } from "@/lib/types";
import { format } from "date-fns";
import Image from "next/image";
import { Download, Edit, FileText, Calendar, DollarSign } from "lucide-react";
import React, { forwardRef, useImperativeHandle, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import Link from "next/link";

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
      // Wait for all images to load
      const images = contentRef.current.querySelectorAll('img');
      await Promise.all(Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }));

      // Create a clone of the content for PDF generation
      const elementToCapture = contentRef.current.cloneNode(true) as HTMLElement;
      
      // Apply PDF-specific styles to the cloned element
      elementToCapture.style.backgroundColor = '#ffffff';
      elementToCapture.style.fontFamily = 'Arial, sans-serif';
      elementToCapture.style.fontSize = '14px';
      elementToCapture.style.lineHeight = '1.5';
      elementToCapture.style.color = '#000000';
      elementToCapture.style.width = '900px';
      elementToCapture.style.maxWidth = 'none';
      elementToCapture.style.padding = '24px';
      elementToCapture.style.margin = '0';
      elementToCapture.style.boxSizing = 'border-box';
      
      // Add specific styling for Terms & Conditions to prevent cutting
      const termsCards = elementToCapture.querySelectorAll('[data-terms-card]');
      termsCards.forEach(card => {
        (card as HTMLElement).style.pageBreakInside = 'avoid';
        (card as HTMLElement).style.breakInside = 'avoid';
        (card as HTMLElement).style.marginBottom = '20px';
      });
      
      // Ensure proper spacing for all cards
      const allCards = elementToCapture.querySelectorAll('[data-card]');
      allCards.forEach(card => {
        (card as HTMLElement).style.marginBottom = '16px';
        (card as HTMLElement).style.pageBreakInside = 'avoid';
        (card as HTMLElement).style.breakInside = 'avoid';
      });
      
      // Remove any buttons or interactive elements
      const buttons = elementToCapture.querySelectorAll('button');
      buttons.forEach(button => button.remove());
      
      // Temporarily add to DOM for rendering
      elementToCapture.style.position = 'absolute';
      elementToCapture.style.left = '-9999px';
      elementToCapture.style.top = '0';
      elementToCapture.style.paddingBottom = '50px'; // Add extra padding at bottom
      document.body.appendChild(elementToCapture);

      // Wait for DOM to settle
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get the actual content height including all elements
      const actualHeight = Math.max(
        elementToCapture.scrollHeight,
        elementToCapture.offsetHeight,
        elementToCapture.getBoundingClientRect().height
      );

      try {
        // Create canvas with better handling for long content
        const canvas = await html2canvas(elementToCapture, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          width: 900,
          height: actualHeight + 100, // Add extra buffer
          scrollX: 0,
          scrollY: 0,
          windowWidth: 900,
          windowHeight: actualHeight + 100
        });

        // Create PDF
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

        // Convert canvas to image
        const imgData = canvas.toDataURL('image/png', 1.0);
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        
        // Convert pixels to mm
        const pxToMm = 25.4 / 96;
        const imgWidthMm = canvasWidth * pxToMm / 2;
        const imgHeightMm = canvasHeight * pxToMm / 2;
        
        // Calculate how many pages we need with better page break handling
        const pageHeight = availableHeight;
        const totalPages = Math.ceil(imgHeightMm / pageHeight);
        
        console.log('PDF Generation Debug:', {
          canvasHeight,
          imgHeightMm,
          pageHeight,
          totalPages,
          actualContentHeight: actualHeight
        });
        
        // Add pages to PDF with improved content handling
        for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
          if (pageIndex > 0) {
            pdf.addPage();
          }
          
          // Calculate the portion of the image for this page
          const sourceY = (pageIndex * pageHeight * 2) / pxToMm; // Convert back to pixels
          let sourceHeight = Math.min((pageHeight * 2) / pxToMm, canvasHeight - sourceY);
          
          // For the last page, ensure we capture ALL remaining content
          if (pageIndex === totalPages - 1) {
            sourceHeight = Math.max(canvasHeight - sourceY, 100); // Ensure minimum content
          }
          
          // Skip if no content to render
          if (sourceHeight <= 0 || sourceY >= canvasHeight) {
            continue;
          }
          
          // Create a temporary canvas for this page
          const pageCanvas = document.createElement('canvas');
          const pageCtx = pageCanvas.getContext('2d');
          pageCanvas.width = canvasWidth;
          pageCanvas.height = Math.max(sourceHeight, 1); // Ensure minimum height
          
          if (pageCtx) {
            pageCtx.fillStyle = '#ffffff';
            pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            pageCtx.drawImage(canvas, 0, -sourceY);
            
            const pageImgData = pageCanvas.toDataURL('image/png', 1.0);
            const pageImgHeightMm = (pageCanvas.height * pxToMm) / 2;
            
            // Scale to fit width while maintaining aspect ratio
            const scale = Math.min(availableWidth / imgWidthMm, availableHeight / pageImgHeightMm);
            const finalWidth = imgWidthMm * scale;
            const finalHeight = pageImgHeightMm * scale;
            
            const x = (pdfWidth - finalWidth) / 2;
            const y = margin;
            
            pdf.addImage(pageImgData, 'PNG', x, y, finalWidth, finalHeight, undefined, 'FAST');
            
            console.log(`Page ${pageIndex + 1}:`, {
              sourceY,
              sourceHeight,
              pageImgHeightMm,
              finalHeight
            });
          }
        }
        
        // Save the PDF
        pdf.save(`quotation-${quotation.quotationNumber || 'document'}.pdf`);
        
      } finally {
        // Clean up temporary element
        document.body.removeChild(elementToCapture);
      }
      
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  useImperativeHandle(ref, () => ({
    downloadPdf,
  }));
  const formatDate = (date: Date | string): string => {
    if (typeof date === 'string') {
      return format(new Date(date), 'dd/MM/yyyy');
    }
    return format(date, 'dd/MM/yyyy');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'accepted': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'declined': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'expired': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const renderItemValue = (item: QuotationItem): React.ReactNode => {
    switch (item.type) {
      case 'image':
        if (item.value && typeof item.value === 'string') {
          return (
            <div className="relative w-16 h-16 border border-border rounded overflow-hidden bg-muted">
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
          <div className="w-16 h-16 border border-border rounded flex items-center justify-center bg-muted text-muted-foreground text-xs">
            No image
          </div>
        );
      case 'date':
        return item.value ? formatDate(item.value as Date) : '';
      case 'number':
        return typeof item.value === 'number' ? item.value.toFixed(2) : (item.value?.toString() || '');
      case 'amount':
        return typeof item.value === 'number' ? `Rs. ${item.value.toFixed(2)}` : (item.value?.toString() || '');
      case 'tax':
        return typeof item.value === 'number' ? `${item.value}%` : (item.value?.toString() || '');
      default:
        return item.value?.toString() || '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 bg-background">
      {showHeader && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-card dark:to-card rounded-lg p-6 border border-blue-200 dark:border-border">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-6 w-6 text-blue-600 dark:text-primary" />
                <h1 className="text-2xl font-bold text-foreground">Quotation Preview</h1>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-background px-3 py-1 rounded-md border border-border">
                  <span className="text-sm font-medium text-muted-foreground">Number:</span>
                  <span className="ml-1 font-bold text-primary">#{quotation.quotationNumber}</span>
                </div>
                <Badge className={getStatusColor(quotation.status)}>
                  {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Created: {format(quotation.quotationDate instanceof Date ? quotation.quotationDate : quotation.quotationDate.toDate(), 'MMM dd, yyyy')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="font-semibold">Total: {quotation.currency} {quotation.grandTotal?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" asChild className="flex items-center gap-2">
                <Link href={`/dashboard/quotations/${quotation.id}/edit`}>
                  <Edit className="h-4 w-4" />
                  Edit
                </Link>
              </Button>
              <Button onClick={downloadPdf} className="flex items-center gap-2 bg-primary hover:bg-primary/90">
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            </div>
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
              <p className="text-sm text-muted-foreground">{formatDate(quotation.quotationDate instanceof Date ? quotation.quotationDate : quotation.quotationDate.toDate())}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Valid Until</p>
              <p className="text-sm text-muted-foreground">{formatDate(quotation.validUntil instanceof Date ? quotation.validUntil : quotation.validUntil.toDate())}</p>
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
              <div key={row.id} className="border border-border rounded-lg overflow-hidden">
                <div className="grid gap-4 bg-muted p-4 text-sm font-medium" style={{ gridTemplateColumns: row.items.map(item => `${item.width || 100}fr`).join(' ') }}>
                  {row.items.map((item, itemIndex) => (
                    <div key={item.id} className="text-left">
                      {item.label}
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 p-4 text-sm" style={{ gridTemplateColumns: row.items.map(item => `${item.width || 100}fr`).join(' ') }}>
                  {row.items.map((item, itemIndex) => (
                    <div key={`${item.id}-value`} className="flex items-center text-left">
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
      <Card data-card="true">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal:</span>
            <span>{quotation.currency} {quotation.subTotal?.toFixed(2) || '0.00'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax:</span>
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
            <Card data-card="true">
              <CardHeader>
                <CardTitle className="text-lg">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{quotation.notes}</p>
              </CardContent>
            </Card>
          )}
          {quotation.termsAndConditions && (
            <Card data-card="true" data-terms-card="true">
              <CardHeader>
                <CardTitle className="text-lg">Terms & Conditions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm whitespace-pre-wrap leading-relaxed break-words">
                  {quotation.termsAndConditions}
                </div>
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
