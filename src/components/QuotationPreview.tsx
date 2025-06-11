
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
import html2canvas from "html2canvas";

interface QuotationPreviewProps {
  quotation: Quotation;
  showHeader?: boolean;
  showDownloadButton?: boolean;
}

export interface QuotationPreviewHandle {
  downloadPdf: () => Promise<void>;
}

export const QuotationPreview = forwardRef<QuotationPreviewHandle, QuotationPreviewProps>(
  ({ quotation, showHeader = true, showDownloadButton = true }, ref) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const printableRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    downloadPdf
  }));

  const downloadPdf = async () => {
    try {
      if (!printableRef.current) return;

      // Wait for all images to load with timeout
      const images = printableRef.current.querySelectorAll('img');
      await Promise.all(Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(null), 3000); // 3 second timeout
          img.onload = () => {
            clearTimeout(timeout);
            resolve(null);
          };
          img.onerror = () => {
            clearTimeout(timeout);
            resolve(null);
          };
        });
      }));

      // Create PDF with A4 dimensions
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

      // Clone and style the element for PDF
      const elementToCapture = printableRef.current.cloneNode(true) as HTMLElement;
      
      // Apply PDF-specific styles
      elementToCapture.style.width = '794px'; // A4 width in pixels at 96 DPI
      elementToCapture.style.fontFamily = 'Arial, sans-serif';
      elementToCapture.style.fontSize = '14px';
      elementToCapture.style.lineHeight = '1.4';
      elementToCapture.style.color = '#000000';
      elementToCapture.style.backgroundColor = '#ffffff';
      elementToCapture.style.padding = '20px';
      elementToCapture.style.margin = '0';
      elementToCapture.style.boxSizing = 'border-box';

      // Fix images for PDF rendering
      const pdfImages = elementToCapture.querySelectorAll('img');
      pdfImages.forEach((img) => {
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.objectFit = 'contain';
        img.crossOrigin = 'anonymous';
        
        // Convert to base64 if possible to avoid CORS issues
        if (img.complete && img.naturalWidth > 0) {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx?.drawImage(img, 0, 0);
            img.src = canvas.toDataURL('image/png');
          } catch (e) {
            console.warn('Could not convert image to base64:', e);
          }
        }
      });

      // Temporarily add to DOM for rendering
      elementToCapture.style.position = 'absolute';
      elementToCapture.style.left = '-9999px';
      elementToCapture.style.top = '0';
      elementToCapture.style.zIndex = '-1';
      document.body.appendChild(elementToCapture);

      try {
        // Calculate if content fits on one page
        const contentHeight = elementToCapture.scrollHeight;
        const maxHeight = Math.floor(availableHeight * 3.78); // Convert mm to pixels

        if (contentHeight <= maxHeight) {
          // Single page
          const canvas = await html2canvas(elementToCapture, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: elementToCapture.scrollWidth,
            height: elementToCapture.scrollHeight,
            imageTimeout: 0,
            onclone: (clonedDoc) => {
              const clonedImages = clonedDoc.querySelectorAll('img');
              clonedImages.forEach((img) => {
                img.crossOrigin = 'anonymous';
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
              });
            }
          });

          const imgData = canvas.toDataURL('image/png', 0.95);
          const imgWidth = (canvas.width * 25.4) / (96 * 2); // Convert to mm
          const imgHeight = (canvas.height * 25.4) / (96 * 2);
          
          // Scale to fit within margins while maintaining aspect ratio
          const scaleX = availableWidth / imgWidth;
          const scaleY = availableHeight / imgHeight;
          const scale = Math.min(scaleX, scaleY, 1);
          
          const finalWidth = imgWidth * scale;
          const finalHeight = imgHeight * scale;
          
          const x = (pdfWidth - finalWidth) / 2;
          const y = margin;

          pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight, undefined, 'FAST');
        } else {
          // Multi-page handling
          const pageHeight = maxHeight;
          const totalPages = Math.ceil(contentHeight / pageHeight);

          for (let page = 0; page < totalPages; page++) {
            if (page > 0) {
              pdf.addPage();
            }

            // Create container for this page
            const pageContainer = document.createElement('div');
            pageContainer.style.width = '794px';
            pageContainer.style.height = `${pageHeight}px`;
            pageContainer.style.overflow = 'hidden';
            pageContainer.style.position = 'relative';
            pageContainer.style.backgroundColor = '#ffffff';

            // Clone content and position for this page
            const pageContent = elementToCapture.cloneNode(true) as HTMLElement;
            pageContent.style.position = 'absolute';
            pageContent.style.top = `${-page * pageHeight}px`;
            pageContent.style.left = '0';
            pageContent.style.width = '100%';
            
            pageContainer.appendChild(pageContent);
            document.body.appendChild(pageContainer);

            try {
              const canvas = await html2canvas(pageContainer, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                width: pageContainer.scrollWidth,
                height: pageContainer.scrollHeight,
                imageTimeout: 0
              });

              const imgData = canvas.toDataURL('image/png', 0.95);
              const imgWidth = (canvas.width * 25.4) / (96 * 2);
              const imgHeight = (canvas.height * 25.4) / (96 * 2);
              
              const scaleX = availableWidth / imgWidth;
              const scaleY = availableHeight / imgHeight;
              const scale = Math.min(scaleX, scaleY, 1);
              
              const finalWidth = imgWidth * scale;
              const finalHeight = imgHeight * scale;
              
              const x = (pdfWidth - finalWidth) / 2;
              const y = margin;

              pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight, undefined, 'FAST');
            } finally {
              document.body.removeChild(pageContainer);
            }
          }
        }

        pdf.save(`quotation-${quotation.quotationNumber}.pdf`);
      } finally {
        document.body.removeChild(elementToCapture);
      }

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
            <div className="relative w-20 h-20 border border-gray-200 rounded overflow-hidden bg-gray-50">
              <Image
                src={item.value}
                alt={item.label}
                fill
                className="object-cover"
                sizes="80px"
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
          <div className="w-20 h-20 border border-gray-200 rounded flex items-center justify-center bg-gray-50 text-gray-400 text-xs">
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
            {showDownloadButton && (
              <Button 
                onClick={downloadPdf} 
                className="flex items-center gap-2"
                data-download-button
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            )}
            <Badge className={getStatusColor(quotation.status)}>
              {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
            </Badge>
          </div>
        </div>
      )}

      {/* Printable content */}
      <div ref={printableRef} className="bg-white">
        <div className="p-8 space-y-8">
          {/* Header */}
          <div className="text-center pb-6 mb-6 border-b-2 border-gray-900">
            <h1 className="text-4xl font-bold mb-3 text-gray-900">QUOTATION</h1>
            <div className="text-xl font-semibold text-gray-700 mb-2">#{quotation.quotationNumber}</div>
            <div className={`inline-block px-4 py-2 rounded-lg text-sm font-medium ${getStatusColor(quotation.status)}`}>
              {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
            </div>
          </div>

          {/* Company and Client Info */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* From */}
            <div>
              <div className="border border-gray-200 p-6 rounded-lg">
                <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  FROM
                </h3>
                <div className="space-y-2">
                  <div className="font-bold text-lg text-gray-800">{quotation.billerInfo.businessName}</div>
                  {quotation.billerInfo.gstin && (
                    <div className="text-sm text-gray-600 font-medium">GSTIN: {quotation.billerInfo.gstin}</div>
                  )}
                  <div className="text-sm text-gray-700 leading-relaxed">
                    <div>{quotation.billerInfo.addressLine1}</div>
                    {quotation.billerInfo.addressLine2 && <div>{quotation.billerInfo.addressLine2}</div>}
                    <div>{quotation.billerInfo.city}, {quotation.billerInfo.state} {quotation.billerInfo.postalCode}</div>
                    <div>{quotation.billerInfo.country}</div>
                  </div>
                  {quotation.billerInfo.phone && (
                    <div className="text-sm text-gray-700"><span className="font-medium">Phone:</span> {quotation.billerInfo.phone}</div>
                  )}
                  {quotation.billerInfo.email && (
                    <div className="text-sm text-gray-700"><span className="font-medium">Email:</span> {quotation.billerInfo.email}</div>
                  )}
                </div>
              </div>
            </div>

            {/* To */}
            <div>
              <div className="border border-gray-200 p-6 rounded-lg">
                <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                  TO
                </h3>
                <div className="space-y-2">
                  <div className="font-bold text-lg text-gray-800">{quotation.client.name}</div>
                  {quotation.client.gstin && (
                    <div className="text-sm text-gray-600 font-medium">GSTIN: {quotation.client.gstin}</div>
                  )}
                  <div className="text-sm text-gray-700 leading-relaxed">
                    <div>{quotation.client.addressLine1}</div>
                    {quotation.client.addressLine2 && <div>{quotation.client.addressLine2}</div>}
                    <div>{quotation.client.city}, {quotation.client.state} {quotation.client.postalCode}</div>
                    <div>{quotation.client.country}</div>
                  </div>
                  <div className="text-sm text-gray-700"><span className="font-medium">Phone:</span> {quotation.client.phone}</div>
                  <div className="text-sm text-gray-700"><span className="font-medium">Email:</span> {quotation.client.email}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quotation Details */}
          <div className="border border-gray-200 p-6 rounded-lg">
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Quotation Date</div>
                <div className="text-lg font-bold text-gray-800 mt-1">{formatDate(quotation.quotationDate)}</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Valid Until</div>
                <div className="text-lg font-bold text-gray-800 mt-1">{formatDate(quotation.validUntil)}</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Currency</div>
                <div className="text-lg font-bold text-gray-800 mt-1">{quotation.currency}</div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-xl font-bold mb-3 text-gray-800">{quotation.title}</h3>
              {quotation.description && (
                <p className="text-gray-700 leading-relaxed">{quotation.description}</p>
              )}
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="bg-gray-900 text-white py-3 px-6 rounded-t-lg mb-6">
              <h3 className="text-xl font-bold text-center">ITEMS</h3>
            </div>
            <div className="space-y-4">
              {quotation.rows.map((row: QuotationRow, rowIndex: number) => (
                <div key={row.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Headers */}
                  <div className="bg-gray-100 p-4 border-b border-gray-200">
                    <div className="grid gap-4" style={{ gridTemplateColumns: row.items.map(item => `${item.width || 25}%`).join(' ') }}>
                      {row.items.map((item, itemIndex) => (
                        <div key={item.id} className="font-bold text-sm text-gray-700 uppercase tracking-wide">
                          {item.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Values */}
                  <div className="p-4 bg-white">
                    <div className="grid gap-4" style={{ gridTemplateColumns: row.items.map(item => `${item.width || 25}%`).join(' ') }}>
                      {row.items.map((item, itemIndex) => (
                        <div key={`${item.id}-value`} className="flex items-center text-sm text-gray-800">
                          {renderItemValue(item)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="border border-gray-200 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-6 text-center text-gray-900">SUMMARY</h3>
            <div className="space-y-3 max-w-md ml-auto">
              <div className="flex justify-between items-center text-base border-b border-gray-200 pb-2">
                <span className="font-medium text-gray-700">Subtotal:</span>
                <span className="font-bold text-gray-800">{quotation.currency} {quotation.subTotal?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between items-center text-base border-b border-gray-200 pb-2">
                <span className="font-medium text-gray-700">Tax (18%):</span>
                <span className="font-bold text-gray-800">{quotation.currency} {quotation.totalTax?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between items-center text-xl font-bold text-gray-900 bg-gray-100 p-3 rounded">
                <span>Grand Total:</span>
                <span>{quotation.currency} {quotation.grandTotal?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>

          {/* Notes and Terms */}
          {(quotation.notes || quotation.termsAndConditions) && (
            <div className="grid md:grid-cols-2 gap-6">
              {quotation.notes && (
                <div>
                  <h3 className="text-lg font-bold mb-3 text-gray-900">NOTES</h3>
                  <div className="border border-gray-200 p-4 rounded-lg bg-gray-50">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{quotation.notes}</p>
                  </div>
                </div>
              )}
              {quotation.termsAndConditions && (
                <div>
                  <h3 className="text-lg font-bold mb-3 text-gray-900">TERMS & CONDITIONS</h3>
                  <div className="border border-gray-200 p-4 rounded-lg bg-gray-50">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{quotation.termsAndConditions}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

QuotationPreview.displayName = "QuotationPreview";
