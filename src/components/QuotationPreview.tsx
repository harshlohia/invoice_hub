
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
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 30;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`quotation-${quotation.quotationNumber}.pdf`);
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
