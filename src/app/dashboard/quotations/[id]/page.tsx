
"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Quotation } from '@/lib/types';
import { QuotationPreview } from '@/components/QuotationPreview';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ViewQuotationPage() {
  const params = useParams();
  const quotationId = params.id as string;
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (quotationId) {
      const fetchQuotation = async () => {
        setLoading(true);
        setError(null);
        try {
          const quotationDocRef = doc(db, 'quotations', quotationId);
          const quotationDocSnap = await getDoc(quotationDocRef);
          
          if (quotationDocSnap.exists()) {
            const data = quotationDocSnap.data();
            setQuotation({
              id: quotationDocSnap.id,
              ...data,
              quotationDate: data.quotationDate.toDate(),
              validUntil: data.validUntil.toDate(),
            } as Quotation);
          } else {
            setError("Quotation not found");
          }
        } catch (err) {
          console.error("Error fetching quotation:", err);
          setError("Failed to load quotation");
        } finally {
          setLoading(false);
        }
      };

      fetchQuotation();
    }
  }, [quotationId]);

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
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h3 className="mt-2 text-xl font-semibold">Error Loading Quotation</h3>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/quotations">Back to Quotations</Link>
        </Button>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-2 text-xl font-semibold">Quotation Not Found</h3>
        <p className="mt-1 text-sm text-muted-foreground">The quotation you're looking for doesn't exist.</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/quotations">Back to Quotations</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold tracking-tight">
          Quotation {quotation.quotationNumber}
        </h1>
        <p className="text-muted-foreground">
          Created for {quotation.client.name}
        </p>
      </div>
      <QuotationPreview quotation={quotation} />
    </div>
  );
}
