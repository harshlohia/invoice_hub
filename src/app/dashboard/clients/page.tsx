
"use client";

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClientCard } from '@/components/ClientCard';
import type { Client } from '@/lib/types';
import { PlusCircle, Search, Users, Loader2, AlertTriangle } from 'lucide-react';
import { collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db, getFirebaseAuthInstance } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { onAuthStateChanged, type User, type Auth } from 'firebase/auth';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const fetchClients = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const clientsRef = collection(db, "clients");
      const q = query(clientsRef, where("userId", "==", userId));
      const querySnapshot = await getDocs(q);
      const clientsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      setClients(clientsData);
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError("Failed to load clients. Please try again.");
      toast({ title: "Error", description: "Could not fetch clients.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const authInstance: Auth = getFirebaseAuthInstance();
    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
      setCurrentUser(user);
      if (user) {
        fetchClients(user.uid);
      } else {
        setLoading(false);
        setClients([]); // Clear clients if user logs out
        setError("Please log in to view your clients.");
      }
    });
    return () => unsubscribe();
  }, [fetchClients]);

  const handleDeleteClient = async (clientId: string) => {
    if (!clientId) return;
    try {
      await deleteDoc(doc(db, "clients", clientId));
      setClients(prevClients => prevClients.filter(client => client.id !== clientId));
      toast({
        title: "Client Deleted",
        description: "The client has been successfully deleted.",
      });
    } catch (err) {
      console.error("Error deleting client:", err);
      toast({
        title: "Error",
        description: "Failed to delete client. Please try again.",
        variant: "destructive",
      });
    }
    setClientToDelete(null); 
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.gstin?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">Manage your client database.</p>
        </div>
        <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={!currentUser}>
          <Link href="/dashboard/clients/new">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Client
          </Link>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 p-4 border rounded-lg bg-card shadow">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Search by client name, GSTIN, email..." 
            className="pl-10 w-full" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={!currentUser}
          />
        </div>
      </div>

      {loading && (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-lg text-muted-foreground">Loading clients...</p>
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <h3 className="mt-2 text-xl font-semibold">Error Loading Clients</h3>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          {!currentUser && (
            <Button asChild className="mt-4"><Link href="/login">Log In</Link></Button>
          )}
        </div>
      )}

      {!loading && !error && currentUser && filteredClients.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => (
            <ClientCard key={client.id} client={client} onDeleteRequest={() => setClientToDelete(client)} />
          ))}
        </div>
      )}

      {!loading && !error && currentUser && filteredClients.length === 0 && (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold">
            {clients.length === 0 ? "No clients yet" : "No clients match your search"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {clients.length === 0 ? "Add your first client to get started." : "Try adjusting your search term."}
          </p>
          {clients.length === 0 && (
            <Button className="mt-6" asChild>
              <Link href="/dashboard/clients/new">Add Client</Link>
            </Button>
          )}
        </div>
      )}

      {clientToDelete && (
        <AlertDialog open={!!clientToDelete} onOpenChange={() => setClientToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the client "{clientToDelete.name}" and all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setClientToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDeleteClient(clientToDelete.id)}
                className="bg-destructive hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
