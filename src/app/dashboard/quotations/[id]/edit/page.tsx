"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, getFirebaseAuthInstance } from '@/lib/firebase';
import { onAuthStateChanged, type User } from "firebase/auth";
import type { Quotation } from '@/lib/types';
import { QuotationForm } from '@/components/forms/QuotationForm';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function EditQuotationPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuthInstance();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user && !loading) {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router, loading]);

  useEffect(() => {
    const fetchQuotation = async () => {
      if (!params.id || !currentUser) return;

      try {
        const quotationDoc = await getDoc(doc(db, 'quotations', params.id as string));

        if (!quotationDoc.exists()) {
          toast({
            title: "Quotation Not Found",
            description: "The requested quotation could not be found.",
            variant: "destructive",
          });
          router.push('/dashboard/quotations');
          return;
        }

        const quotationData = { id: quotationDoc.id, ...quotationDoc.data() } as Quotation;

        // Check if user owns this quotation
        if (quotationData.userId !== currentUser.uid) {
          toast({
            title: "Access Denied",
            description: "You don't have permission to edit this quotation.",
            variant: "destructive",
          });
          router.push('/dashboard/quotations');
          return;
        }

        setQuotation(quotationData);
      } catch (error) {
        console.error('Error fetching quotation:', error);
        toast({
          title: "Error",
          description: "Failed to load quotation data.",
          variant: "destructive",
        });
        router.push('/dashboard/quotations');
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
      fetchQuotation();
    }
  }, [params.id, currentUser, router, toast]);

  if (loading || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!quotation) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold tracking-tight">Edit Quotation</h1>
        <p className="text-muted-foreground">
          Edit quotation {quotation.quotationNumber} for {quotation.client.name}
        </p>
      </div>
      <QuotationForm initialData={quotation} isEdit={true} />
    </div>
  );
}