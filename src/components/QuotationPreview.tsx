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

      // Create a temporary element for PDF generation
      const printElement = printableRef.current.cloneNode(true) as HTMLElement;

      // Apply print styles
      printElement.style.backgroundColor = 'white';
      printElement.style.width = '210mm';
      printElement.style.minHeight = '297mm';
      printElement.style.padding = '20mm';
      printElement.style.margin = '0';
      printElement.style.boxSizing = 'border-box';
      printElement.style.fontFamily = 'Arial, sans-serif';

      // Hide the original content temporarily
      const originalDisplay = printableRef.current.style.display;
      printableRef.current.style.display = 'none';

      // Add print element to body
      document.body.appendChild(printElement);

      // Generate PDF using html2canvas
      const canvas = await html2canvas(printElement, {
        scale: 2,
        useCORS: false,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794, // A4 width in pixels at 96 DPI
        height: 1123, // A4 height in pixels at 96 DPI
        onclone: (clonedDoc) => {
          // Handle images in the cloned document
          const images = clonedDoc.querySelectorAll('img');
          images.forEach((img) => {
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.crossOrigin = 'anonymous';
          });
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`quotation-${quotation.quotationNumber}.pdf`);

      // Clean up
      document.body.removeChild(printElement);
      printableRef.current.style.display = originalDisplay;

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
          <div className="text-center border-b-2 border-blue-600 pb-6">
            <h1 className="text-4xl font-bold text-blue-600 mb-2">QUOTATION</h1>
            <div className="text-lg font-medium">#{quotation.quotationNumber}</div>
            <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-2 ${getStatusColor(quotation.status)}`}>
              {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
            </div>
          </div>

          {/* Company and Client Info */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* From */}
            <div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-lg font-bold text-blue-600 mb-3">FROM</h3>
                <div className="space-y-1">
                  <div className="font-bold text-lg">{quotation.billerInfo.businessName}</div>
                  {quotation.billerInfo.gstin && (
                    <div className="text-sm text-gray-600">GSTIN: {quotation.billerInfo.gstin}</div>
                  )}
                  <div className="text-sm">
                    <div>{quotation.billerInfo.addressLine1}</div>
                    {quotation.billerInfo.addressLine2 && <div>{quotation.billerInfo.addressLine2}</div>}
                    <div>{quotation.billerInfo.city}, {quotation.billerInfo.state} {quotation.billerInfo.postalCode}</div>
                    <div>{quotation.billerInfo.country}</div>
                  </div>
                  {quotation.billerInfo.phone && (
                    <div className="text-sm">Phone: {quotation.billerInfo.phone}</div>
                  )}
                  {quotation.billerInfo.email && (
                    <div className="text-sm">Email: {quotation.billerInfo.email}</div>
                  )}
                </div>
              </div>
            </div>

            {/* To */}
            <div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-lg font-bold text-green-600 mb-3">TO</h3>
                <div className="space-y-1">
                  <div className="font-bold text-lg">{quotation.client.name}</div>
                  {quotation.client.gstin && (
                    <div className="text-sm text-gray-600">GSTIN: {quotation.client.gstin}</div>
                  )}
                  <div className="text-sm">
                    <div>{quotation.client.addressLine1}</div>
                    {quotation.client.addressLine2 && <div>{quotation.client.addressLine2}</div>}
                    <div>{quotation.client.city}, {quotation.client.state} {quotation.client.postalCode}</div>
                    <div>{quotation.client.country}</div>
                  </div>
                  <div className="text-sm">Phone: {quotation.client.phone}</div>
                  <div className="text-sm">Email: {quotation.client.email}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quotation Details */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <div className="grid md:grid-cols-3 gap-6 mb-4">
              <div>
                <div className="text-sm font-medium text-gray-600">Quotation Date</div>
                <div className="text-lg font-semibold">{formatDate(quotation.quotationDate)}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-600">Valid Until</div>
                <div className="text-lg font-semibold">{formatDate(quotation.validUntil)}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-600">Currency</div>
                <div className="text-lg font-semibold">{quotation.currency}</div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold mb-2">{quotation.title}</h3>
              {quotation.description && (
                <p className="text-gray-700">{quotation.description}</p>
              )}
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="text-xl font-bold mb-4 text-center bg-blue-600 text-white py-2 rounded">ITEMS</h3>
            <div className="space-y-4">
              {quotation.rows.map((row: QuotationRow, rowIndex: number) => (
                <div key={row.id} className="border border-gray-300 rounded-lg overflow-hidden">
                  {/* Headers */}
                  <div className="bg-gray-100 p-3 border-b">
                    <div className="grid gap-4" style={{ gridTemplateColumns: row.items.map(item => `${item.width || 25}%`).join(' ') }}>
                      {row.items.map((item, itemIndex) => (
                        <div key={item.id} className="font-semibold text-sm">
                          {item.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Values */}
                  <div className="p-3">
                    <div className="grid gap-4" style={{ gridTemplateColumns: row.items.map(item => `${item.width || 25}%`).join(' ') }}>
                      {row.items.map((item, itemIndex) => (
                        <div key={`${item.id}-value`} className="flex items-center text-sm">
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
          <div className="bg-blue-50 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-4 text-center">SUMMARY</h3>
            <div className="space-y-3 max-w-md ml-auto">
              <div className="flex justify-between items-center text-lg">
                <span>Subtotal:</span>
                <span className="font-semibold">{quotation.currency} {quotation.subTotal?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between items-center text-lg">
                <span>Tax (18%):</span>
                <span className="font-semibold">{quotation.currency} {quotation.totalTax?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="border-t-2 border-blue-600 pt-3">
                <div className="flex justify-between items-center text-2xl font-bold text-blue-600">
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