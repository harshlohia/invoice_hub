
"use client";

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { IndianRupee, FileText, Users, AlertTriangle, CheckCircle2, Clock, Loader2, ExternalLink } from "lucide-react";
import { db, getFirebaseAuthInstance } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import type { User as FirebaseAuthUser, Auth } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import type { Invoice, Client } from '@/lib/types';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardStats {
  totalRevenue: number;
  invoicesCreatedCount: number;
  activeClientsCount: number;
  overdueInvoicesCount: number;
  overdueInvoicesAmount: number;
}

interface RecentActivityItem {
  id: string;
  type: 'invoice' | 'client';
  action: string;
  time: string;
  timestamp: Date;
  icon: React.ElementType;
  color?: string;
  link?: string;
}

type DateFilterOption = "thisMonth" | "lastMonth" | "allTime";

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<FirebaseAuthUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<RecentActivityItem[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("thisMonth");

  const calculateDateRange = useCallback((filter: DateFilterOption): { startDate: Timestamp | null, endDate: Timestamp | null } => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    switch (filter) {
      case "thisMonth":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case "lastMonth":
        startDate = startOfMonth(subMonths(now, 1));
        endDate = endOfMonth(subMonths(now, 1));
        break;
      case "allTime":
      default:
        return { startDate: null, endDate: null };
    }
    return { 
      startDate: startDate ? Timestamp.fromDate(startDate) : null, 
      endDate: endDate ? Timestamp.fromDate(endDate) : null 
    };
  }, []);

  const fetchDashboardData = useCallback(async (userId: string, currentFilter: DateFilterOption) => {
    setLoadingStats(true);
    setError(null);
    try {
      const { startDate, endDate } = calculateDateRange(currentFilter);
      
      // Fetch Invoices for stats
      const invoicesRef = collection(db, "invoices");
      let invoicesQuery = query(invoicesRef, where("userId", "==", userId));
      if (startDate) invoicesQuery = query(invoicesQuery, where("invoiceDate", ">=", startDate));
      if (endDate) invoicesQuery = query(invoicesQuery, where("invoiceDate", "<=", endDate));
      
      const invoiceDocsSnap = await getDocs(invoicesQuery);
      const fetchedInvoices = invoiceDocsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));

      let totalRevenue = 0;
      let invoicesCreatedCount = fetchedInvoices.length;
      let overdueInvoicesCount = 0;
      let overdueInvoicesAmount = 0;

      fetchedInvoices.forEach(inv => {
        if (inv.status === 'paid') {
          totalRevenue += inv.grandTotal;
        }
        const invDueDate = inv.dueDate instanceof Timestamp ? inv.dueDate.toDate() : new Date(inv.dueDate);
        if (inv.status === 'overdue' || (inv.status !== 'paid' && inv.status !== 'cancelled' && invDueDate < new Date())) {
          overdueInvoicesCount++;
          overdueInvoicesAmount += inv.grandTotal;
        }
      });

      // Fetch Clients for count
      const clientsRef = collection(db, "clients");
      const clientsQuery = query(clientsRef, where("userId", "==", userId));
      const clientsDocsSnap = await getDocs(clientsQuery);
      const activeClientsCount = clientsDocsSnap.size;

      setStats({
        totalRevenue,
        invoicesCreatedCount,
        activeClientsCount,
        overdueInvoicesCount,
        overdueInvoicesAmount,
      });

    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
      setError("Failed to load dashboard statistics.");
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, [calculateDateRange]);

  const fetchRecentActivities = useCallback(async (userId: string) => {
    setLoadingActivities(true);
    try {
      const activities: RecentActivityItem[] = [];

      // Recent Invoices
      const recentInvoicesQuery = query(
        collection(db, "invoices"), 
        where("userId", "==", userId), 
        orderBy("createdAt", "desc"), 
        limit(3)
      );
      const recentInvoicesSnap = await getDocs(recentInvoicesQuery);
      recentInvoicesSnap.forEach(doc => {
        const invoice = { id: doc.id, ...doc.data() } as Invoice;
        const createdAt = invoice.createdAt instanceof Timestamp ? invoice.createdAt.toDate() : new Date();
        activities.push({
          id: invoice.id!,
          type: 'invoice',
          action: `Invoice #${invoice.invoiceNumber} created for ${invoice.client.name}`,
          time: format(createdAt, "PPp"),
          timestamp: createdAt,
          icon: FileText,
          link: `/dashboard/invoices/${invoice.id}`
        });
      });

      // Recent Clients
      // Assuming clients have a 'createdAt' field (added in ClientForm changes)
      const recentClientsQuery = query(
        collection(db, "clients"), 
        where("userId", "==", userId), 
        orderBy("createdAt", "desc"), 
        limit(2)
      );
      const recentClientsSnap = await getDocs(recentClientsQuery);
      recentClientsSnap.forEach(doc => {
        const client = { id: doc.id, ...doc.data() } as Client & { createdAt?: Timestamp };
        const createdAt = client.createdAt instanceof Timestamp ? client.createdAt.toDate() : new Date();
        activities.push({
          id: client.id!,
          type: 'client',
          action: `Client '${client.name}' added.`,
          time: format(createdAt, "PPp"),
          timestamp: createdAt,
          icon: Users,
          link: `/dashboard/clients/${client.id}/edit`
        });
      });
      
      // Sort all activities by timestamp descending
      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setRecentActivities(activities.slice(0, 4)); // Show top 4 overall recent activities

    } catch (err) {
      console.error("Error fetching recent activities:", err);
      // setError("Failed to load recent activities."); // Keep main error for stats
    } finally {
      setLoadingActivities(false);
    }
  }, []);
  
  useEffect(() => {
    const authInstance: Auth = getFirebaseAuthInstance();
    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
      setCurrentUser(user);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchDashboardData(currentUser.uid, dateFilter);
      fetchRecentActivities(currentUser.uid);
    } else if (!loadingAuth) {
      // User is logged out, reset data
      setStats(null);
      setRecentActivities([]);
      setLoadingStats(false);
      setLoadingActivities(false);
    }
  }, [currentUser, dateFilter, fetchDashboardData, fetchRecentActivities, loadingAuth]);

  const statCards = [
    { title: `Total Revenue (${dateFilter === "thisMonth" ? "MTD" : dateFilter === "lastMonth" ? "Last Month" : "All Time"})`, value: `Rs. ${stats?.totalRevenue.toLocaleString('en-IN') || '0'}`, icon: IndianRupee, color: "text-green-500", description: stats?.totalRevenue ? "" : "No paid invoices yet" },
    { title: `Invoices Created (${dateFilter === "thisMonth" ? "MTD" : dateFilter === "lastMonth" ? "Last Month" : "All Time"})`, value: stats?.invoicesCreatedCount.toString() || '0', icon: FileText, color: "text-blue-500", description: "" },
    { title: "Total Active Clients", value: stats?.activeClientsCount.toString() || '0', icon: Users, color: "text-purple-500", description: "" },
    { title: `Overdue Invoices (${dateFilter === "thisMonth" ? "MTD" : dateFilter === "lastMonth" ? "Last Month" : "All Time"})`, value: `${stats?.overdueInvoicesCount || '0'} (Rs. ${stats?.overdueInvoicesAmount.toLocaleString('en-IN') || '0'})`, icon: AlertTriangle, color: "text-red-500", description: stats?.overdueInvoicesCount ? "Action required" : "No overdue invoices" },
  ];


  if (loadingAuth) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-12 w-1/2" /> 
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="text-center py-12">
        <Users className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-2 text-xl font-semibold">Please Log In</h3>
        <p className="mt-1 text-sm text-muted-foreground">Log in to view your dashboard.</p>
        <Button asChild className="mt-4"><Link href="/login">Log In</Link></Button>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h3 className="mt-2 text-xl font-semibold">Error Loading Dashboard</h3>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button onClick={() => currentUser && fetchDashboardData(currentUser.uid, dateFilter)} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's an overview of your business.</p>
        </div>
        <div className="flex items-center gap-4">
            <Select value={dateFilter} onValueChange={(value: DateFilterOption) => setDateFilter(value)}>
                <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Filter by date" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="thisMonth">This Month</SelectItem>
                    <SelectItem value="lastMonth">Last Month</SelectItem>
                    <SelectItem value="allTime">All Time</SelectItem>
                </SelectContent>
            </Select>
            <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Link href="/dashboard/invoices/new">Create New Invoice</Link>
            </Button>
        </div>
      </div>

      {loadingStats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
             <Card key={i}><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2 mb-2" /><Skeleton className="h-4 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.title} className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color || 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No statistics available for the selected period.</p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="font-headline">Recent Activity</CardTitle>
            <CardDescription>Latest invoices and client additions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingActivities ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-5 w-5 mt-1 rounded-full" />
                  <div className="w-full">
                    <Skeleton className="h-4 w-3/4 mb-1" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))
            ) : recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <div key={activity.id + activity.type} className="flex items-start gap-3">
                  <activity.icon className={`h-5 w-5 mt-1 ${activity.color || 'text-primary'}`} />
                  <div>
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                  {activity.link && (
                    <Link href={activity.link} className="ml-auto text-primary hover:underline">
                        <ExternalLink className="h-4 w-4"/>
                    </Link>
                  )}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No recent activity found.</p>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="font-headline">Quick Actions</CardTitle>
            <CardDescription>Get things done faster.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Button variant="outline" asChild><Link href="/dashboard/invoices">View All Invoices</Link></Button>
            <Button variant="outline" asChild><Link href="/dashboard/clients">Manage Clients</Link></Button>
            <Button variant="outline" asChild><Link href="/dashboard/reports" className="disabled opacity-50 cursor-not-allowed">View Reports</Link></Button>
            <Button variant="outline" asChild><Link href="/dashboard/settings">Account Settings</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
    