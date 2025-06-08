import type { Invoice } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Eye, Edit, Download, Trash2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import {format} from 'date-fns';

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
  sent: <Clock className="h-4 w-4" />,
  overdue: <AlertCircle className="h-4 w-4" />,
  draft: <Edit className="h-4 w-4" />,
  cancelled: <Trash2 className="h-4 w-4" />,
};


export function InvoiceCard({ invoice }: InvoiceCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
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
      <CardContent className="space-y-2">
        <p className="text-sm">
          <span className="font-medium">Date:</span> {format(new Date(invoice.invoiceDate), "dd MMM yyyy")}
        </p>
        <p className="text-sm">
          <span className="font-medium">Due:</span> {format(new Date(invoice.dueDate), "dd MMM yyyy")}
        </p>
        <p className="text-lg font-semibold">
          Total: ₹{invoice.grandTotal.toLocaleString('en-IN')}
        </p>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/invoices/${invoice.id}`}><Eye className="mr-1 h-4 w-4" /> View</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/invoices/${invoice.id}/edit`}><Edit className="mr-1 h-4 w-4" /> Edit</Link>
        </Button>
        <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
          <Download className="mr-1 h-4 w-4" /> PDF
        </Button>
      </CardFooter>
    </Card>
  );
}
