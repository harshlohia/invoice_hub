"use client";
import type { Invoice } from "@/lib/types";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Download, Printer, Send, Edit, Loader2, CheckCircle, AlertCircle, Clock, FilePenLine, MoreVertical, Trash2 as CancelIcon } from "lucide-react";
import { format } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from "@/hooks/use-toast";
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface InvoicePreviewProps {
  invoice: Invoice;
  onStatusChange?: (updatedInvoice: Invoice) => void; 
}

export interface InvoicePreviewHandle {
  downloadPdf: () => Promise<void>;
}

const statusIcons: Record<Invoice['status'], React.ReactElement> = {
  paid: <CheckCircle className="h-4 w-4 text-green-500" />,
  sent: <Send className="h-4 w-4 text-blue-500" />, 
  overdue: <AlertCircle className="h-4 w-4 text-red-500" />,
  draft: <FilePenLine className="h-4 w-4 text-gray-500" />,
  cancelled: <CancelIcon className="h-4 w-4 text-yellow-600" />,
};

export const InvoicePreview = forwardRef<InvoicePreviewHandle, InvoicePreviewProps>(({ invoice: initialInvoice, onStatusChange }, ref) => {
  const invoiceCardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const { toast } = useToast();
  const [invoice, setInvoice] = useState<Invoice>(initialInvoice);

  useEffect(() => {
    setInvoice(initialInvoice); 
  }, [initialInvoice]);

  const handleUpdateStatus = async (newStatus: Invoice['status']) => {
    if (!invoice.id) {
      toast({ title: "Error", description: "Invoice ID is missing.", variant: "destructive" });
      return;
    }
    setIsUpdatingStatus(true);
    try {
      const invoiceRef = doc(db, 'invoices', invoice.id);
      await updateDoc(invoiceRef, {
        status: newStatus,
        updatedAt: serverTimestamp() as Timestamp,
      });
      
      const updatedInvoice = { ...invoice, status: newStatus, updatedAt: new Timestamp(new Date().getTime() / 1000, 0) }; 
      setInvoice(updatedInvoice);
      if (onStatusChange) {
        onStatusChange(updatedInvoice);
      }

      toast({ title: "Status Updated", description: `Invoice marked as ${newStatus}.` });
    } catch (error) {
      console.error("Error updating invoice status:", error);
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoiceCardRef.current) {
      toast({
        title: "Error",
        description: "Invoice content not found for PDF generation.",
        variant: "destructive",
      });
      return;
    }
    setIsDownloading(true);

    try {
      const elementToCapture = invoiceCardRef.current;
      
      // Wait for all images to load
      const images = elementToCapture.querySelectorAll('img');
      await Promise.all(Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }));

      // Create canvas from the invoice element with enhanced options
      const canvas = await html2canvas(elementToCapture, {
        scale: 3, // Higher resolution for better quality
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: elementToCapture.scrollWidth,
        height: elementToCapture.scrollHeight,
        ignoreElements: (element) => {
          // Hide elements that shouldn't appear in PDF
          return element.classList.contains('do-not-print-in-pdf') ||
                 element.tagName === 'BUTTON' ||
                 element.getAttribute('role') === 'button';
        },
        onclone: (clonedDoc) => {
          // Ensure all styles are properly applied in the cloned document
          const clonedElement = clonedDoc.querySelector('[data-invoice-content]') as HTMLElement;
          if (clonedElement) {
            // Reset any transforms that might affect positioning
            clonedElement.style.transform = 'none';
            clonedElement.style.position = 'static';
            clonedElement.style.maxWidth = 'none';
            clonedElement.style.width = '210mm'; // A4 width
            clonedElement.style.minHeight = '297mm'; // A4 height
            clonedElement.style.padding = '20mm';
            clonedElement.style.boxSizing = 'border-box';
            clonedElement.style.fontFamily = 'Arial, sans-serif';
            clonedElement.style.fontSize = '12px';
            clonedElement.style.lineHeight = '1.4';
            clonedElement.style.color = '#000000';
            
            // Ensure proper styling for all child elements
            const allElements = clonedElement.querySelectorAll('*');
            allElements.forEach((el: Element) => {
              const htmlEl = el as HTMLElement;
              // Ensure text is black and backgrounds are preserved
              if (htmlEl.style.color === '' || htmlEl.style.color === 'inherit') {
                htmlEl.style.color = '#000000';
              }
              // Ensure borders and backgrounds are visible
              if (htmlEl.classList.contains('border')) {
                htmlEl.style.border = '1px solid #e5e7eb';
              }
              if (htmlEl.classList.contains('bg-muted')) {
                htmlEl.style.backgroundColor = '#f8f9fa';
              }
              if (htmlEl.classList.contains('text-primary')) {
                htmlEl.style.color = '#3F51B5';
                htmlEl.style.fontWeight = 'bold';
              }
              if (htmlEl.classList.contains('text-muted-foreground')) {
                htmlEl.style.color = '#6b7280';
              }
              if (htmlEl.classList.contains('font-bold')) {
                htmlEl.style.fontWeight = 'bold';
              }
              if (htmlEl.classList.contains('text-xl')) {
                htmlEl.style.fontSize = '20px';
              }
              if (htmlEl.classList.contains('text-lg')) {
                htmlEl.style.fontSize = '18px';
              }
              if (htmlEl.classList.contains('text-sm')) {
                htmlEl.style.fontSize = '14px';
              }
              if (htmlEl.classList.contains('text-xs')) {
                htmlEl.style.fontSize = '12px';
              }
            });

            // Style the table specifically
            const table = clonedElement.querySelector('table');
            if (table) {
              table.style.width = '100%';
              table.style.borderCollapse = 'collapse';
              table.style.marginTop = '20px';
              table.style.marginBottom = '20px';
              
              const headers = table.querySelectorAll('th');
              headers.forEach((th: Element) => {
                const htmlTh = th as HTMLElement;
                htmlTh.style.backgroundColor = '#f8f9fa';
                htmlTh.style.padding = '12px 8px';
                htmlTh.style.border = '1px solid #e5e7eb';
                htmlTh.style.fontWeight = 'bold';
                htmlTh.style.fontSize = '12px';
                htmlTh.style.color = '#000000';
              });
              
              const cells = table.querySelectorAll('td');
              cells.forEach((td: Element) => {
                const htmlTd = td as HTMLElement;
                htmlTd.style.padding = '10px 8px';
                htmlTd.style.border = '1px solid #e5e7eb';
                htmlTd.style.fontSize = '11px';
                htmlTd.style.color = '#000000';
              });
            }

            // Style separators
            const separators = clonedElement.querySelectorAll('[role="separator"]');
            separators.forEach((sep: Element) => {
              const htmlSep = sep as HTMLElement;
              htmlSep.style.borderTop = '1px solid #e5e7eb';
              htmlSep.style.margin = '16px 0';
            });
          }
        }
      });

      // Convert canvas to image data
      const imgData = canvas.toDataURL('image/png', 1.0);
      
      // Create PDF with proper A4 dimensions
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      // Calculate dimensions to fit the content properly
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      // Calculate scaling to fit content within PDF page
      const margin = 0; // No margin since we already have padding in the content
      const availableWidth = pdfWidth - (margin * 2);
      const availableHeight = pdfHeight - (margin * 2);
      
      // Convert pixels to mm (96 DPI to 25.4mm per inch)
      const pxToMm = 25.4 / 96;
      const imgWidthMm = canvasWidth * pxToMm / 3; // Divide by scale factor
      const imgHeightMm = canvasHeight * pxToMm / 3;
      
      // Scale to fit if necessary
      const scaleX = availableWidth / imgWidthMm;
      const scaleY = availableHeight / imgHeightMm;
      const scale = Math.min(scaleX, scaleY, 1); // Don't scale up
      
      const finalWidth = imgWidthMm * scale;
      const finalHeight = imgHeightMm * scale;
      
      // Center the image on the page
      const x = (pdfWidth - finalWidth) / 2;
      const y = margin;

      // Add image to PDF
      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight, undefined, 'FAST');
      
      // Save the PDF
      pdf.save(`invoice-${invoice.invoiceNumber || 'document'}.pdf`);
      
      toast({
        title: "Success",
        description: `Invoice ${invoice.invoiceNumber}.pdf downloaded successfully.`,
      });

    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "PDF Generation Failed",
        description: "An error occurred while generating the PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    downloadPdf: handleDownloadPdf,
  }));

  const invoiceDate = invoice.invoiceDate instanceof Timestamp ? invoice.invoiceDate.toDate() : new Date(invoice.invoiceDate);
  const dueDate = invoice.dueDate instanceof Timestamp ? invoice.dueDate.toDate() : new Date(invoice.dueDate);
  const currencySymbol = invoice.currency === "INR" ? "Rs." : (invoice.currency || "Rs.");

  return (
    <Card className="max-w-4xl mx-auto shadow-lg">
      <div ref={invoiceCardRef} data-invoice-content className="bg-white"> 
        <CardHeader className="bg-gray-50 p-8 border-b">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="flex-1">
              {invoice.billerInfo.logoUrl ? (
                <Image
                  src={invoice.billerInfo.logoUrl}
                  alt={`${invoice.billerInfo.businessName} logo`}
                  width={150}
                  height={75}
                  className="mb-4"
                  style={{ objectFit: 'contain' }} 
                  data-ai-hint="company logo"
                />
              ) : (
                <div className="h-20 w-40 bg-gray-200 flex items-center justify-center text-gray-600 mb-4 rounded text-sm border" data-ai-hint="logo placeholder">
                  {invoice.billerInfo.businessName}
                </div>
              )}
              <h2 className="text-2xl font-bold text-blue-700 mb-2">{invoice.billerInfo.businessName}</h2>
              <div className="text-sm text-gray-600 space-y-1">
                <p>{invoice.billerInfo.addressLine1}</p>
                {invoice.billerInfo.addressLine2 && <p>{invoice.billerInfo.addressLine2}</p>}
                <p>{invoice.billerInfo.city}, {invoice.billerInfo.state} - {invoice.billerInfo.postalCode}</p>
                {invoice.billerInfo.gstin && (
                  <p className="font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded mt-2 inline-block border">
                    GSTIN: {invoice.billerInfo.gstin}
                  </p>
                )}
              </div>
            </div>
            <div className="text-left md:text-right">
              <h1 className="text-4xl font-bold uppercase text-gray-700 mb-2">Invoice</h1>
              <p className="text-xl text-gray-600 mb-4"># {invoice.invoiceNumber}</p>
              <div className="flex items-center justify-start md:justify-end gap-2 mb-4">
                 {statusIcons[invoice.status]}
                <span className="text-sm font-medium capitalize px-3 py-1 bg-gray-100 rounded">{invoice.status}</span>
              </div>
              <div className="border-t pt-4 space-y-2">
                <p className="text-sm"><span className="font-semibold text-gray-700">Date:</span> {format(invoiceDate, "dd MMM, yyyy")}</p>
                <p className="text-sm"><span className="font-semibold text-gray-700">Due Date:</span> {format(dueDate, "dd MMM, yyyy")}</p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8">
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-gray-700 mb-3 text-lg border-b pb-2">Bill To:</h3>
              <div className="space-y-1">
                <p className="font-semibold text-blue-700 text-lg">{invoice.client.name}</p>
                <p className="text-sm text-gray-600">{invoice.client.addressLine1}</p>
                {invoice.client.addressLine2 && <p className="text-sm text-gray-600">{invoice.client.addressLine2}</p>}
                <p className="text-sm text-gray-600">{invoice.client.city}, {invoice.client.state} - {invoice.client.postalCode}</p>
                {invoice.client.gstin && <p className="text-sm font-semibold text-gray-700">GSTIN: {invoice.client.gstin}</p>}
              </div>
            </div>
            {invoice.shippingAddress && (
              <div>
                <h3 className="font-bold text-gray-700 mb-3 text-lg border-b pb-2">Ship To:</h3>
                <div className="space-y-1">
                  <p className="font-semibold text-blue-700 text-lg">{invoice.shippingAddress.name}</p>
                  <p className="text-sm text-gray-600">{invoice.shippingAddress.addressLine1}</p>
                  {invoice.shippingAddress.addressLine2 && <p className="text-sm text-gray-600">{invoice.shippingAddress.addressLine2}</p>}
                  <p className="text-sm text-gray-600">{invoice.shippingAddress.city}, {invoice.shippingAddress.state} - {invoice.shippingAddress.postalCode}</p>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm border-collapse border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left font-bold text-gray-700 border border-gray-300">#</th>
                  <th className="p-3 text-left font-bold text-gray-700 border border-gray-300">Item/Service</th>
                  <th className="p-3 text-center font-bold text-gray-700 border border-gray-300">Qty</th>
                  <th className="p-3 text-right font-bold text-gray-700 border border-gray-300">Rate ({currencySymbol})</th>
                  <th className="p-3 text-right font-bold text-gray-700 border border-gray-300">Discount (%)</th>
                  <th className="p-3 text-right font-bold text-gray-700 border border-gray-300">Amount ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, index) => (
                  <tr key={item.id} className="border-b border-gray-300">
                    <td className="p-3 border border-gray-300">{index + 1}</td>
                    <td className="p-3 border border-gray-300 font-medium">{item.productName}</td>
                    <td className="p-3 text-center border border-gray-300">{item.quantity}</td>
                    <td className="p-3 text-right border border-gray-300">{item.rate.toFixed(2)}</td>
                    <td className="p-3 text-right border border-gray-300">{item.discountPercentage.toFixed(2)}%</td>
                    <td className="p-3 text-right border border-gray-300 font-semibold">{item.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              {invoice.notes && (
                <div>
                  <h4 className="font-bold text-gray-700 mb-2">Notes:</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border">{invoice.notes}</p>
                </div>
              )}
              {invoice.termsAndConditions && (
                <div>
                  <h4 className="font-bold text-gray-700 mb-2">Terms & Conditions:</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border">{invoice.termsAndConditions}</p>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="bg-gray-50 p-4 rounded border">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Subtotal:</span> 
                  <span className="font-semibold">{currencySymbol}{invoice.subTotal.toFixed(2)}</span>
                </div>
                {!invoice.isInterState && (
                  <>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">
                      CGST ({(invoice.lineItems[0]?.taxRate || 18) / 2}%):
                    </span> 
                    <span className="font-semibold">{currencySymbol}{invoice.totalCGST.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">
                      SGST ({(invoice.lineItems[0]?.taxRate || 18) / 2}%):
                    </span> 
                    <span className="font-semibold">{currencySymbol}{invoice.totalSGST.toFixed(2)}</span>
                  </div>
                  </>
                )}
                {invoice.isInterState && (
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">
                      IGST ({invoice.lineItems[0]?.taxRate || 18}%):
                    </span> 
                    <span className="font-semibold">{currencySymbol}{invoice.totalIGST.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between text-xl font-bold text-blue-700">
                    <span>Grand Total:</span> 
                    <span>{currencySymbol}{invoice.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {invoice.billerInfo.bankName && (
          <div className="mt-8 pt-6 border-t">
            <h4 className="font-bold text-gray-700 mb-4 text-lg">Payment Information:</h4>
            <div className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm bg-gray-50 p-4 rounded border">
              {invoice.billerInfo.bankName && <p><strong>Bank:</strong> {invoice.billerInfo.bankName}</p>}
              {invoice.billerInfo.accountNumber && <p><strong>A/C No:</strong> {invoice.billerInfo.accountNumber}</p>}
              {invoice.billerInfo.ifscCode && <p><strong>IFSC:</strong> {invoice.billerInfo.ifscCode}</p>}
              {invoice.billerInfo.upiId && <p><strong>UPI:</strong> {invoice.billerInfo.upiId}</p>}
            </div>
          </div>
          )}
        </CardContent>
      </div> 
      <CardFooter className="p-6 border-t bg-gray-50 flex flex-col sm:flex-row justify-end items-center gap-2 do-not-print-in-pdf">
        <Button variant="outline" asChild>
          <Link href={`/dashboard/invoices/${invoice.id}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit Invoice</Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={isUpdatingStatus}>
                {isUpdatingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MoreVertical className="mr-2 h-4 w-4" />}
                Change Status
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Mark as...</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {invoice.status !== 'sent' && <DropdownMenuItem onClick={() => handleUpdateStatus('sent')} disabled={isUpdatingStatus}>Sent</DropdownMenuItem>}
            {invoice.status !== 'paid' && <DropdownMenuItem onClick={() => handleUpdateStatus('paid')} disabled={isUpdatingStatus}>Paid</DropdownMenuItem>}
            {invoice.status !== 'overdue' && (invoice.status === 'sent' || invoice.status === 'draft') && <DropdownMenuItem onClick={() => handleUpdateStatus('overdue')} disabled={isUpdatingStatus}>Overdue</DropdownMenuItem>}
            <DropdownMenuSeparator />
            {invoice.status !== 'draft' && <DropdownMenuItem onClick={() => handleUpdateStatus('draft')} disabled={isUpdatingStatus}>Draft</DropdownMenuItem>}
            {invoice.status !== 'cancelled' && <DropdownMenuItem onClick={() => handleUpdateStatus('cancelled')} disabled={isUpdatingStatus || invoice.status === 'paid'} className="text-destructive focus:text-destructive focus:bg-destructive/10">Cancelled</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Button variant="outline" onClick={() => window.print()} disabled={isDownloading}><Printer className="mr-2 h-4 w-4" /> Print</Button>
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
      </CardFooter>
    </Card>
  );
});

InvoicePreview.displayName = 'InvoicePreview';