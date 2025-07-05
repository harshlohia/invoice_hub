
"use client";

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InvoiceCard } from '@/components/InvoiceCard';
import type { Invoice } from '@/lib/types'; 
import { PlusCircle, Search, Filter, Loader2, AlertTriangle, FileText, CalendarDays, ChevronDown, CheckCircle } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, Timestamp, limit, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db, getFirebaseAuthInstance } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { onAuthStateChanged, type User, type Auth } from 'firebase/auth';
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';

type DateRangeKey = "all" | "currentMonth" | "lastMonth" | "last3Months" | "thisYear";

const INVOICES_PER_PAGE = 10;

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeKey>("all");
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const { toast } = useToast();

  const buildQuery = useCallback((userId: string, currentDateRangeFilter: DateRangeKey, lastDocument?: QueryDocumentSnapshot<DocumentData> | null) => {
    const invoicesRef = collection(db, "invoices");
    let q = query(invoicesRef, where("userId", "==", userId));

    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    switch (currentDateRangeFilter) {
      case "currentMonth":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case "lastMonth":
        startDate = startOfMonth(subMonths(now, 1));
        endDate = endOfMonth(subMonths(now, 1));
        break;
      case "last3Months":
        startDate = startOfMonth(subMonths(now, 2)); 
        endDate = endOfMonth(now);
        break;
      case "thisYear":
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      case "all":
      default:
        break;
    }

    if (startDate) {
      q = query(q, where("invoiceDate", ">=", Timestamp.fromDate(startDate)));
    }
    if (endDate) {
      q = query(q, where("invoiceDate", "<=", Timestamp.fromDate(endDate)));
    }
    
    q = query(q, orderBy("invoiceDate", "desc"), limit(INVOICES_PER_PAGE));
    
    if (lastDocument) {
      q = query(q, startAfter(lastDocument));
    }
    
    return q;
  }, []);

  const fetchInvoices = useCallback(async (userId: string, currentDateRangeFilter: DateRangeKey, isLoadMore = false, currentLastDoc?: QueryDocumentSnapshot<DocumentData> | null) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setInvoices([]);
      setLastDoc(null);
      setHasMore(true);
    }
    setError(null);
    
    try {
      const q = buildQuery(userId, currentDateRangeFilter, isLoadMore ? currentLastDoc : null);
      const querySnapshot = await getDocs(q);
      
      const invoicesData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          invoiceDate: data.invoiceDate instanceof Timestamp ? data.invoiceDate.toDate() : new Date(data.invoiceDate),
          dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate() : new Date(data.dueDate),
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt ? new Date(data.createdAt) : undefined,
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt ? new Date(data.updatedAt) : undefined,
        } as Invoice;
      });
      
      if (isLoadMore) {
        setInvoices(prev => [...prev, ...invoicesData]);
      } else {
        setInvoices(invoicesData);
      }
      
      // Update pagination state
      const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastDoc(lastVisible || null);
      setHasMore(querySnapshot.docs.length === INVOICES_PER_PAGE);
      
    } catch (err) {
      console.error("Detailed error fetching invoices:", err);
      setError("Failed to load invoices. Please try again. Check the browser console for more details.");
      toast({ title: "Error", description: "Could not fetch invoices. Check console.", variant: "destructive" });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [toast, buildQuery]);

  const loadMoreInvoices = useCallback(() => {
    if (currentUser && hasMore && !loadingMore) {
      fetchInvoices(currentUser.uid, dateRangeFilter, true, lastDoc);
    }
  }, [currentUser, hasMore, loadingMore, fetchInvoices, dateRangeFilter, lastDoc]);

  useEffect(() => {
    const authInstance: Auth = getFirebaseAuthInstance();
    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
      setCurrentUser(user);
      if (user) {
        fetchInvoices(user.uid, dateRangeFilter);
      } else {
        setLoading(false);
        setInvoices([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchInvoices(currentUser.uid, dateRangeFilter);
    }
  }, [dateRangeFilter, currentUser, fetchInvoices]);
  
  const handleInvoiceStatusUpdate = (invoiceId: string, newStatus: Invoice['status']) => {
    setInvoices(prevInvoices =>
      prevInvoices.map(inv =>
        inv.id === invoiceId ? { ...inv, status: newStatus, updatedAt: Timestamp.now() } : inv
      )
    );
    // Optional: Re-apply client-side filters if necessary, though usually not needed just for status change
    // unless statusFilter itself is active and the change moves it in/out of the current filter.
    // The filteredInvoices computed value will handle this automatically.
  };

  const filteredInvoices = invoices.filter(invoice => {
    const searchTermMatch = 
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.client.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const statusMatch = statusFilter === "all" || invoice.status === statusFilter;
    
    return searchTermMatch && statusMatch;
  });

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    // No need to re-fetch from Firestore if only client-side status filter changes.
    // Firestore fetching is based on userId and dateRange.
  };

  const handleDateRangeFilterChange = (value: DateRangeKey) => {
    setDateRangeFilter(value);
    if (currentUser) {
      fetchInvoices(currentUser.uid, value); // Refetch when date range changes
    }
  };

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
        <Select value={dateRangeFilter} onValueChange={handleDateRangeFilterChange}>
          <SelectTrigger className="w-full md:w-[180px]">
            <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Filter by date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="currentMonth">Current Month</SelectItem>
            <SelectItem value="lastMonth">Last Month</SelectItem>
            <SelectItem value="last3Months">Last 3 Months</SelectItem>
            <SelectItem value="thisYear">This Year</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
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
           <Button onClick={() => currentUser && fetchInvoices(currentUser.uid, dateRangeFilter)} className="mt-4">Retry</Button>
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
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredInvoices.map((invoice) => (
              <InvoiceCard key={invoice.id} invoice={invoice} onStatusUpdate={handleInvoiceStatusUpdate} />
            ))}
          </div>
          
          {/* Load More Section */}
           {hasMore && searchTerm === "" && statusFilter === "all" && (
             <div className="flex flex-col items-center pt-8 space-y-4">
               <Button 
                 onClick={loadMoreInvoices}
                 disabled={loadingMore}
                 variant="outline"
                 size="lg"
                 className="min-w-[200px] h-12 text-base font-medium border-2 hover:bg-accent/50 hover:border-accent transition-all duration-200 shadow-sm hover:shadow-md"
               >
                 {loadingMore ? (
                   <>
                     <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                     Loading more...
                   </>
                 ) : (
                   <>
                     <ChevronDown className="mr-2 h-5 w-5" />
                     Load More Invoices
                   </>
                 )}
               </Button>
               
               {/* Loading skeleton for new invoices */}
               {loadingMore && (
                 <div className="w-full grid gap-6 md:grid-cols-2 lg:grid-cols-3 opacity-50">
                   {Array.from({ length: 3 }).map((_, index) => (
                     <div key={`skeleton-${index}`} className="animate-pulse">
                       <div className="bg-muted rounded-lg h-48 w-full"></div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
           )}
          
          {/* Pagination Info */}
          {searchTerm === "" && statusFilter === "all" && (
            <div className="text-center text-sm text-muted-foreground pt-4">
              {!hasMore && invoices.length > 0 && (
                <p className="flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  All invoices loaded ({invoices.length} total)
                </p>
              )}
              {hasMore && invoices.length > 0 && (
                <p>Showing {invoices.length} invoices • More available</p>
              )}
            </div>
          )}
        </>
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
