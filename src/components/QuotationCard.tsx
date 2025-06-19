"use client";

import type { Quotation } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Eye, Edit, MoreVertical, Loader2, Send, CheckCircle, XCircle, Clock, FilePenLine } from 'lucide-react';
import { format } from 'date-fns';
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

interface QuotationCardProps {
  quotation: Quotation;
  onStatusUpdate?: (quotationId: string, newStatus: Quotation['status']) => void;
}

const statusStyles: Record<Quotation['status'], string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-300 border-gray-300 dark:border-gray-500',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-700/30 dark:text-blue-300 border-blue-300 dark:border-blue-500',
  accepted: 'bg-green-100 text-green-700 dark:bg-green-700/30 dark:text-green-300 border-green-300 dark:border-green-500',
  declined: 'bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300 border-red-300 dark:border-red-500',
  expired: 'bg-orange-100 text-orange-700 dark:bg-orange-700/30 dark:text-orange-300 border-orange-300 dark:border-orange-500',
};

const statusIcons: Record<Quotation['status'], React.ReactElement> = {
  draft: <FilePenLine className="h-4 w-4" />,
  sent: <Send className="h-4 w-4" />,
  accepted: <CheckCircle className="h-4 w-4" />,
  declined: <XCircle className="h-4 w-4" />,
  expired: <Clock className="h-4 w-4" />,
};

const ensureDate = (dateValue: Date | FirestoreTimestamp | undefined): Date => {
  if (!dateValue) return new Date();
  if (dateValue instanceof Date) {
    return dateValue;
  }
  return (dateValue as FirestoreTimestamp).toDate();
};

export function QuotationCard({ quotation: initialQuotation, onStatusUpdate }: QuotationCardProps) {
  const [quotation, setQuotation] = useState<Quotation>(initialQuotation);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setQuotation(initialQuotation);
  }, [initialQuotation]);

  const quotationDate = ensureDate(quotation.quotationDate);
  const validUntil = ensureDate(quotation.validUntil);

  const handleUpdateStatusOnCard = async (newStatus: Quotation['status']) => {
    if (!quotation.id) {
      toast({ title: "Error", description: "Quotation ID is missing.", variant: "destructive" });
      return;
    }
    setIsUpdatingStatus(true);
    try {
      const quotationRef = doc(db, 'quotations', quotation.id);
      await updateDoc(quotationRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      
      const updatedQuotationLocal = { ...quotation, status: newStatus, updatedAt: new Timestamp(Math.floor(new Date().getTime() / 1000), 0) };
      setQuotation(updatedQuotationLocal); 

      if (onStatusUpdate && quotation.id) {
        onStatusUpdate(quotation.id, newStatus); 
      }

      toast({ title: "Status Updated", description: `Quotation marked as ${newStatus}.` });
    } catch (error) {
      console.error("Error updating quotation status from card:", error);
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-semibold">
              {quotation.quotationNumber}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {quotation.client.name}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={isUpdatingStatus}>
              <Badge 
                className={`capitalize cursor-pointer hover:opacity-80 transition-opacity ${statusStyles[quotation.status]}`}
              >
                {isUpdatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : statusIcons[quotation.status]}
                <span className="ml-1">{quotation.status}</span>
                {!isUpdatingStatus && <MoreVertical className="ml-1 h-3 w-3 opacity-70" />}
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Change Status to...</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {quotation.status !== 'sent' && <DropdownMenuItem onClick={() => handleUpdateStatusOnCard('sent')} disabled={isUpdatingStatus}>Sent</DropdownMenuItem>}
              {quotation.status !== 'accepted' && <DropdownMenuItem onClick={() => handleUpdateStatusOnCard('accepted')} disabled={isUpdatingStatus}>Accepted</DropdownMenuItem>}
              {quotation.status !== 'declined' && <DropdownMenuItem onClick={() => handleUpdateStatusOnCard('declined')} disabled={isUpdatingStatus}>Declined</DropdownMenuItem>}
              {quotation.status !== 'expired' && <DropdownMenuItem onClick={() => handleUpdateStatusOnCard('expired')} disabled={isUpdatingStatus}>Expired</DropdownMenuItem>}
              <DropdownMenuSeparator />
              {quotation.status !== 'draft' && <DropdownMenuItem onClick={() => handleUpdateStatusOnCard('draft')} disabled={isUpdatingStatus}>Draft</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <h4 className="font-medium">{quotation.title}</h4>
          {quotation.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {quotation.description}
            </p>
          )}
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Date: {format(quotationDate, 'MMM dd, yyyy')}</span>
          <span>Valid: {format(validUntil, 'MMM dd, yyyy')}</span>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">
            Rs. {quotation.grandTotal.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </p>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link href={`/dashboard/quotations/${quotation.id}`}>
              <Eye className="mr-1 h-3 w-3" />
              View
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link href={`/dashboard/quotations/${quotation.id}/edit`}>
              <Edit className="mr-1 h-3 w-3" />
              Edit
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}