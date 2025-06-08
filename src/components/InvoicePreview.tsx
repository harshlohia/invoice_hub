import type { Invoice } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Download, Printer, Send, Edit } from "lucide-react";
import { format } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';

interface InvoicePreviewProps {
  invoice: Invoice;
}

export function InvoicePreview({ invoice }: InvoicePreviewProps) {
  return (
    <Card className="max-w-4xl mx-auto shadow-lg">
      <CardHeader className="bg-muted/30 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            {invoice.billerInfo.logoUrl ? (
              <Image src={invoice.billerInfo.logoUrl} alt={`${invoice.billerInfo.businessName} logo`} width={120} height={60} className="mb-2" data-ai-hint="company logo" />
            ) : (
              <div className="h-16 w-32 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-muted-foreground mb-2 rounded text-sm" data-ai-hint="logo placeholder">
                Logo
              </div>
            )}
            <h2 className="text-2xl font-headline font-semibold text-primary">{invoice.billerInfo.businessName}</h2>
            <p className="text-sm text-muted-foreground">{invoice.billerInfo.addressLine1}</p>
            {invoice.billerInfo.addressLine2 && <p className="text-sm text-muted-foreground">{invoice.billerInfo.addressLine2}</p>}
            <p className="text-sm text-muted-foreground">{invoice.billerInfo.city}, {invoice.billerInfo.state} - {invoice.billerInfo.postalCode}</p>
            <p className="text-sm text-muted-foreground">GSTIN: {invoice.billerInfo.gstin}</p>
          </div>
          <div className="text-left md:text-right">
            <h1 className="text-3xl font-headline font-bold uppercase text-gray-700 dark:text-gray-300">Invoice</h1>
            <p className="text-lg text-muted-foreground"># {invoice.invoiceNumber}</p>
            <Separator className="my-2"/>
            <p className="text-sm"><span className="font-medium text-foreground">Date:</span> {format(new Date(invoice.invoiceDate), "dd MMM, yyyy")}</p>
            <p className="text-sm"><span className="font-medium text-foreground">Due Date:</span> {format(new Date(invoice.dueDate), "dd MMM, yyyy")}</p>
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
                <th className="p-2 text-right font-semibold text-foreground">Rate (₹)</th>
                <th className="p-2 text-right font-semibold text-foreground">Discount (%)</th>
                <th className="p-2 text-right font-semibold text-foreground">Amount (₹)</th>
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
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal:</span> <span className="font-medium">₹{invoice.subTotal.toFixed(2)}</span></div>
            {!invoice.isInterState && (
              <>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">CGST:</span> <span className="font-medium">₹{invoice.totalCGST.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">SGST:</span> <span className="font-medium">₹{invoice.totalSGST.toFixed(2)}</span></div>
              </>
            )}
            {invoice.isInterState && (
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">IGST:</span> <span className="font-medium">₹{invoice.totalIGST.toFixed(2)}</span></div>
            )}
            <Separator/>
            <div className="flex justify-between text-xl font-bold text-primary"><span className="text-foreground">Grand Total:</span> <span>₹{invoice.grandTotal.toFixed(2)}</span></div>
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
      <CardFooter className="p-6 border-t bg-muted/30 flex flex-col sm:flex-row justify-end items-center gap-2">
        <Button variant="outline" asChild>
          <Link href={`/dashboard/invoices/${invoice.id}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit Invoice</Link>
        </Button>
        <Button variant="outline" disabled><Send className="mr-2 h-4 w-4" /> Send to Client</Button>
        <Button variant="outline" disabled><Printer className="mr-2 h-4 w-4" /> Print</Button>
        <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled>
          <Download className="mr-2 h-4 w-4" /> Download PDF
        </Button>
      </CardFooter>
    </Card>
  );
}
