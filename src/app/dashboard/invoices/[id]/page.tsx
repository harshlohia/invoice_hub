import { InvoicePreview } from '@/components/InvoicePreview';
import { mockInvoices } from '@/lib/types'; // Using mock data
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ViewInvoicePageProps {
  params: { id: string };
}

export default function ViewInvoicePage({ params }: ViewInvoicePageProps) {
  // In a real app, fetch invoice by ID from an API
  const invoice = mockInvoices.find(inv => inv.id === params.id);

  if (!invoice) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Alert variant="destructive" className="text-left">
          <AlertTriangle className="h-5 w-5"/>
          <AlertTitle className="font-headline">Invoice Not Found</AlertTitle>
          <AlertDescription>
            The invoice you are looking for does not exist or could not be loaded. Please check the ID or try again.
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
      <InvoicePreview invoice={invoice} />
    </div>
  );
}
