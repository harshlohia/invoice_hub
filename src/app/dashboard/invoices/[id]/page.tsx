"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Invoice } from '@/lib/types';
import { InvoicePreview } from '@/components/InvoicePreview';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

interface InvoicePreviewHandle {
  downloadPdf: () => Promise<void>;
}

export default function ViewInvoicePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const invoiceId = params.id as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const invoicePreviewRef = useRef<InvoicePreviewHandle>(null);
  const [downloadTriggered, setDownloadTriggered] = useState(false);

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
            const fetchedInvoice = {
              id: invoiceDocSnap.id,
              ...data,
              invoiceDate: (data.invoiceDate as Timestamp).toDate(),
              dueDate: (data.dueDate as Timestamp).toDate(),
              createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : undefined,
              updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : undefined,
              currency: data.currency || "INR", // Ensure currency is available
              // Convert any Timestamp objects in lineItems to Date objects
              lineItems: data.lineItems ? data.lineItems.map((item: any) => ({
                ...item,
                // Convert date field if it exists and is a Timestamp
                ...(item.date && item.date instanceof Timestamp ? { date: item.date.toDate() } : {})
              })) : []
            } as Invoice;
            setInvoice(fetchedInvoice);
          } else {
            setError('Invoice not found.');
          }
        } catch (err) {
          console.error("Error fetching invoice:", err);
          setError('Failed to load invoice data. Please try again.');
        } finally {
          setLoading(false);
        }
      };
      fetchInvoice();
    }
  }, [invoiceId]);

  useEffect(() => {
    const initiateDownload = searchParams.get('initiatePdfDownload');
    if (initiateDownload === 'true' && invoice && invoicePreviewRef.current && !downloadTriggered) {
      setDownloadTriggered(true); // Prevent re-triggering
      // Adding a small delay to ensure content is rendered before PDF generation
      setTimeout(() => {
        invoicePreviewRef.current?.downloadPdf().catch(pdfError => {
          console.error("Error triggering PDF download from ViewInvoicePage:", pdfError);
          // Optionally, show a toast message to the user about the error
        });
      }, 500); // 500ms delay
    }
  }, [searchParams, invoice, downloadTriggered]);


  const handleStatusChangeFromPreview = (updatedInvoice: Invoice) => {
    setInvoice(updatedInvoice); // Update the state on this page if status changes in preview
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-1/2 mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Skeleton className="h-[70vh] w-full" /> 
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
            The invoice you are looking for does not exist or could not be loaded.
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
        <h1 className="text-3xl font-headline font-bold tracking-tight">Invoice {invoice.invoiceNumber}</h1>
        <p className="text-muted-foreground">Viewing details for invoice sent to {invoice.client.name}.</p>
      </div>
      <InvoicePreview ref={invoicePreviewRef} invoice={invoice} onStatusChange={handleStatusChangeFromPreview} />
    </div>
  );
}