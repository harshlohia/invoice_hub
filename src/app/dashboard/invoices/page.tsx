
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

  const handleInvoiceDelete = (invoiceId: string) => {
    setInvoices(prevInvoices =>
      prevInvoices.filter(inv => inv.id !== invoiceId)
    );
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

  // Calculate statistics for the header
  const totalInvoices = invoices.length;
  const totalAmount = invoices.reduce((sum, invoice) => sum + invoice.grandTotal, 0);
  const paidInvoices = invoices.filter(inv => inv.status === 'paid').length;
  const pendingInvoices = invoices.filter(inv => inv.status === 'sent' || inv.status === 'overdue').length;
  const currencySymbol = invoices.length > 0 ? (invoices[0].currency === 'USD' ? '$' : invoices[0].currency === 'EUR' ? '€' : 'Rs.') : 'Rs.';

  return (
    <div className="space-y-8">
      {/* Modern Header Section */}
      <div className="relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-indigo-50/30 to-purple-50/50 dark:from-blue-950/20 dark:via-indigo-950/10 dark:to-purple-950/20 rounded-2xl" />
        
        <div className="relative p-8">
          {/* Header Content */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-headline font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                    Invoices
                  </h1>
                  <p className="text-lg text-muted-foreground font-medium">Manage and track your business invoices</p>
                </div>
              </div>
            </div>
            
            <Button 
              asChild 
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 px-6 py-3 text-base font-semibold"
            >
              <Link href="/dashboard/invoices/new">
                <PlusCircle className="mr-2 h-5 w-5" /> 
                Create Invoice
              </Link>
            </Button>
          </div>

          {/* Statistics Cards */}
          {!loading && currentUser && invoices.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 border border-white/20 dark:border-gray-700/20 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Invoices</p>
                    <p className="text-2xl font-bold text-foreground">{totalInvoices}</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </div>
              
              <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 border border-white/20 dark:border-gray-700/20 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                    <p className="text-2xl font-bold text-foreground">{currencySymbol}{totalAmount.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </div>
              
              <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 border border-white/20 dark:border-gray-700/20 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Paid</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{paidInvoices}</p>
                  </div>
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </div>
              
              <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 border border-white/20 dark:border-gray-700/20 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{pendingInvoices}</p>
                  </div>
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Search and Filter Section */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-700/20 shadow-sm">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                  placeholder="Search invoices by number, client name..." 
                  className="pl-12 h-12 text-base bg-white/50 dark:bg-gray-900/50 border-gray-200/50 dark:border-gray-700/50 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              {/* Date Range Filter */}
              <Select value={dateRangeFilter} onValueChange={handleDateRangeFilterChange}>
                <SelectTrigger className="w-full lg:w-[200px] h-12 bg-white/50 dark:bg-gray-900/50 border-gray-200/50 dark:border-gray-700/50 focus:border-blue-500 focus:ring-blue-500/20">
                  <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="currentMonth">Current Month</SelectItem>
                  <SelectItem value="lastMonth">Last Month</SelectItem>
                  <SelectItem value="last3Months">Last 3 Months</SelectItem>
                  <SelectItem value="thisYear">This Year</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="w-full lg:w-[180px] h-12 bg-white/50 dark:bg-gray-900/50 border-gray-200/50 dark:border-gray-700/50 focus:border-blue-500 focus:ring-blue-500/20">
                  <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>

                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Active Filters Display */}
            {(searchTerm || statusFilter !== 'all' || dateRangeFilter !== 'all') && (
              <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                <span className="text-sm font-medium text-muted-foreground">Active filters:</span>
                {searchTerm && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    Search: "{searchTerm}"
                  </span>
                )}
                {statusFilter !== 'all' && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                    Status: {statusFilter}
                  </span>
                )}
                {dateRangeFilter !== 'all' && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    Period: {dateRangeFilter.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
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
              <InvoiceCard key={invoice.id} invoice={invoice} onStatusUpdate={handleInvoiceStatusUpdate} onDelete={handleInvoiceDelete} />
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
