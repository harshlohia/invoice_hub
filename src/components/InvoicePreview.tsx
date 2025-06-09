"use client";
import type { Invoice } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Download, Printer, Send, Edit, Loader2, CheckCircle, AlertCircle, Clock, FilePenLine, MoreVertical, Trash2 as CancelIcon } from "lucide-react";
import { format } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useToast } from "@/hooks/use-toast";
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { InvoicePDFGenerator } from '@/lib/pdf-generator';
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
    setIsDownloading(true);

    try {
      const pdfGenerator = new InvoicePDFGenerator();
      pdfGenerator.generateInvoicePDF(invoice, {
        filename: `invoice-${invoice.invoiceNumber}.pdf`,
        download: true
      });
      
      toast({
        title: "Success",
        description: `Invoice ${invoice.invoiceNumber}.pdf downloaded.`,
      });

    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "PDF Generation Failed",
        description: "An error occurred while trying to generate the PDF. Please try again.",
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
      <div ref={invoiceCardRef}> 
        {/* Header Section - Clean Design */}
        <CardHeader className="bg-white p-8 border-b-0">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            {/* Left Side - Logo and Company Info */}
            <div className="flex items-start gap-6">
              {/* Logo */}
              <div className="flex-shrink-0">
                {invoice.billerInfo.logoUrl ? (
                  <Image
                    src={invoice.billerInfo.logoUrl}
                    alt={`${invoice.billerInfo.businessName} logo`}
                    width={80}
                    height={80}
                    className="object-contain"
                    style={{ maxHeight: '80px', maxWidth: '120px' }}
                    data-ai-hint="company logo"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs font-medium rounded">
                    LOGO
                  </div>
                )}
              </div>
              
              {/* Company Details */}
              <div>
                <h2 className="text-xl font-bold text-primary mb-2">{invoice.billerInfo.businessName}</h2>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>{invoice.billerInfo.addressLine1}</p>
                  {invoice.billerInfo.addressLine2 && <p>{invoice.billerInfo.addressLine2}</p>}
                  <p>{invoice.billerInfo.city}, {invoice.billerInfo.state} - {invoice.billerInfo.postalCode}</p>
                  {invoice.billerInfo.gstin && <p>GSTIN: {invoice.billerInfo.gstin}</p>}
                </div>
              </div>
            </div>

            {/* Right Side - Invoice Details */}
            <div className="text-right">
              <h1 className="text-4xl font-bold text-gray-800 mb-2">INVOICE</h1>
              <p className="text-lg text-gray-500 mb-4"># {invoice.invoiceNumber}</p>
              
              {/* Status Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 border rounded-md mb-4">
                {statusIcons[invoice.status]}
                <span className="text-sm font-medium capitalize">{invoice.status}</span>
              </div>
              
              {/* Dates */}
              <div className="text-sm space-y-1">
                <p><span className="font-medium">Date:</span> {format(invoiceDate, "dd MMM, yyyy")}</p>
                <p><span className="font-medium">Due Date:</span> {format(dueDate, "dd MMM, yyyy")}</p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8 space-y-8">
          {/* Bill To Section */}
          <div>
            <h3 className="font-bold text-primary mb-3">Bill To:</h3>
            <div className="text-sm">
              <p className="font-semibold text-primary text-base mb-1">{invoice.client.name}</p>
              <div className="text-gray-600 space-y-1">
                <p>{invoice.client.addressLine1}</p>
                {invoice.client.addressLine2 && <p>{invoice.client.addressLine2}</p>}
                <p>{invoice.client.city}, {invoice.client.state} - {invoice.client.postalCode}</p>
                {invoice.client.gstin && <p>GSTIN: {invoice.client.gstin}</p>}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">#</th>
                  <th className="text-left py-3 px-2 font-semibold text-gray-700">Item/Service</th>
                  <th className="text-center py-3 px-2 font-semibold text-gray-700">Qty</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-700">Rate ({currencySymbol})</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-700">Discount (%)</th>
                  <th className="text-right py-3 px-2 font-semibold text-gray-700">Amount ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, index) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-3 px-2 text-sm">{index + 1}</td>
                    <td className="py-3 px-2 text-sm">{item.productName}</td>
                    <td className="py-3 px-2 text-sm text-center">{item.quantity}</td>
                    <td className="py-3 px-2 text-sm text-right">{item.rate.toFixed(2)}</td>
                    <td className="py-3 px-2 text-sm text-right">{item.discountPercentage.toFixed(2)}%</td>
                    <td className="py-3 px-2 text-sm text-right">{item.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end">
            <div className="w-80 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">{currencySymbol}{invoice.subTotal.toFixed(2)}</span>
              </div>
              
              {!invoice.isInterState ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">CGST:</span>
                    <span className="font-medium">{currencySymbol}{invoice.totalCGST.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">SGST:</span>
                    <span className="font-medium">{currencySymbol}{invoice.totalSGST.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">IGST:</span>
                  <span className="font-medium">{currencySymbol}{invoice.totalIGST.toFixed(2)}</span>
                </div>
              )}
              
              <Separator className="my-2" />
              <div className="flex justify-between text-lg font-bold">
                <span>Grand Total:</span>
                <span className="text-primary">{currencySymbol}{invoice.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Terms & Conditions */}
          {invoice.termsAndConditions && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Terms & Conditions:</h4>
              <p className="text-sm text-gray-600">{invoice.termsAndConditions}</p>
            </div>
          )}

          {/* Payment Information */}
          {(invoice.billerInfo.bankName || invoice.billerInfo.upiId) && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-3">Payment Information:</h4>
              <div className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-600">
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
          {isDownloading ? 'Downloading...' : 'Download PDF'}
        </Button>
      </CardFooter>
    </Card>
  );
});

InvoicePreview.displayName = 'InvoicePreview';