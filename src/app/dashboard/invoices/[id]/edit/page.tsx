import { InvoiceForm } from "@/components/forms/InvoiceForm";
import { mockInvoices } from '@/lib/types'; // Using mock data
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface EditInvoicePageProps {
  params: { id: string };
}

export default function EditInvoicePage({ params }: EditInvoicePageProps) {
  // In a real app, fetch invoice by ID from an API
  const invoiceToEdit = mockInvoices.find(inv => inv.id === params.id);

  if (!invoiceToEdit) {
     return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Alert variant="destructive" className="text-left">
          <AlertTriangle className="h-5 w-5"/>
          <AlertTitle className="font-headline">Invoice Not Found</AlertTitle>
          <AlertDescription>
            The invoice you are trying to edit does not exist.
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
        <h1 className="text-3xl font-headline font-bold tracking-tight">Edit Invoice {invoiceToEdit.invoiceNumber}</h1>
        <p className="text-muted-foreground">Update the details for this invoice.</p>
      </div>
      <InvoiceForm initialData={invoiceToEdit} />
    </div>
  );
}

