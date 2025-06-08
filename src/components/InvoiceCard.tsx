
import type { Invoice } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Eye, Edit, Download, Trash2, CheckCircle, AlertCircle, Clock, FilePenLine } from 'lucide-react'; // Added FilePenLine for draft
import {format} from 'date-fns';
import type { Timestamp } from 'firebase/firestore';

interface InvoiceCardProps {
  invoice: Invoice;
}

const statusStyles = {
  paid: 'bg-green-100 text-green-700 dark:bg-green-700/30 dark:text-green-300 border-green-300 dark:border-green-500',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-700/30 dark:text-blue-300 border-blue-300 dark:border-blue-500',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300 border-red-300 dark:border-red-500',
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-300 border-gray-300 dark:border-gray-500',
  cancelled: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-700/30 dark:text-yellow-300 border-yellow-300 dark:border-yellow-500',
};

const statusIcons = {
  paid: <CheckCircle className="h-4 w-4" />,
  sent: <Clock className="h-4 w-4" />, // Using Clock for sent as it implies pending payment
  overdue: <AlertCircle className="h-4 w-4" />,
  draft: <FilePenLine className="h-4 w-4" />, // Using FilePenLine for draft
  cancelled: <Trash2 className="h-4 w-4" />, // Placeholder, consider a different icon like Ban
};

// Helper to convert Firestore Timestamp to Date if necessary
const ensureDate = (dateValue: Date | Timestamp | undefined): Date => {
  if (!dateValue) return new Date(); // Fallback, though dates should always exist
  if (dateValue instanceof Date) {
    return dateValue;
  }
  // Assuming it's a Firestore Timestamp object
  return dateValue.toDate();
};


export function InvoiceCard({ invoice }: InvoiceCardProps) {
  const invoiceDate = ensureDate(invoice.invoiceDate);
  const dueDate = ensureDate(invoice.dueDate);

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="font-headline text-xl mb-1">{invoice.invoiceNumber}</CardTitle>
            <CardDescription>To: {invoice.client.name}</CardDescription>
          </div>
          <Badge className={`capitalize ${statusStyles[invoice.status]}`}>
            {statusIcons[invoice.status]}
            <span className="ml-1">{invoice.status}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 flex-grow">
        <p className="text-sm">
          <span className="font-medium">Date:</span> {format(invoiceDate, "dd MMM yyyy")}
        </p>
        <p className="text-sm">
          <span className="font-medium">Due:</span> {format(dueDate, "dd MMM yyyy")}
        </p>
        <p className="text-lg font-semibold">
          Total: ₹{invoice.grandTotal.toLocaleString('en-IN')}
        </p>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 justify-end border-t pt-4 mt-auto">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/invoices/${invoice.id}`}><Eye className="mr-1 h-4 w-4" /> View</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/invoices/${invoice.id}/edit`}><Edit className="mr-1 h-4 w-4" /> Edit</Link>
        </Button>
        <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80" disabled>
          <Download className="mr-1 h-4 w-4" /> PDF
        </Button>
      </CardFooter>
    </Card>
  );
}
