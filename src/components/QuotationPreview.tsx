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
}

export interface QuotationPreviewHandle {
  downloadPdf: () => Promise<void>;
}

export const QuotationPreview = forwardRef<QuotationPreviewHandle, QuotationPreviewProps>(
  ({ quotation, showHeader = true }, ref) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const printableRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    downloadPdf
  }));

  const downloadPdf = async () => {
    try {
      if (!printableRef.current) return;

      // Wait for all images to load
      const images = printableRef.current.querySelectorAll('img');
      await Promise.all(Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }));

      // Create PDF with proper A4 dimensions
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const availableWidth = pdfWidth - (margin * 2);
      const availableHeight = pdfHeight - (margin * 2);

      // Clone the element for PDF generation
      const printElement = printableRef.current.cloneNode(true) as HTMLElement;
      
      // Apply modern print styles
      printElement.style.backgroundColor = '#ffffff';
      printElement.style.fontFamily = '"Segoe UI", system-ui, -apple-system, sans-serif';
      printElement.style.fontSize = '12px';
      printElement.style.lineHeight = '1.5';
      printElement.style.color = '#1f2937';
      printElement.style.width = '210mm';
      printElement.style.padding = '15mm';
      printElement.style.margin = '0';
      printElement.style.boxSizing = 'border-box';
      printElement.style.pageBreakInside = 'avoid';

      // Style all images for better PDF rendering
      const printImages = printElement.querySelectorAll('img');
      printImages.forEach((img) => {
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.crossOrigin = 'anonymous';
      });

      // Add to DOM temporarily
      printElement.style.position = 'absolute';
      printElement.style.left = '-9999px';
      printElement.style.top = '0';
      document.body.appendChild(printElement);

      try {
        // Calculate content height and determine if we need multiple pages
        const contentHeight = printElement.scrollHeight;
        const pixelsPerMM = 3.779527559; // 96 DPI to mm conversion
        const contentHeightMM = contentHeight / pixelsPerMM;
        const maxContentPerPage = availableHeight;
        const totalPages = Math.ceil(contentHeightMM / maxContentPerPage);

        if (totalPages === 1) {
          // Single page - capture everything
          const canvas = await html2canvas(printElement, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: printElement.scrollWidth,
            height: printElement.scrollHeight,
            onclone: (clonedDoc) => {
              const clonedImages = clonedDoc.querySelectorAll('img');
              clonedImages.forEach((img) => {
                img.crossOrigin = 'anonymous';
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
              });
            }
          });

          const imgData = canvas.toDataURL('image/png', 1.0);
          const imgWidthMM = (canvas.width * 25.4) / (96 * 2); // Convert to mm
          const imgHeightMM = (canvas.height * 25.4) / (96 * 2);
          
          // Scale to fit within margins
          const scaleX = availableWidth / imgWidthMM;
          const scaleY = availableHeight / imgHeightMM;
          const scale = Math.min(scaleX, scaleY, 1);
          
          const finalWidth = imgWidthMM * scale;
          const finalHeight = imgHeightMM * scale;
          
          const x = (pdfWidth - finalWidth) / 2;
          const y = margin;

          pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight, undefined, 'FAST');
        } else {
          // Multi-page handling
          for (let page = 0; page < totalPages; page++) {
            if (page > 0) {
              pdf.addPage();
            }

            // Calculate the portion of content for this page
            const startY = page * maxContentPerPage * pixelsPerMM;
            const endY = Math.min((page + 1) * maxContentPerPage * pixelsPerMM, contentHeight);
            const pageHeight = endY - startY;

            // Create a wrapper for this page's content
            const pageWrapper = document.createElement('div');
            pageWrapper.style.width = printElement.style.width;
            pageWrapper.style.height = `${pageHeight}px`;
            pageWrapper.style.overflow = 'hidden';
            pageWrapper.style.position = 'relative';
            pageWrapper.style.backgroundColor = '#ffffff';
            pageWrapper.style.fontFamily = printElement.style.fontFamily;
            pageWrapper.style.fontSize = printElement.style.fontSize;
            pageWrapper.style.lineHeight = printElement.style.lineHeight;
            pageWrapper.style.color = printElement.style.color;

            // Clone and position content for this page
            const pageContent = printElement.cloneNode(true) as HTMLElement;
            pageContent.style.position = 'absolute';
            pageContent.style.top = `-${startY}px`;
            pageContent.style.left = '0';
            pageContent.style.width = '100%';
            
            pageWrapper.appendChild(pageContent);
            document.body.appendChild(pageWrapper);

            try {
              const canvas = await html2canvas(pageWrapper, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                width: pageWrapper.scrollWidth,
                height: pageWrapper.scrollHeight,
                onclone: (clonedDoc) => {
                  const clonedImages = clonedDoc.querySelectorAll('img');
                  clonedImages.forEach((img) => {
                    img.crossOrigin = 'anonymous';
                    img.style.maxWidth = '100%';
                    img.style.height = 'auto';
                  });
                }
              });

              const imgData = canvas.toDataURL('image/png', 1.0);
              const imgWidthMM = (canvas.width * 25.4) / (96 * 2);
              const imgHeightMM = (canvas.height * 25.4) / (96 * 2);
              
              const scaleX = availableWidth / imgWidthMM;
              const scaleY = availableHeight / imgHeightMM;
              const scale = Math.min(scaleX, scaleY, 1);
              
              const finalWidth = imgWidthMM * scale;
              const finalHeight = imgHeightMM * scale;
              
              const x = (pdfWidth - finalWidth) / 2;
              const y = margin;

              pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight, undefined, 'FAST');
            } finally {
              document.body.removeChild(pageWrapper);
            }
          }
        }

        pdf.save(`quotation-${quotation.quotationNumber}.pdf`);
      } finally {
        // Clean up
        document.body.removeChild(printElement);
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
            <div className="relative w-16 h-16 border border-gray-200 rounded overflow-hidden bg-gray-50">
              <Image
                src={item.value}
                alt={item.label}
                fill
                className="object-cover"
                sizes="64px"
                unoptimized
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

      {/* Printable content */}
      <div ref={printableRef} className="bg-white">
        <div className="p-8 space-y-8">
          {/* Header */}
          <div className="text-center pb-6 mb-6 border-b-2 border-gradient-to-r from-blue-600 to-purple-600">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              <h1 className="text-5xl font-bold mb-3">QUOTATION</h1>
            </div>
            <div className="text-xl font-semibold text-gray-700 mb-2">#{quotation.quotationNumber}</div>
            <div className={`inline-block px-4 py-2 rounded-full text-sm font-medium shadow-md ${getStatusColor(quotation.status)}`}>
              {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
            </div>
          </div>

          {/* Company and Client Info */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* From */}
            <div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200 shadow-sm">
                <h3 className="text-xl font-bold text-blue-700 mb-4 flex items-center">
                  <div className="w-3 h-3 bg-blue-600 rounded-full mr-2"></div>
                  FROM
                </h3>
                <div className="space-y-2">
                  <div className="font-bold text-xl text-gray-800">{quotation.billerInfo.businessName}</div>
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
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200 shadow-sm">
                <h3 className="text-xl font-bold text-green-700 mb-4 flex items-center">
                  <div className="w-3 h-3 bg-green-600 rounded-full mr-2"></div>
                  TO
                </h3>
                <div className="space-y-2">
                  <div className="font-bold text-xl text-gray-800">{quotation.client.name}</div>
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
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Quotation Date</div>
                <div className="text-lg font-bold text-gray-800 mt-1">{formatDate(quotation.quotationDate)}</div>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Valid Until</div>
                <div className="text-lg font-bold text-gray-800 mt-1">{formatDate(quotation.validUntil)}</div>
              </div>
              <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Currency</div>
                <div className="text-lg font-bold text-gray-800 mt-1">{quotation.currency}</div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-2xl font-bold mb-3 text-gray-800">{quotation.title}</h3>
              {quotation.description && (
                <p className="text-gray-700 leading-relaxed">{quotation.description}</p>
              )}
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-t-xl mb-6">
              <h3 className="text-2xl font-bold text-center">ITEMS</h3>
            </div>
            <div className="space-y-6">
              {quotation.rows.map((row: QuotationRow, rowIndex: number) => (
                <div key={row.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  {/* Headers */}
                  <div className="bg-gradient-to-r from-gray-100 to-gray-200 p-4 border-b border-gray-300">
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
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-8 rounded-xl border border-blue-200 shadow-lg">
            <h3 className="text-2xl font-bold mb-6 text-center text-blue-800">SUMMARY</h3>
            <div className="space-y-4 max-w-md ml-auto">
              <div className="flex justify-between items-center text-lg bg-white p-3 rounded-lg shadow-sm">
                <span className="font-medium text-gray-700">Subtotal:</span>
                <span className="font-bold text-gray-800">{quotation.currency} {quotation.subTotal?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between items-center text-lg bg-white p-3 rounded-lg shadow-sm">
                <span className="font-medium text-gray-700">Tax (18%):</span>
                <span className="font-bold text-gray-800">{quotation.currency} {quotation.totalTax?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="border-t-2 border-blue-600 pt-4">
                <div className="flex justify-between items-center text-2xl font-bold text-blue-700 bg-white p-4 rounded-lg shadow-md">
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
                  <h3 className="text-lg font-bold mb-3 text-yellow-600">NOTES</h3>
                  <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-400">
                    <p className="text-sm whitespace-pre-wrap">{quotation.notes}</p>
                  </div>
                </div>
              )}
              {quotation.termsAndConditions && (
                <div>
                  <h3 className="text-lg font-bold mb-3 text-red-600">TERMS & CONDITIONS</h3>
                  <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-400">
                    <p className="text-sm whitespace-pre-wrap">{quotation.termsAndConditions}</p>
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