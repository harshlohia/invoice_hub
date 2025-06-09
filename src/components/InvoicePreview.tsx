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
      
      // Create canvas from the invoice element
      const canvas = await html2canvas(elementToCapture, {
        scale: 2, // Higher resolution
        useCORS: true, 
        logging: false,
        backgroundColor: '#ffffff',
        ignoreElements: (element) => element.classList.contains('do-not-print-in-pdf'),
        onclone: (clonedDoc) => {
          // Ensure all styles are properly applied in the cloned document
          const clonedElement = clonedDoc.querySelector('[data-invoice-content]');
          if (clonedElement) {
            (clonedElement as HTMLElement).style.transform = 'none';
            (clonedElement as HTMLElement).style.position = 'static';
          }
        }
      });

      // Convert canvas to image data
      const imgData = canvas.toDataURL('image/png');
      
      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Calculate dimensions to fit the content properly
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      // Calculate scaling to fit content within PDF page with margins
      const margin = 10; // 10mm margin
      const availableWidth = pdfWidth - (margin * 2);
      const availableHeight = pdfHeight - (margin * 2);
      
      const scaleX = availableWidth / (canvasWidth * 0.264583); // Convert px to mm
      const scaleY = availableHeight / (canvasHeight * 0.264583);
      const scale = Math.min(scaleX, scaleY);
      
      const imgWidth = (canvasWidth * 0.264583) * scale;
      const imgHeight = (canvasHeight * 0.264583) * scale;
      
      // Center the image on the page
      const x = (pdfWidth - imgWidth) / 2;
      const y = margin;

      // Add image to PDF
      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
      
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
      <div ref={invoiceCardRef} data-invoice-content> 
        <CardHeader className="bg-muted/30 p-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              {invoice.billerInfo.logoUrl ? (
                <Image
                  src={invoice.billerInfo.logoUrl}
                  alt={`${invoice.billerInfo.businessName} logo`}
                  width={120}
                  height={60}
                  className="mb-2"
                  style={{ objectFit: 'contain' }} 
                  data-ai-hint="company logo"
                />
              ) : (
                <div className="h-16 w-32 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-muted-foreground mb-2 rounded text-sm" data-ai-hint="logo placeholder">
                  Logo
                </div>
              )}
              <h2 className="text-2xl font-headline font-semibold text-primary">{invoice.billerInfo.businessName}</h2>
              <p className="text-sm text-muted-foreground">{invoice.billerInfo.addressLine1}</p>
              {invoice.billerInfo.addressLine2 && <p className="text-sm text-muted-foreground">{invoice.billerInfo.addressLine2}</p>}
              <p className="text-sm text-muted-foreground">{invoice.billerInfo.city}, {invoice.billerInfo.state} - {invoice.billerInfo.postalCode}</p>
              {invoice.billerInfo.gstin && (
                <p className="text-sm font-semibold text-primary bg-primary/10 px-2 py-1 rounded mt-1 inline-block">
                  GSTIN: {invoice.billerInfo.gstin}
                </p>
              )}
            </div>
            <div className="text-left md:text-right">
              <h1 className="text-3xl font-headline font-bold uppercase text-gray-700 dark:text-gray-300">Invoice</h1>
              <p className="text-lg text-muted-foreground"># {invoice.invoiceNumber}</p>
              <div className="flex items-center justify-start md:justify-end gap-2 my-1">
                 {statusIcons[invoice.status]}
                <span className="text-sm font-medium capitalize">{invoice.status}</span>
              </div>
              <Separator className="my-2"/>
              <p className="text-sm"><span className="font-medium text-foreground">Date:</span> {format(invoiceDate, "dd MMM, yyyy")}</p>
              <p className="text-sm"><span className="font-medium text-foreground">Due Date:</span> {format(dueDate, "dd MMM, yyyy")}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-semibold text-foreground mb-1">Bill To:</h3>
              <p className="font-medium text-primary">{invoice.client.name}</p>
              <p className="text-sm text-muted-foreground">{invoice.client.addressLine1}</p>
              {invoice.client.addressLine2 && <p className="text-sm text-muted-foreground">{invoice.client.addressLine2}</p>}
              <p className="text-sm text-muted-foreground">{invoice.client.city}, {invoice.client.state} - {invoice.client.postalCode}</p>
              {invoice.client.gstin && <p className="text-sm text-muted-foreground">GSTIN: {invoice.client.gstin}</p>}
            </div>
            {invoice.shippingAddress && (
              <div>
                <h3 className="font-semibold text-foreground mb-1">Ship To:</h3>
                <p className="font-medium text-primary">{invoice.shippingAddress.name}</p>
                <p className="text-sm text-muted-foreground">{invoice.shippingAddress.addressLine1}</p>
                {invoice.shippingAddress.addressLine2 && <p className="text-sm text-muted-foreground">{invoice.shippingAddress.addressLine2}</p>}
                <p className="text-sm text-muted-foreground">{invoice.shippingAddress.city}, {invoice.shippingAddress.state} - {invoice.shippingAddress.postalCode}</p>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left font-semibold text-foreground">#</th>
                  <th className="p-2 text-left font-semibold text-foreground">Item/Service</th>
                  <th className="p-2 text-right font-semibold text-foreground">Qty</th>
                  <th className="p-2 text-right font-semibold text-foreground">Rate ({currencySymbol})</th>
                  <th className="p-2 text-right font-semibold text-foreground">Discount (%)</th>
                  <th className="p-2 text-right font-semibold text-foreground">Amount ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, index) => (
                  <tr key={item.id} className="border-b">
                    <td className="p-2">{index + 1}</td>
                    <td className="p-2">{item.productName}</td>
                    <td className="p-2 text-right">{item.quantity}</td>
                    <td className="p-2 text-right">{item.rate.toFixed(2)}</td>
                    <td className="p-2 text-right">{item.discountPercentage.toFixed(2)}%</td>
                    <td className="p-2 text-right">{item.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid md:grid-cols-2 mt-6">
            <div className="text-sm text-muted-foreground space-y-1">
              {invoice.notes && (
                <>
                  <h4 className="font-semibold text-foreground">Notes:</h4>
                  <p>{invoice.notes}</p>
                </>
              )}
              {invoice.termsAndConditions && (
                <>
                  <h4 className="font-semibold text-foreground mt-2">Terms & Conditions:</h4>
                  <p>{invoice.termsAndConditions}</p>
                </>
              )}
            </div>
            <div className="space-y-2 mt-4 md:mt-0">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal:</span> <span className="font-medium">{currencySymbol}{invoice.subTotal.toFixed(2)}</span></div>
              {!invoice.isInterState && (
                <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    CGST ({(invoice.lineItems[0]?.taxRate || 18) / 2}%):
                  </span> 
                  <span className="font-medium">{currencySymbol}{invoice.totalCGST.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    SGST ({(invoice.lineItems[0]?.taxRate || 18) / 2}%):
                  </span> 
                  <span className="font-medium">{currencySymbol}{invoice.totalSGST.toFixed(2)}</span>
                </div>
                </>
              )}
              {invoice.isInterState && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    IGST ({invoice.lineItems[0]?.taxRate || 18}%):
                  </span> 
                  <span className="font-medium">{currencySymbol}{invoice.totalIGST.toFixed(2)}</span>
                </div>
              )}
              <Separator/>
              <div className="flex justify-between text-xl font-bold text-primary"><span className="text-foreground">Grand Total:</span> <span>{currencySymbol}{invoice.grandTotal.toFixed(2)}</span></div>
            </div>
          </div>

          {invoice.billerInfo.bankName && (
          <div className="mt-6 pt-4 border-t">
            <h4 className="font-semibold text-foreground mb-2">Payment Information:</h4>
            <div className="grid md:grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {invoice.billerInfo.bankName && <p><strong>Bank:</strong> {invoice.billerInfo.bankName}</p>}
              {invoice.billerInfo.accountNumber && <p><strong>A/C No:</strong> {invoice.billerInfo.accountNumber}</p>}
              {invoice.billerInfo.ifscCode && <p><strong>IFSC:</strong> {invoice.billerInfo.ifscCode}</p>}
              {invoice.billerInfo.upiId && <p><strong>UPI:</strong> {invoice.billerInfo.upiId}</p>}
            </div>
          </div>
          )}
        </CardContent>
      </div> 
      <CardFooter className="p-6 border-t bg-muted/30 flex flex-col sm:flex-row justify-end items-center gap-2 do-not-print-in-pdf">
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