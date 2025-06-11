"use client";

import type { Quotation } from "@/lib/types";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Download, Printer, Send, Edit, Loader2, CheckCircle, AlertCircle, Clock, FilePenLine, MoreVertical } from "lucide-react";
import { format } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface QuotationPreviewProps {
  quotation: Quotation;
  onStatusChange?: (updatedQuotation: Quotation) => void;
}

interface QuotationPreviewHandle {
  downloadPdf: () => Promise<void>;
}

const statusColors: Record<Quotation['status'], string> = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
  expired: 'bg-orange-100 text-orange-800',
};

const statusIcons: Record<Quotation['status'], React.ElementType> = {
  draft: FilePenLine,
  sent: Send,
  accepted: CheckCircle,
  declined: AlertCircle,
  expired: Clock,
};

export const QuotationPreview = forwardRef<QuotationPreviewHandle, QuotationPreviewProps>(
  ({ quotation, onStatusChange }, ref) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const quotationCardRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    useImperativeHandle(ref, () => ({
      downloadPdf: handleDownloadPdf,
    }));

    const handleDownloadPdf = async () => {
      if (!quotationCardRef.current) return;

      setIsDownloading(true);
      try {
        const elementToCapture = quotationCardRef.current;

        // Wait for all images to load
        const images = elementToCapture.querySelectorAll('img');
        await Promise.all(Array.from(images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        }));

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

        const pageContainer = document.createElement('div');
        pageContainer.style.backgroundColor = '#ffffff';
        pageContainer.style.fontFamily = 'Arial, sans-serif';
        pageContainer.style.fontSize = '14px';
        pageContainer.style.lineHeight = '1.5';
        pageContainer.style.color = '#000000';
        pageContainer.style.width = '900px';
        pageContainer.style.padding = '20px';
        pageContainer.style.margin = '0';

        const htmlContent = await generateQuotationHTML(quotation);
        pageContainer.innerHTML = htmlContent;
        document.body.appendChild(pageContainer);

        const canvas = await html2canvas(pageContainer, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
        });

        document.body.removeChild(pageContainer);

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = availableWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
        heightLeft -= availableHeight;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', margin, position + margin, imgWidth, imgHeight);
          heightLeft -= availableHeight;
        }

        pdf.save(`Quotation-${quotation.quotationNumber}.pdf`);

        toast({
          title: "PDF Downloaded",
          description: "Quotation PDF has been downloaded successfully.",
        });
      } catch (error) {
        console.error("Error generating PDF:", error);
        toast({
          title: "PDF Generation Failed",
          description: "Unable to generate PDF. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsDownloading(false);
      }
    };

    const generateQuotationHTML = async (quotation: Quotation): Promise<string> => {
      const { billerInfo, client } = quotation;

      // Pre-process rows to handle image loading
      const processedRows = await Promise.all(quotation.rows.map(async row => ({
        ...row,
        items: await Promise.all(row.items.map(async item => {
          if (item.type === 'image' && item.value) {
            try {
              // Load the image and convert it to base64
              const img = new Image();
              img.crossOrigin = "anonymous"; // Enable CORS if the image is from a different origin
              img.src = item.value as string;
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
              });

              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0);
              const base64Image = canvas.toDataURL('image/png'); // You can change the format if needed
              return { ...item, value: base64Image };
            } catch (error) {
              console.error("Error loading image:", error);
              return item; // Return the original item if there's an error
            }
          }
          return item;
        }))
      })));

      return `
        <div style="max-width: 100%; margin: 0 auto; background: white;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
            <div>
              ${billerInfo.logoUrl ? `<img src="${billerInfo.logoUrl}" alt="Logo" style="max-height: 80px; margin-bottom: 10px;" crossorigin="anonymous" />` : ''}
              <h1 style="font-size: 32px; font-weight: bold; color: #3F51B5; margin: 0;">QUOTATION</h1>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">${quotation.quotationNumber}</div>
              <div style="font-size: 14px; color: #666;">${format(quotation.quotationDate, 'MMMM dd, yyyy')}</div>
              <div style="font-size: 14px; color: #666;">Valid Until: ${format(quotation.validUntil, 'MMMM dd, yyyy')}</div>
            </div>
          </div>

          <!-- Biller and Client Info -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px;">
            <div>
              <h3 style="font-size: 16px; font-weight: bold; color: #3F51B5; margin-bottom: 10px;">FROM</h3>
              <div style="font-size: 14px; line-height: 1.6;">
                <div style="font-weight: bold; margin-bottom: 5px;">${billerInfo.businessName}</div>
                ${billerInfo.gstin ? `<div>GSTIN: ${billerInfo.gstin}</div>` : ''}
                <div>${billerInfo.addressLine1}</div>
                ${billerInfo.addressLine2 ? `<div>${billerInfo.addressLine2}</div>` : ''}
                <div>${billerInfo.city}, ${billerInfo.state} ${billerInfo.postalCode}</div>
                <div>${billerInfo.country}</div>
                ${billerInfo.phone ? `<div>Phone: ${billerInfo.phone}</div>` : ''}
                ${billerInfo.email ? `<div>Email: ${billerInfo.email}</div>` : ''}
              </div>
            </div>
            <div>
              <h3 style="font-size: 16px; font-weight: bold; color: #3F51B5; margin-bottom: 10px;">TO</h3>
              <div style="font-size: 14px; line-height: 1.6;">
                <div style="font-weight: bold; margin-bottom: 5px;">${client.name}</div>
                ${client.gstin ? `<div>GSTIN: ${client.gstin}</div>` : ''}
                <div>${client.addressLine1}</div>
                ${client.addressLine2 ? `<div>${client.addressLine2}</div>` : ''}
                <div>${client.city}, ${client.state} ${client.postalCode}</div>
                <div>${client.country}</div>
                ${client.phone ? `<div>Phone: ${client.phone}</div>` : ''}
                ${client.email ? `<div>Email: ${client.email}</div>` : ''}
              </div>
            </div>
          </div>

          <!-- Title and Description -->
          <div style="margin-bottom: 30px;">
            <h2 style="font-size: 20px; font-weight: bold; color: #3F51B5; margin-bottom: 10px;">${quotation.title}</h2>
            ${quotation.description ? `<p style="color: #666; margin-bottom: 0;">${quotation.description}</p>` : ''}
          </div>

          <!-- Items Table -->
          <div style="margin-bottom: 30px;">
            ${processedRows.map((row, rowIndex) => `
              <div style="display: grid; grid-template-columns: ${row.items.map(item => `${item.width}%`).join(' ')}; gap: 10px; padding: 10px 0; border-bottom: 1px solid #e0e0e0;">
                ${row.items.map(item => `
                  <div>
                    <div style="font-weight: bold; font-size: 12px; color: #666; margin-bottom: 5px;">${item.label}</div>
                    <div style="font-size: 14px;">
                      ${item.type === 'date' ? format(new Date(item.value as string), 'MMM dd, yyyy') : 
                        item.type === 'number' ? (typeof item.value === 'number' ? item.value.toLocaleString('en-IN') : item.value) : 
                        item.type === 'image' && item.value ? `<img src="${item.value}" alt="Image" style="max-width: 100px; max-height: 60px; object-fit: cover;" crossorigin="anonymous" />` : 
                        item.value}
                    </div>
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>

          <!-- Summary -->
          <div style="margin-left: auto; width: 300px; margin-bottom: 30px;">
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
              <span>Subtotal:</span>
              <span>Rs. ${quotation.subTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
              <span>Tax:</span>
              <span>Rs. ${quotation.totalTax.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px 0; font-weight: bold; font-size: 16px; border-top: 2px solid #3F51B5;">
              <span>Total:</span>
              <span>Rs. ${quotation.grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
            </div>
          </div>

          <!-- Notes and Terms -->
          ${quotation.notes ? `
            <div style="margin-bottom: 20px;">
              <h4 style="font-weight: bold; margin-bottom: 10px;">Notes:</h4>
              <p style="font-size: 14px; color: #666;">${quotation.notes}</p>
            </div>
          ` : ''}

          ${quotation.termsAndConditions ? `
            <div style="margin-bottom: 20px;">
              <h4 style="font-weight: bold; margin-bottom: 10px;">Terms & Conditions:</h4>
              <p style="font-size: 14px; color: #666;">${quotation.termsAndConditions}</p>
            </div>
          ` : ''}

          <!-- Payment Info -->
          ${billerInfo.bankName || billerInfo.upiId ? `
            <div style="margin-bottom: 20px;">
              <h4 style="font-weight: bold; margin-bottom: 10px;">Payment Information:</h4>
              <div style="font-size: 14px; color: #666;">
                ${billerInfo.bankName ? `<div>Bank: ${billerInfo.bankName}</div>` : ''}
                ${billerInfo.accountNumber ? `<div>Account: ${billerInfo.accountNumber}</div>` : ''}
                ${billerInfo.ifscCode ? `<div>IFSC: ${billerInfo.ifscCode}</div>` : ''}
                ${billerInfo.upiId ? `<div>UPI: ${billerInfo.upiId}</div>` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    };

    const StatusIcon = statusIcons[quotation.status];

    return (
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">Quotation Preview</h2>
            <p className="text-muted-foreground">
              Quotation #{quotation.quotationNumber} for {quotation.client.name}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={statusColors[quotation.status]}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/quotations/${quotation.id}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Quotation
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Send className="mr-2 h-4 w-4" />
                  Send to Client
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div ref={quotationCardRef} className="p-8 bg-white">
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                {quotation.billerInfo.logoUrl && (
                  <Image
                    src={quotation.billerInfo.logoUrl}
                    alt="Company Logo"
                    width={120}
                    height={60}
                    className="mb-4"
                  />
                )}
                <h1 className="text-4xl font-bold text-primary">QUOTATION</h1>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold mb-2">{quotation.quotationNumber}</div>
                <div className="text-sm text-muted-foreground">
                  {format(quotation.quotationDate, 'MMMM dd, yyyy')}
                </div>
                <div className="text-sm text-muted-foreground">
                  Valid Until: {format(quotation.validUntil, 'MMMM dd, yyyy')}
                </div>
              </div>
            </div>

            {/* Company and Client Info */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-lg font-bold text-primary mb-4">FROM</h3>
                <div className="space-y-1 text-sm">
                  <div className="font-bold">{quotation.billerInfo.businessName}</div>
                  {quotation.billerInfo.gstin && <div>GSTIN: {quotation.billerInfo.gstin}</div>}
                  <div>{quotation.billerInfo.addressLine1}</div>
                  {quotation.billerInfo.addressLine2 && <div>{quotation.billerInfo.addressLine2}</div>}
                  <div>{quotation.billerInfo.city}, {quotation.billerInfo.state} {quotation.billerInfo.postalCode}</div>
                  <div>{quotation.billerInfo.country}</div>
                  {quotation.billerInfo.phone && <div>Phone: {quotation.billerInfo.phone}</div>}
                  {quotation.billerInfo.email && <div>Email: {quotation.billerInfo.email}</div>}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-primary mb-4">TO</h3>
                <div className="space-y-1 text-sm">
                  <div className="font-bold">{quotation.client.name}</div>
                  {quotation.client.gstin && <div>GSTIN: {quotation.client.gstin}</div>}
                  <div>{quotation.client.addressLine1}</div>
                  {quotation.client.addressLine2 && <div>{quotation.client.addressLine2}</div>}
                  <div>{quotation.client.city}, {quotation.client.state} {quotation.client.postalCode}</div>
                  <div>{quotation.client.country}</div>
                  {quotation.client.phone && <div>Phone: {quotation.client.phone}</div>}
                  {quotation.client.email && <div>Email: {quotation.client.email}</div>}
                </div>
              </div>
            </div>

            {/* Title and Description */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4">{quotation.title}</h2>
              {quotation.description && (
                <p className="text-muted-foreground">{quotation.description}</p>
              )}
            </div>

            {/* Items */}
            <div className="mb-8">
              {quotation.rows.map((row, rowIndex) => (
                <div
                  key={row.id}
                  className={`grid gap-4 py-4 ${rowIndex === 0 ? 'border-b-2 border-primary font-bold text-primary' : 'border-b border-muted'}`}
                  style={{
                    gridTemplateColumns: row.items.map(item => `${item.width}%`).join(' ')
                  }}
                >
                  {row.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border-r last:border-r-0" style={{ width: `${item.width}%` }}>
                      {rowIndex === 0 && (
                        <div className="text-xs font-bold text-primary mb-2">{item.label}</div>
                      )}
                      <div className={rowIndex === 0 ? 'sr-only' : 'text-sm'}>
                        {item.type === 'date'
                          ? format(new Date(item.value as string), 'MMM dd, yyyy')
                          : item.type === 'number'
                            ? (typeof item.value === 'number' ? item.value.toLocaleString('en-IN') : item.value)
                            : item.type === 'image' && item.value ? (
                              <img
                                src={item.value as string}
                                alt="Image"
                                className="max-w-[100px] max-h-[60px] object-cover rounded"
                                crossOrigin="anonymous"
                              />
                            ) : (
                              String(item.value)
                            )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="flex justify-end mb-8">
              <div className="w-80 space-y-2">
                <div className="flex justify-between py-2 border-b">
                  <span>Subtotal:</span>
                  <span>Rs. {quotation.subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span>Tax:</span>
                  <span>Rs. {quotation.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between py-3 text-xl font-bold border-t-2 border-primary">
                  <span>Total:</span>
                  <span>Rs. {quotation.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Notes and Terms */}
            {quotation.notes && (
              <div className="mb-6">
                <h4 className="font-bold mb-2">Notes:</h4>
                <p className="text-sm text-muted-foreground">{quotation.notes}</p>
              </div>
            )}

            {quotation.termsAndConditions && (
              <div className="mb-6">
                <h4 className="font-bold mb-2">Terms & Conditions:</h4>
                <p className="text-sm text-muted-foreground">{quotation.termsAndConditions}</p>
              </div>
            )}

            {/* Payment Information */}
            {(quotation.billerInfo.bankName || quotation.billerInfo.upiId) && (
              <div className="mb-6">
                <h4 className="font-bold mb-2">Payment Information:</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  {quotation.billerInfo.bankName && <div>Bank: {quotation.billerInfo.bankName}</div>}
                  {quotation.billerInfo.accountNumber && <div>Account: {quotation.billerInfo.accountNumber}</div>}
                  {quotation.billerInfo.ifscCode && <div>IFSC: {quotation.billerInfo.ifscCode}</div>}
                  {quotation.billerInfo.upiId && <div>UPI: {quotation.billerInfo.upiId}</div>}
                </div>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/quotations/${quotation.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()} disabled={isDownloading}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isDownloading ? 'Generating PDF...' : 'Download PDF'}
            </Button>
          </div>
        </CardFooter>
      </Card>
    );
  }
);

QuotationPreview.displayName = "QuotationPreview";