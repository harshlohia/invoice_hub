
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Invoice } from '@/lib/types';
import { InvoiceForm } from "@/components/forms/InvoiceForm";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardHeader, CardContent } from '@/components/ui/card'; // Added Card, CardHeader, CardContent
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (invoiceId) {
      const fetchInvoice = async () => {
        setLoading(true);
        setError(null);
        try {
          const invoiceDocRef = doc(db, 'invoices', invoiceId);
          const invoiceDocSnap = await getDoc(invoiceDocRef);

          if (invoiceDocSnap.exists()) {
            const data = invoiceDocSnap.data();
            // Convert Firestore Timestamps to JS Dates for the form
            const fetchedInvoice: Invoice = {
              id: invoiceDocSnap.id,
              userId: data.userId,
              invoiceNumber: data.invoiceNumber,
              invoiceDate: (data.invoiceDate as Timestamp).toDate(),
              dueDate: (data.dueDate as Timestamp).toDate(),
              billerInfo: data.billerInfo,
              client: data.client,
              shippingAddress: data.shippingAddress,
              lineItems: data.lineItems.map(item => ({
                ...item,
                // Ensure line items have IDs for form's field array if they might be missing
                // from older data, though our current types.ts includes it.
                id: item.id || crypto.randomUUID(), 
              })),
              notes: data.notes,
              termsAndConditions: data.termsAndConditions,
              subTotal: data.subTotal,
              totalCGST: data.totalCGST,
              totalSGST: data.totalSGST,
              totalIGST: data.totalIGST,
              grandTotal: data.grandTotal,
              status: data.status,
              isInterState: data.isInterState,
              createdAt: data.createdAt, // Keep original timestamp
              updatedAt: data.updatedAt,
            };
            setInvoice(fetchedInvoice);
          } else {
            setError('Invoice not found.');
          }
        } catch (err) {
          console.error("Error fetching invoice for edit:", err);
          setError('Failed to load invoice data. Please try again.');
        } finally {
          setLoading(false);
        }
      };
      fetchInvoice();
    } else {
      router.push('/dashboard/invoices'); // Should not happen if route is correct
    }
  }, [invoiceId, router]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <Skeleton className="h-8 w-1/2 mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Card className="shadow-lg">
          <CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-1/2" />
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-1/4" />
          </CardContent>
        </Card>
        <div className="flex justify-end gap-3 pt-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Alert variant="destructive" className="text-left">
          <AlertTriangle className="h-5 w-5"/>
          <AlertTitle className="font-headline">Error Loading Invoice</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button asChild variant="link" className="mt-6">
          <Link href="/dashboard/invoices">Back to Invoices</Link>
        </Button>
      </div>
    );
  }

  if (!invoice) {
     return ( 
      <div className="max-w-2xl mx-auto text-center py-12">
        <Alert variant="destructive" className="text-left">
          <AlertTriangle className="h-5 w-5"/>
          <AlertTitle className="font-headline">Invoice Not Found</AlertTitle>
          <AlertDescription>
            The invoice you are trying to edit does not exist or could not be loaded.
          </AlertDescription>
        </Alert>
        <Button asChild variant="link" className="mt-6">
          <Link href="/dashboard/invoices">Back to Invoices</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold tracking-tight">Edit Invoice {invoice.invoiceNumber}</h1>
        <p className="text-muted-foreground">Update the details for this invoice.</p>
      </div>
      <InvoiceForm initialData={invoice} />
    </div>
  );
}
