
"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InvoiceCard } from '@/components/InvoiceCard';
import type { Invoice } from '@/lib/types'; 
import { PlusCircle, Search, Filter, Loader2, AlertTriangle, FileText } from 'lucide-react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { onAuthStateChanged, type User } from 'firebase/auth';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        fetchInvoices(user.uid);
      } else {
        setLoading(false);
        setInvoices([]);
        // Optionally redirect to login or show a message
      }
    });
    return () => unsubscribe();
  }, [toast]);

  const fetchInvoices = async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const invoicesRef = collection(db, "invoices");
      // Query invoices for the current user, ordered by invoiceDate descending
      const q = query(invoicesRef, where("userId", "==", userId), orderBy("invoiceDate", "desc"));
      const querySnapshot = await getDocs(q);
      const invoicesData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          // Ensure dates are JS Date objects if they are Firestore Timestamps
          invoiceDate: data.invoiceDate.toDate ? data.invoiceDate.toDate() : new Date(data.invoiceDate),
          dueDate: data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate),
        } as Invoice;
      });
      setInvoices(invoicesData);
    } catch (err) {
      console.error("Error fetching invoices:", err);
      setError("Failed to load invoices. Please try again.");
      toast({ title: "Error", description: "Could not fetch invoices.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  
  const filteredInvoices = invoices.filter(invoice => {
    const searchTermMatch = 
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.client.name.toLowerCase().includes(searchTerm.toLowerCase());
    const statusMatch = statusFilter === "all" || invoice.status === statusFilter;
    return searchTermMatch && statusMatch;
  });


  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">Manage all your business invoices here.</p>
        </div>
        <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Link href="/dashboard/invoices/new">
            <PlusCircle className="mr-2 h-5 w-5" /> Create New Invoice
          </Link>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 p-4 border rounded-lg bg-card shadow">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Search by invoice #, client name..." 
            className="pl-10 w-full" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        {/* <Button variant="outline" className="w-full md:w-auto">Apply Filters</Button> */}
      </div>

      {loading && (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-lg text-muted-foreground">Loading invoices...</p>
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <h3 className="mt-2 text-xl font-semibold">Error Loading Invoices</h3>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
           <Button onClick={() => currentUser && fetchInvoices(currentUser.uid)} className="mt-4">Retry</Button>
        </div>
      )}
      
      {!currentUser && !loading && (
         <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold">Not Logged In</h3>
          <p className="mt-1 text-sm text-muted-foreground">Please log in to view your invoices.</p>
          <Button asChild className="mt-4"><Link href="/login">Log In</Link></Button>
        </div>
      )}

      {!loading && !error && currentUser && filteredInvoices.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredInvoices.map((invoice) => (
            <InvoiceCard key={invoice.id} invoice={invoice} />
          ))}
        </div>
      )}
      
      {!loading && !error && currentUser && filteredInvoices.length === 0 && (
         <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold">
             {invoices.length === 0 ? "No invoices yet" : "No invoices match your filters"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {invoices.length === 0 ? "Get started by creating your first invoice." : "Try adjusting your search or filter."}
          </p>
          {invoices.length === 0 && (
          <Button className="mt-6" asChild>
            <Link href="/dashboard/invoices/new">Create Invoice</Link>
          </Button>
          )}
        </div>
      )}
    </div>
  );
}
