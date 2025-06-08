
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Client } from '@/lib/types';
import { ClientForm } from '@/components/forms/ClientForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export default function EditClientPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (clientId) {
      const fetchClient = async () => {
        setLoading(true);
        setError(null);
        try {
          const clientDocRef = doc(db, 'clients', clientId);
          const clientDocSnap = await getDoc(clientDocRef);
          if (clientDocSnap.exists()) {
            setClient({ id: clientDocSnap.id, ...clientDocSnap.data() } as Client);
          } else {
            setError('Client not found.');
          }
        } catch (err) {
          console.error("Error fetching client:", err);
          setError('Failed to load client data.');
        } finally {
          setLoading(false);
        }
      };
      fetchClient();
    } else {
      router.push('/dashboard/clients'); // Should not happen if route is correct
    }
  }, [clientId, router]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader>
            <Skeleton className="h-8 w-3/5" />
            <Skeleton className="h-4 w-4/5" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <div className="flex justify-end gap-3 pt-4">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!client) {
     return ( // Should be caught by error state, but as a fallback
      <div className="max-w-3xl mx-auto">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Client data could not be loaded or client not found.</AlertDescription>
        </Alert>
      </div>
    );
  }
  
  return (
    <div className="max-w-3xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Edit Client</CardTitle>
          <CardDescription>Update the details for {client.name}.</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientForm initialData={client} />
        </CardContent>
      </Card>
    </div>
  );
}
