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
    if (!contentRef.current) {
      alert('Content not ready for PDF generation');
      return;
    }

    try {
      // Hide the download button temporarily
      const downloadButton = document.querySelector('[data-download-button]') as HTMLElement;
      if (downloadButton) {
        downloadButton.style.display = 'none';
      }

      // Use html2canvas to capture the content
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          // Handle images in the cloned document
          const images = clonedDoc.querySelectorAll('img');
          images.forEach((img) => {
            if (img.src.includes('firebasestorage.googleapis.com')) {
              // For Firebase images, we'll let html2canvas handle them as best as possible
              img.crossOrigin = 'anonymous';
            }
          });
        }
      });

      // Calculate PDF dimensions
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      // Check if content fits on one page
      const scaledHeight = imgHeight * ratio;

      if (scaledHeight <= pdfHeight - 20) {
        // Content fits on one page
        pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, scaledHeight);
      } else {
        // Content needs multiple pages
        const pageHeight = pdfHeight - 20;
        let position = 0;
        let pageNumber = 1;

        while (position < scaledHeight) {
          if (pageNumber > 1) {
            pdf.addPage();
          }

          const remainingHeight = scaledHeight - position;
          const currentPageHeight = Math.min(pageHeight, remainingHeight);

          // Create a cropped version of the image for this page
          const cropCanvas = document.createElement('canvas');
          const cropCtx = cropCanvas.getContext('2d');

          if (cropCtx) {
            const sourceY = position / ratio;
            const sourceHeight = currentPageHeight / ratio;

            cropCanvas.width = imgWidth;
            cropCanvas.height = sourceHeight;

            cropCtx.drawImage(canvas, 0, sourceY, imgWidth, sourceHeight, 0, 0, imgWidth, sourceHeight);

            const croppedImgData = cropCanvas.toDataURL('image/png');
            pdf.addImage(croppedImgData, 'PNG', imgX, imgY, imgWidth * ratio, currentPageHeight);
          }

          position += pageHeight;
          pageNumber++;
        }
      }

      // Show the download button again
      if (downloadButton) {
        downloadButton.style.display = '';
      }

      // Save the PDF
      pdf.save(`quotation-${quotation.quotationNumber}.pdf`);

    } catch (error) {
      console.error('Error generating PDF:', error);

      // Show the download button again in case of error
      const downloadButton = document.querySelector('[data-download-button]') as HTMLElement;
      if (downloadButton) {
        downloadButton.style.display = '';
      }

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
                <div className="grid grid-cols-12 gap-4 bg-gray-100 p-4 text-sm font-medium">
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
                <div className="grid grid-cols-12 gap-4 p-4 text-sm">
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