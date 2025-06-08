
"use client";

import type { Invoice } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Eye, Edit, Download, Trash2, CheckCircle, AlertCircle, Clock, FilePenLine, MoreVertical, Loader2, Send } from 'lucide-react';
import {format} from 'date-fns';
import type { Timestamp as FirestoreTimestamp } from 'firebase/firestore'; // Renamed to avoid conflict if needed, or ensure Timestamp is imported
import { useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore"; // Added Timestamp import
import { useToast } from "@/hooks/use-toast";

interface InvoiceCardProps {
  invoice: Invoice;
  onStatusUpdate?: (invoiceId: string, newStatus: Invoice['status']) => void; // Callback for parent
}

const statusStyles: Record<Invoice['status'], string> = {
  paid: 'bg-green-100 text-green-700 dark:bg-green-700/30 dark:text-green-300 border-green-300 dark:border-green-500',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-700/30 dark:text-blue-300 border-blue-300 dark:border-blue-500',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300 border-red-300 dark:border-red-500',
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-300 border-gray-300 dark:border-gray-500',
  cancelled: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-700/30 dark:text-yellow-300 border-yellow-300 dark:border-yellow-500',
};

const statusIcons: Record<Invoice['status'], React.ReactElement> = {
  paid: <CheckCircle className="h-4 w-4" />,
  sent: <Send className="h-4 w-4" />,
  overdue: <AlertCircle className="h-4 w-4" />,
  draft: <FilePenLine className="h-4 w-4" />,
  cancelled: <Trash2 className="h-4 w-4" />,
};

const ensureDate = (dateValue: Date | FirestoreTimestamp | undefined): Date => {
  if (!dateValue) return new Date();
  if (dateValue instanceof Date) {
    return dateValue;
  }
  // Make sure Timestamp is from firebase/firestore for .toDate()
  return (dateValue as FirestoreTimestamp).toDate();
};


export function InvoiceCard({ invoice: initialInvoice, onStatusUpdate }: InvoiceCardProps) {
  const [invoice, setInvoice] = useState<Invoice>(initialInvoice);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setInvoice(initialInvoice); // Sync with parent prop changes
  }, [initialInvoice]);

  const invoiceDate = ensureDate(invoice.invoiceDate);
  const dueDate = ensureDate(invoice.dueDate);

  const handleUpdateStatusOnCard = async (newStatus: Invoice['status']) => {
    if (!invoice.id) {
      toast({ title: "Error", description: "Invoice ID is missing.", variant: "destructive" });
      return;
    }
    setIsUpdatingStatus(true);
    try {
      const invoiceRef = doc(db, 'invoices', invoice.id);
      await updateDoc(invoiceRef, {
        status: newStatus,
        updatedAt: serverTimestamp(), // serverTimestamp() correctly returns a Timestamp placeholder
      });
      
      // For local state update, use new Timestamp() after ensuring it's imported
      const updatedInvoiceLocal = { ...invoice, status: newStatus, updatedAt: new Timestamp(Math.floor(new Date().getTime() / 1000), 0) };
      setInvoice(updatedInvoiceLocal); 

      if (onStatusUpdate && invoice.id) {
        onStatusUpdate(invoice.id, newStatus); 
      }

      toast({ title: "Status Updated", description: `Invoice marked as ${newStatus}.` });
    } catch (error) {
      console.error("Error updating invoice status from card:", error);
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="font-headline text-xl mb-1">{invoice.invoiceNumber}</CardTitle>
            <CardDescription>To: {invoice.client.name}</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={isUpdatingStatus}>
              <Badge 
                className={`capitalize cursor-pointer hover:opacity-80 transition-opacity ${statusStyles[invoice.status]}`}
              >
                {isUpdatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : statusIcons[invoice.status]}
                <span className="ml-1">{invoice.status}</span>
                {!isUpdatingStatus && <MoreVertical className="ml-1 h-3 w-3 opacity-70" />}
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Change Status to...</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {invoice.status !== 'sent' && <DropdownMenuItem onClick={() => handleUpdateStatusOnCard('sent')} disabled={isUpdatingStatus}>Sent</DropdownMenuItem>}
              {invoice.status !== 'paid' && <DropdownMenuItem onClick={() => handleUpdateStatusOnCard('paid')} disabled={isUpdatingStatus}>Paid</DropdownMenuItem>}
              {invoice.status !== 'overdue' && (invoice.status === 'sent' || invoice.status === 'draft') && <DropdownMenuItem onClick={() => handleUpdateStatusOnCard('overdue')} disabled={isUpdatingStatus}>Overdue</DropdownMenuItem>}
              <DropdownMenuSeparator />
              {invoice.status !== 'draft' && <DropdownMenuItem onClick={() => handleUpdateStatusOnCard('draft')} disabled={isUpdatingStatus}>Draft</DropdownMenuItem>}
              {invoice.status !== 'cancelled' && <DropdownMenuItem onClick={() => handleUpdateStatusOnCard('cancelled')} disabled={isUpdatingStatus || invoice.status === 'paid'} className="text-destructive focus:text-destructive focus:bg-destructive/10">Cancelled</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
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
