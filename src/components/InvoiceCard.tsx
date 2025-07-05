
"use client";

import type { Invoice } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Eye, Edit, Download, Trash2, CheckCircle, AlertCircle, FilePenLine, MoreVertical, Loader2, Send, Calendar, DollarSign, User, FileText } from 'lucide-react';
import {format} from 'date-fns';
import type { Timestamp as FirestoreTimestamp } from 'firebase/firestore';
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
import { doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface InvoiceCardProps {
  invoice: Invoice;
  onStatusUpdate?: (invoiceId: string, newStatus: Invoice['status']) => void;
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
  return (dateValue as FirestoreTimestamp).toDate();
};


export function InvoiceCard({ invoice: initialInvoice, onStatusUpdate }: InvoiceCardProps) {
  const [invoice, setInvoice] = useState<Invoice>(initialInvoice);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setInvoice(initialInvoice);
  }, [initialInvoice]);

  const invoiceDate = ensureDate(invoice.invoiceDate);
  const dueDate = ensureDate(invoice.dueDate);
  const currencySymbol = invoice.currency === "INR" ? "Rs." : (invoice.currency || "Rs.");

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
        updatedAt: serverTimestamp(),
      });
      
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
    <Card className="group hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 hover:-translate-y-1 border border-border/50 hover:border-blue-200/60 dark:hover:border-blue-800/60 bg-card/50 hover:bg-card backdrop-blur-sm">
      <div className="p-4">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-100 dark:bg-blue-950/30 rounded-full flex items-center justify-center">
              <FileText className="h-3 w-3 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-headline text-lg font-semibold text-foreground group-hover:text-blue-600 transition-colors duration-200">
              {invoice.invoiceNumber}
            </h3>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={isUpdatingStatus}>
              <Badge 
                className={`capitalize cursor-pointer hover:opacity-90 hover:scale-105 transition-all duration-200 text-xs ${statusStyles[invoice.status]}`}
              >
                {isUpdatingStatus ? <Loader2 className="h-3 w-3 animate-spin" /> : statusIcons[invoice.status]}
                <span className="ml-1 font-medium">{invoice.status}</span>
                {!isUpdatingStatus && <MoreVertical className="ml-1 h-2 w-2 opacity-70" />}
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
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

        {/* Client Info Row */}
        <div className="flex items-center gap-2 mb-3 p-2 bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-950/10 dark:to-emerald-950/10 rounded-lg border border-green-200/30 dark:border-green-800/20">
          <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
            <User className="h-3 w-3 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wide">Client</div>
            <div className="text-sm font-semibold text-green-900 dark:text-green-100 truncate">{invoice.client.name}</div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 w-5 h-5 bg-orange-100 dark:bg-orange-950/30 rounded-full flex items-center justify-center">
              <Calendar className="h-3 w-3 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-muted-foreground">Date</div>
              <div className="text-sm font-medium text-foreground">{format(invoiceDate, "dd MMM yyyy")}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 w-5 h-5 bg-blue-100 dark:bg-blue-950/30 rounded-full flex items-center justify-center">
              <DollarSign className="h-3 w-3 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-muted-foreground">Amount</div>
              <div className="text-sm font-bold text-foreground">{currencySymbol}{invoice.grandTotal.toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            variant="default" 
            size="sm" 
            asChild 
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md transition-all duration-200 h-8 text-xs"
          >
            <Link href={`/dashboard/invoices/${invoice.id}`}>
              <Eye className="mr-1 h-3 w-3" /> 
              View
            </Link>
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            asChild 
            className="flex-1 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 dark:hover:bg-blue-950/30 transition-all duration-200 h-8 text-xs"
          >
            <Link href={`/dashboard/invoices/${invoice.id}/edit`}>
              <Edit className="mr-1 h-3 w-3" /> 
              Edit
            </Link>
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            asChild 
            className="hover:bg-green-50 hover:border-green-200 hover:text-green-700 dark:hover:bg-green-950/30 transition-all duration-200 h-8 text-xs px-2"
          >
            <Link href={`/dashboard/invoices/${invoice.id}?initiatePdfDownload=true`}>
              <Download className="h-3 w-3" /> 
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
