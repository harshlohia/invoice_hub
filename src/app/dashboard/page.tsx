
"use client";

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { IndianRupee, FileText, Users, AlertTriangle, CheckCircle2, TrendingUp, PieChart as PieChartIcon, BarChartHorizontalBig, ExternalLink, Loader2 } from "lucide-react";
import { db, getFirebaseAuthInstance } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import type { User as FirebaseAuthUser, Auth } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import type { Invoice, Client } from '@/lib/types';
import { format, startOfMonth, endOfMonth, subMonths, getMonth, getYear } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface DashboardStats {
  totalRevenue: number;
  invoicesCreatedCount: number;
  activeClientsCount: number;
  overdueInvoicesCount: number;
  overdueInvoicesAmount: number;
  momRevenueGrowth: number | null;
  averageInvoiceValue: number | null;
}

const initialDashboardStats: DashboardStats = {
  totalRevenue: 0,
  invoicesCreatedCount: 0,
  activeClientsCount: 0,
  overdueInvoicesCount: 0,
  overdueInvoicesAmount: 0,
  momRevenueGrowth: null,
  averageInvoiceValue: null,
};

interface MonthlyRevenueChartData {
  month: string;
  revenue: number;
}

interface InvoiceStatusChartData {
  name: string;
  value: number;
  fill: string;
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

const PIE_CHART_COLORS: Record<Invoice['status'], string> = {
  paid: "hsl(var(--chart-2))", 
  sent: "hsl(var(--chart-1))", 
  overdue: "hsl(var(--destructive))", 
  draft: "hsl(var(--muted-foreground))", 
  cancelled: "hsl(var(--chart-5))", 
};

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<FirebaseAuthUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [stats, setStats] = useState<DashboardStats>(initialDashboardStats);
  const [recentActivities, setRecentActivities] = useState<RecentActivityItem[]>([]);
  const [monthlyRevenueData, setMonthlyRevenueData] = useState<MonthlyRevenueChartData[]>([]);
  const [invoiceStatusData, setInvoiceStatusData] = useState<InvoiceStatusChartData[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("thisMonth");

  const calculateDateRange = useCallback((filter: DateFilterOption): { startDateTs: Timestamp | null, endDateTs: Timestamp | null } => {
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
        return { startDateTs: null, endDateTs: null };
    }
    return {
      startDateTs: startDate ? Timestamp.fromDate(startDate) : null,
      endDateTs: endDate ? Timestamp.fromDate(endDate) : null
    };
  }, []);

  const fetchDashboardData = useCallback(async (userId: string, currentFilter: DateFilterOption) => {
    setLoadingStats(true);
    setError(null);
    try {
      const { startDateTs, endDateTs } = calculateDateRange(currentFilter);

      const invoicesRef = collection(db, "invoices");
      let invoicesQuery = query(invoicesRef, where("userId", "==", userId));
      if (startDateTs) invoicesQuery = query(invoicesQuery, where("invoiceDate", ">=", startDateTs));
      if (endDateTs) invoicesQuery = query(invoicesQuery, where("invoiceDate", "<=", endDateTs));

      const invoiceDocsSnap = await getDocs(invoicesQuery);
      const fetchedInvoices = invoiceDocsSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          invoiceDate: data.invoiceDate instanceof Timestamp ? data.invoiceDate.toDate() : new Date(data.invoiceDate),
          dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate() : new Date(data.dueDate),
        } as Invoice;
      });

      let totalRevenue = 0;
      let paidInvoicesCount = 0;
      let invoicesCreatedCount = fetchedInvoices.length;
      let overdueInvoicesCount = 0;
      let overdueInvoicesAmount = 0;

      fetchedInvoices.forEach(inv => {
        if (inv.status === 'paid') {
          totalRevenue += inv.grandTotal;
          paidInvoicesCount++;
        }
        if (inv.status === 'overdue' || (inv.status !== 'paid' && inv.status !== 'cancelled' && inv.dueDate < new Date())) {
          overdueInvoicesCount++;
          overdueInvoicesAmount += inv.grandTotal;
        }
      });
      
      const averageInvoiceValue = paidInvoicesCount > 0 ? totalRevenue / paidInvoicesCount : 0;

      const clientsRef = collection(db, "clients");
      const clientsQuery = query(clientsRef, where("userId", "==", userId));
      const clientsDocsSnap = await getDocs(clientsQuery);
      const activeClientsCount = clientsDocsSnap.size;

      setStats(prevStats => ({
        ...prevStats,
        totalRevenue,
        invoicesCreatedCount,
        activeClientsCount,
        overdueInvoicesCount,
        overdueInvoicesAmount,
        averageInvoiceValue,
      }));

    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
      setError("Failed to load dashboard statistics.");
      setStats(initialDashboardStats); // Reset to initial on error
    } finally {
      setLoadingStats(false);
    }
  }, [calculateDateRange]);

  const fetchChartAndAdvancedAnalytics = useCallback(async (userId: string) => {
    setLoadingCharts(true);
    try {
      const sevenMonthsAgo = startOfMonth(subMonths(new Date(), 6)); 
      const invoicesRef = collection(db, "invoices");
      const chartInvoicesQuery = query(
        invoicesRef,
        where("userId", "==", userId),
        where("invoiceDate", ">=", Timestamp.fromDate(sevenMonthsAgo)),
        orderBy("invoiceDate", "asc")
      );
      const chartInvoiceDocsSnap = await getDocs(chartInvoicesQuery);
      const chartFetchedInvoices = chartInvoiceDocsSnap.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          ...data,
          id: docSnap.id,
          invoiceDate: data.invoiceDate instanceof Timestamp ? data.invoiceDate.toDate() : new Date(data.invoiceDate),
        } as Invoice;
      });

      const monthlyRevenue: { [key: string]: number } = {};
      for (let i = 0; i < 7; i++) { 
        const monthDate = startOfMonth(subMonths(new Date(), i));
        const monthKey = format(monthDate, "MMM yyyy");
        monthlyRevenue[monthKey] = 0;
      }

      chartFetchedInvoices.forEach(inv => {
        if (inv.status === 'paid') {
          const monthKey = format(inv.invoiceDate, "MMM yyyy");
          if (monthlyRevenue[monthKey] !== undefined) {
            monthlyRevenue[monthKey] += inv.grandTotal;
          }
        }
      });
      
      const processedMonthlyRevenueData = Object.entries(monthlyRevenue)
        .map(([month, revenue]) => ({ month, revenue }))
        .sort((a,b) => new Date(a.month).getTime() - new Date(b.month).getTime()) 
        .slice(-6); 
      setMonthlyRevenueData(processedMonthlyRevenueData);

      let momRevenueGrowth: number | null = null;
      if (processedMonthlyRevenueData.length >= 2) {
        const currentMonthRevenue = processedMonthlyRevenueData[processedMonthlyRevenueData.length - 1].revenue;
        const previousMonthRevenue = processedMonthlyRevenueData[processedMonthlyRevenueData.length - 2].revenue;
        if (previousMonthRevenue > 0) {
          momRevenueGrowth = ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100;
        } else if (currentMonthRevenue > 0) {
          momRevenueGrowth = 100; 
        }
      }
      setStats(prevStats => ({
        ...prevStats,
        momRevenueGrowth
      }));


      const allInvoicesQuery = query(invoicesRef, where("userId", "==", userId));
      const allInvoiceDocsSnap = await getDocs(allInvoicesQuery);
      const allFetchedInvoices = allInvoiceDocsSnap.docs.map(docSnap => docSnap.data() as Invoice);

      const statusCounts: Record<Invoice['status'], number> = {
        draft: 0, sent: 0, paid: 0, overdue: 0, cancelled: 0,
      };
      allFetchedInvoices.forEach(inv => {
        statusCounts[inv.status]++;
      });
      const processedInvoiceStatusData = (Object.keys(statusCounts) as Array<Invoice['status']>)
        .map(status => ({
          name: status.charAt(0).toUpperCase() + status.slice(1),
          value: statusCounts[status],
          fill: PIE_CHART_COLORS[status],
        }))
        .filter(item => item.value > 0); 
      setInvoiceStatusData(processedInvoiceStatusData);

    } catch (err) {
      console.error("Error fetching chart analytics:", err);
      setError(prev => prev ? prev + " Failed to load chart data." : "Failed to load chart data.");
    } finally {
      setLoadingCharts(false);
    }
  }, []);

  const fetchRecentActivities = useCallback(async (userId: string) => {
    setLoadingActivities(true);
    try {
      const activities: RecentActivityItem[] = [];
      const recentInvoicesQuery = query(collection(db, "invoices"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(3));
      const recentInvoicesSnap = await getDocs(recentInvoicesQuery);
      recentInvoicesSnap.forEach(doc => {
        const invoice = { id: doc.id, ...doc.data() } as Invoice;
        const createdAt = invoice.createdAt instanceof Timestamp ? invoice.createdAt.toDate() : new Date(invoice.createdAt || Date.now());
        activities.push({
          id: invoice.id!, type: 'invoice', action: `Invoice #${invoice.invoiceNumber} to ${invoice.client.name}`,
          time: format(createdAt, "PPp"), timestamp: createdAt, icon: FileText, link: `/dashboard/invoices/${invoice.id}`
        });
      });

      const recentClientsQuery = query(collection(db, "clients"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(2));
      const recentClientsSnap = await getDocs(recentClientsQuery);
      recentClientsSnap.forEach(doc => {
        const client = { id: doc.id, ...doc.data() } as Client & { createdAt?: Timestamp | Date };
        const createdAt = client.createdAt instanceof Timestamp ? client.createdAt.toDate() : new Date(client.createdAt || Date.now());
        activities.push({
          id: client.id!, type: 'client', action: `Client '${client.name}' added.`,
          time: format(createdAt, "PPp"), timestamp: createdAt, icon: Users, link: `/dashboard/clients/${client.id}/edit`
        });
      });
      
      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setRecentActivities(activities.slice(0, 4));
    } catch (err) {
      console.error("Error fetching recent activities:", err);
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
      setLoadingStats(true); 
      setLoadingActivities(true); 
      setLoadingCharts(true);
      setError(null);
      setStats(initialDashboardStats); // Reset stats before fetching

      fetchDashboardData(currentUser.uid, dateFilter);
      fetchRecentActivities(currentUser.uid);
      fetchChartAndAdvancedAnalytics(currentUser.uid);
    } else if (!loadingAuth) {
      setStats(initialDashboardStats); 
      setRecentActivities([]); 
      setMonthlyRevenueData([]); 
      setInvoiceStatusData([]);
      setLoadingStats(false); 
      setLoadingActivities(false); 
      setLoadingCharts(false);
    }
  }, [currentUser, dateFilter, fetchDashboardData, fetchRecentActivities, fetchChartAndAdvancedAnalytics, loadingAuth]);

  const dateFilterLabel = dateFilter === "thisMonth" ? "MTD" : dateFilter === "lastMonth" ? "Last Month" : "All Time";
  const statCards = [
    { title: `Total Revenue (${dateFilterLabel})`, value: `Rs. ${stats.totalRevenue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, icon: IndianRupee, color: "text-green-500", description: "" },
    { title: `Invoices Created (${dateFilterLabel})`, value: stats.invoicesCreatedCount.toString(), icon: FileText, color: "text-blue-500", description: "" },
    { title: "Total Active Clients", value: stats.activeClientsCount.toString(), icon: Users, color: "text-purple-500", description: "" },
    { title: `Overdue Invoices (${dateFilterLabel})`, value: `${stats.overdueInvoicesCount} (Rs. ${stats.overdueInvoicesAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})})`, icon: AlertTriangle, color: "text-red-500", description: stats.overdueInvoicesCount > 0 ? "Action required" : "No overdue invoices" },
    { title: "MoM Revenue Growth", value: stats.momRevenueGrowth !== null ? `${stats.momRevenueGrowth.toFixed(1)}%` : "N/A", icon: TrendingUp, color: stats.momRevenueGrowth !== null && stats.momRevenueGrowth >= 0 ? "text-green-500" : "text-red-500", description: "Prev. full month" },
    { title: `Avg. Invoice Value (${dateFilterLabel})`, value: `Rs. ${stats.averageInvoiceValue !== null ? stats.averageInvoiceValue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'}`, icon: BarChartHorizontalBig, color: "text-indigo-500", description: "Based on paid invoices" },
  ];

  const revenueChartConfig = {
    revenue: { label: "Revenue (Rs.)", color: "hsl(var(--chart-1))" },
  };
  const statusChartConfig = invoiceStatusData.reduce((acc, item) => {
    acc[item.name.toLowerCase()] = { label: item.name, color: item.fill };
    return acc;
  }, {} as any);

  const hasMeaningfulStats = stats.invoicesCreatedCount > 0 || stats.totalRevenue > 0 || stats.activeClientsCount > 0 || stats.momRevenueGrowth !== null || stats.averageInvoiceValue !== null;

  if (loadingAuth) { 
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center"> <Skeleton className="h-10 w-1/3" /> <Skeleton className="h-10 w-1/4" /> </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"> {[...Array(6)].map((_, i) => ( <Card key={i}><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2 mb-2" /><Skeleton className="h-4 w-full" /></CardContent></Card> ))} </div>
        <div className="grid gap-6 lg:grid-cols-5"> <Card className="lg:col-span-3"><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card> <Card className="lg:col-span-2"><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card> </div>
      </div>
    );
  }
  if (!currentUser && !loadingAuth) { 
    return (
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold">Not Logged In</h3>
          <p className="mt-1 text-sm text-muted-foreground">Please log in to view your dashboard.</p>
          <Button asChild className="mt-4"><Link href="/login">Log In</Link></Button>
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
        <div className="flex items-center gap-4 w-full md:w-auto">
            <Select value={dateFilter} onValueChange={(value: DateFilterOption) => setDateFilter(value)} disabled={loadingStats || !currentUser}>
                <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Filter by date" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="thisMonth">This Month</SelectItem>
                    <SelectItem value="lastMonth">Last Month</SelectItem>
                    <SelectItem value="allTime">All Time</SelectItem>
                </SelectContent>
            </Select>
            <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground w-full md:w-auto" disabled={!currentUser}>
                <Link href="/dashboard/invoices/new">Create Invoice</Link>
            </Button>
        </div>
      </div>

      {loadingStats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[...Array(6)].map((_, i) => (
             <Card key={i}><CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2 mb-2" /><Skeleton className="h-4 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : error && !loadingAuth ? (
         <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <h3 className="mt-2 text-xl font-semibold">Error Loading Statistics</h3>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => currentUser && fetchDashboardData(currentUser.uid, dateFilter)} className="mt-4">Retry</Button>
        </div>
      ) : hasMeaningfulStats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
        <p className="text-muted-foreground py-4 text-center">No statistics available for the selected period. Start by creating some invoices!</p>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3 hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="font-headline">Monthly Revenue (Last 6 Months)</CardTitle>
            <CardDescription>Track your paid invoice revenue over time.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCharts ? (
              <div className="h-[300px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Loading chart...</p></div>
            ) : monthlyRevenueData.length > 0 ? (
              <ChartContainer config={revenueChartConfig} className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyRevenueData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis 
                      tickFormatter={(value) => `Rs. ${value/1000}k`} 
                      tickLine={false} 
                      axisLine={false} 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12}
                    />
                    <RechartsTooltip
                      content={<ChartTooltipContent indicator="dot" hideLabel />}
                      cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "3 3" }}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth:0 }} activeDot={{r:6}} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground h-[300px] flex items-center justify-center">No revenue data to display for the period.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="font-headline">Invoice Status Overview</CardTitle>
            <CardDescription>Current breakdown of all your invoices.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center items-center">
            {loadingCharts ? (
               <div className="h-[300px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Loading chart...</p></div>
            ) : invoiceStatusData.length > 0 ? (
              <ChartContainer config={statusChartConfig} className="h-[300px] w-full max-w-xs aspect-square">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <RechartsTooltip content={<ChartTooltipContent nameKey="name" hideIndicator />} />
                      <Pie data={invoiceStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                        {invoiceStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                       <RechartsLegend content={<ChartLegendContent />} />
                    </PieChart>
                 </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground h-[300px] flex items-center justify-center">No invoice status data available.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="font-headline">Recent Activity</CardTitle>
            <CardDescription>Latest invoices and client additions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingActivities ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="flex items-start gap-3"> <Skeleton className="h-5 w-5 mt-1 rounded-full" /> <div className="w-full"> <Skeleton className="h-4 w-3/4 mb-1" /> <Skeleton className="h-3 w-1/2" /> </div> </div>
              ))
            ) : recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <div key={activity.id + activity.type} className="flex items-start gap-3">
                  <activity.icon className={`h-5 w-5 mt-1 ${activity.color || 'text-primary'}`} />
                  <div> <p className="text-sm font-medium">{activity.action}</p> <p className="text-xs text-muted-foreground">{activity.time}</p> </div>
                  {activity.link && ( <Link href={activity.link} className="ml-auto text-primary hover:underline"> <ExternalLink className="h-4 w-4"/> </Link> )}
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

    