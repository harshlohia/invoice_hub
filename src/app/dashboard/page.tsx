
"use client";

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from 'next/link';
import { IndianRupee, FileText, Users, AlertTriangle, CheckCircle2, TrendingUp, PieChart as PieChartIcon, BarChartHorizontalBig, ExternalLink, Loader2, Quote, FileCheck, Send, Activity, Zap, ChevronRight, Settings } from "lucide-react";
import { db, getFirebaseAuthInstance } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import type { User as FirebaseAuthUser, Auth } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import type { Invoice, Client, Quotation } from '@/lib/types';
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
  totalSentAmountThisMonth: number;
  totalSentAmountForPeriod: number;
}

interface QuotationStats {
  totalQuotationValue: number;
  quotationsCreatedCount: number;
  acceptedQuotationsCount: number;
  pendingQuotationsCount: number;
  expiredQuotationsCount: number;
  conversionRate: number | null;
  averageQuotationValue: number | null;
}

const initialDashboardStats: DashboardStats = {
  totalRevenue: 0,
  invoicesCreatedCount: 0,
  activeClientsCount: 0,
  overdueInvoicesCount: 0,
  overdueInvoicesAmount: 0,
  momRevenueGrowth: null,
  totalSentAmountThisMonth: 0,
  totalSentAmountForPeriod: 0,
};

const initialQuotationStats: QuotationStats = {
  totalQuotationValue: 0,
  quotationsCreatedCount: 0,
  acceptedQuotationsCount: 0,
  pendingQuotationsCount: 0,
  expiredQuotationsCount: 0,
  conversionRate: null,
  averageQuotationValue: null,
};

interface MonthlyRevenueChartData {
  month: string;
  revenue: number;
}

interface MonthlyQuotationChartData {
  month: string;
  quotationValue: number;
}

interface InvoiceStatusChartData {
  name: string;
  value: number;
  fill: string;
}

interface QuotationStatusChartData {
  name: string;
  value: number;
  fill: string;
}

interface RecentActivityItem {
  id: string;
  type: 'invoice' | 'client' | 'quotation';
  action: string;
  time: string;
  timestamp: Date;
  icon: React.ElementType;
  color?: string;
  link?: string;
}

type DateFilterOption = "thisMonth" | "lastMonth" | "allTime";
type AnalyticsType = "invoices" | "quotations";

const PIE_CHART_COLORS: Record<Invoice['status'], string> = {
  paid: "hsl(var(--chart-2))", 
  sent: "hsl(var(--chart-1))", 
  overdue: "hsl(var(--destructive))", 
  draft: "hsl(var(--muted-foreground))", 
  cancelled: "hsl(var(--chart-5))", 
};

const QUOTATION_PIE_CHART_COLORS: Record<Quotation['status'], string> = {
  accepted: "hsl(var(--chart-2))",
  sent: "hsl(var(--chart-1))",
  declined: "hsl(var(--destructive))",
  draft: "hsl(var(--muted-foreground))",
  expired: "hsl(var(--chart-5))",
};

// Helper function for icon backgrounds
const getIconBackground = (index: number): string => {
  const backgrounds = [
    'from-blue-500 to-blue-600',
    'from-green-500 to-green-600', 
    'from-purple-500 to-purple-600',
    'from-orange-500 to-orange-600',
    'from-pink-500 to-pink-600',
    'from-indigo-500 to-indigo-600'
  ];
  return backgrounds[index % backgrounds.length];
};

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<FirebaseAuthUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [stats, setStats] = useState<DashboardStats>(initialDashboardStats);
  const [quotationStats, setQuotationStats] = useState<QuotationStats>(initialQuotationStats);
  const [recentActivities, setRecentActivities] = useState<RecentActivityItem[]>([]);
  const [monthlyRevenueData, setMonthlyRevenueData] = useState<MonthlyRevenueChartData[]>([]);
  const [monthlyQuotationData, setMonthlyQuotationData] = useState<MonthlyQuotationChartData[]>([]);
  const [invoiceStatusData, setInvoiceStatusData] = useState<InvoiceStatusChartData[]>([]);
  const [quotationStatusData, setQuotationStatusData] = useState<QuotationStatusChartData[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilterOption>("thisMonth");
  const [analyticsType, setAnalyticsType] = useState<AnalyticsType>("invoices");

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
      let totalSentAmountThisMonth = 0;
      let totalSentAmountForPeriod = 0;

      // Calculate total sent amount for this month only (for MTD card)
      const now = new Date();
      const thisMonthStart = startOfMonth(now);
      const thisMonthEnd = endOfMonth(now);

      fetchedInvoices.forEach(inv => {
        if (inv.status === 'paid') {
          totalRevenue += inv.grandTotal;
          paidInvoicesCount++;
        }
        if (inv.status === 'overdue' || (inv.status !== 'paid' && inv.status !== 'cancelled' && inv.dueDate < new Date())) {
          overdueInvoicesCount++;
          overdueInvoicesAmount += inv.grandTotal;
        }
        // Calculate sent invoices for this month specifically
        if (inv.status === 'sent' && inv.invoiceDate >= thisMonthStart && inv.invoiceDate <= thisMonthEnd) {
          totalSentAmountThisMonth += inv.grandTotal;
        }
        // Calculate sent invoices for the selected period
        if (inv.status === 'sent') {
          totalSentAmountForPeriod += inv.grandTotal;
        }
      });

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
        totalSentAmountThisMonth,
        totalSentAmountForPeriod,
      }));

    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
      setError("Failed to load dashboard statistics.");
      setStats(initialDashboardStats); // Reset to initial on error
    } finally {
      setLoadingStats(false);
    }
  }, [calculateDateRange]);

  const fetchQuotationData = useCallback(async (userId: string, currentFilter: DateFilterOption) => {
    setLoadingStats(true);
    setError(null);
    try {
      const { startDateTs, endDateTs } = calculateDateRange(currentFilter);

      const quotationsRef = collection(db, "quotations");
      let quotationsQuery = query(quotationsRef, where("userId", "==", userId));
      if (startDateTs) quotationsQuery = query(quotationsQuery, where("quotationDate", ">=", startDateTs));
      if (endDateTs) quotationsQuery = query(quotationsQuery, where("quotationDate", "<=", endDateTs));

      const quotationDocsSnap = await getDocs(quotationsQuery);
      const fetchedQuotations = quotationDocsSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          quotationDate: data.quotationDate instanceof Timestamp ? data.quotationDate.toDate() : new Date(data.quotationDate),
          validUntil: data.validUntil instanceof Timestamp ? data.validUntil.toDate() : new Date(data.validUntil),
        } as Quotation;
      });

      let totalQuotationValue = 0;
      let quotationsCreatedCount = fetchedQuotations.length;
      let acceptedQuotationsCount = 0;
      let pendingQuotationsCount = 0;
      let expiredQuotationsCount = 0;

      fetchedQuotations.forEach(quot => {
        totalQuotationValue += quot.grandTotal;
        if (quot.status === 'accepted') {
          acceptedQuotationsCount++;
        }
        if (quot.status === 'sent') {
          pendingQuotationsCount++;
        }
        if (quot.status === 'expired' || (quot.status !== 'accepted' && quot.status !== 'declined' && quot.validUntil < new Date())) {
          expiredQuotationsCount++;
        }
      });
      
      const averageQuotationValue = quotationsCreatedCount > 0 ? totalQuotationValue / quotationsCreatedCount : 0;
      const conversionRate = quotationsCreatedCount > 0 ? (acceptedQuotationsCount / quotationsCreatedCount) * 100 : 0;

      setQuotationStats({
        totalQuotationValue,
        quotationsCreatedCount,
        acceptedQuotationsCount,
        pendingQuotationsCount,
        expiredQuotationsCount,
        conversionRate,
        averageQuotationValue,
      });

    } catch (err) {
      console.error("Error fetching quotation stats:", err);
      setError("Failed to load quotation statistics.");
      setQuotationStats(initialQuotationStats);
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
          const monthKey = format(inv.invoiceDate instanceof Date ? inv.invoiceDate : inv.invoiceDate.toDate(), "MMM yyyy");
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

  const fetchQuotationChartAnalytics = useCallback(async (userId: string) => {
    setLoadingCharts(true);
    try {
      const sevenMonthsAgo = startOfMonth(subMonths(new Date(), 6)); 
      const quotationsRef = collection(db, "quotations");
      const chartQuotationsQuery = query(
        quotationsRef,
        where("userId", "==", userId),
        where("quotationDate", ">=", Timestamp.fromDate(sevenMonthsAgo)),
        orderBy("quotationDate", "asc")
      );
      const chartQuotationDocsSnap = await getDocs(chartQuotationsQuery);
      const chartFetchedQuotations = chartQuotationDocsSnap.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          ...data,
          id: docSnap.id,
          quotationDate: data.quotationDate instanceof Timestamp ? data.quotationDate.toDate() : new Date(data.quotationDate),
        } as Quotation;
      });

      const monthlyQuotationValue: { [key: string]: number } = {};
      for (let i = 0; i < 7; i++) { 
        const monthDate = startOfMonth(subMonths(new Date(), i));
        const monthKey = format(monthDate, "MMM yyyy");
        monthlyQuotationValue[monthKey] = 0;
      }

      chartFetchedQuotations.forEach(quot => {
        const monthKey = format(quot.quotationDate instanceof Date ? quot.quotationDate : quot.quotationDate.toDate(), "MMM yyyy");
        if (monthlyQuotationValue[monthKey] !== undefined) {
          monthlyQuotationValue[monthKey] += quot.grandTotal;
        }
      });
      
      const processedMonthlyQuotationData = Object.entries(monthlyQuotationValue)
        .map(([month, quotationValue]) => ({ month, quotationValue }))
        .sort((a,b) => new Date(a.month).getTime() - new Date(b.month).getTime()) 
        .slice(-6); 
      setMonthlyQuotationData(processedMonthlyQuotationData);

      const allQuotationsQuery = query(quotationsRef, where("userId", "==", userId));
      const allQuotationDocsSnap = await getDocs(allQuotationsQuery);
      const allFetchedQuotations = allQuotationDocsSnap.docs.map(docSnap => docSnap.data() as Quotation);

      const statusCounts: Record<Quotation['status'], number> = {
        draft: 0, sent: 0, accepted: 0, declined: 0, expired: 0,
      };
      allFetchedQuotations.forEach(quot => {
        statusCounts[quot.status]++;
      });
      const processedQuotationStatusData = (Object.keys(statusCounts) as Array<Quotation['status']>)
        .map(status => ({
          name: status.charAt(0).toUpperCase() + status.slice(1),
          value: statusCounts[status],
          fill: QUOTATION_PIE_CHART_COLORS[status],
        }))
        .filter(item => item.value > 0); 
      setQuotationStatusData(processedQuotationStatusData);

    } catch (err) {
      console.error("Error fetching quotation chart analytics:", err);
      setError(prev => prev ? prev + " Failed to load quotation chart data." : "Failed to load quotation chart data.");
    } finally {
      setLoadingCharts(false);
    }
  }, []);

  const fetchRecentActivities = useCallback(async (userId: string) => {
    setLoadingActivities(true);
    try {
      const activities: RecentActivityItem[] = [];
      const recentInvoicesQuery = query(collection(db, "invoices"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(2));
      const recentInvoicesSnap = await getDocs(recentInvoicesQuery);
      recentInvoicesSnap.forEach(doc => {
        const invoice = { id: doc.id, ...doc.data() } as Invoice;
        const createdAt = invoice.createdAt instanceof Timestamp ? invoice.createdAt.toDate() : new Date(invoice.createdAt || Date.now());
        activities.push({
          id: invoice.id!, type: 'invoice', action: `Invoice #${invoice.invoiceNumber} to ${invoice.client.name}`,
          time: format(createdAt, "PPp"), timestamp: createdAt, icon: FileText, link: `/dashboard/invoices/${invoice.id}`
        });
      });

      const recentQuotationsQuery = query(collection(db, "quotations"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(2));
      const recentQuotationsSnap = await getDocs(recentQuotationsQuery);
      recentQuotationsSnap.forEach(doc => {
        const quotation = { id: doc.id, ...doc.data() } as Quotation;
        const createdAt = quotation.createdAt instanceof Timestamp ? quotation.createdAt.toDate() : new Date(quotation.createdAt || Date.now());
        activities.push({
          id: quotation.id!, type: 'quotation', action: `Quotation #${quotation.quotationNumber} to ${quotation.client.name}`,
          time: format(createdAt, "PPp"), timestamp: createdAt, icon: Quote, link: `/dashboard/quotations/${quotation.id}`
        });
      });

      const recentClientsQuery = query(collection(db, "clients"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(1));
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
      setStats(initialDashboardStats);
      setQuotationStats(initialQuotationStats);

      if (analyticsType === 'invoices') {
        fetchDashboardData(currentUser.uid, dateFilter);
        fetchChartAndAdvancedAnalytics(currentUser.uid);
      } else {
        fetchQuotationData(currentUser.uid, dateFilter);
        fetchQuotationChartAnalytics(currentUser.uid);
      }
      fetchRecentActivities(currentUser.uid);
    } else if (!loadingAuth) {
      setStats(initialDashboardStats); 
      setQuotationStats(initialQuotationStats);
      setRecentActivities([]); 
      setMonthlyRevenueData([]); 
      setMonthlyQuotationData([]);
      setInvoiceStatusData([]);
      setQuotationStatusData([]);
      setLoadingStats(false); 
      setLoadingActivities(false); 
      setLoadingCharts(false);
    }
  }, [currentUser, dateFilter, analyticsType, fetchDashboardData, fetchQuotationData, fetchRecentActivities, fetchChartAndAdvancedAnalytics, fetchQuotationChartAnalytics, loadingAuth]);

  const dateFilterLabel = dateFilter === "thisMonth" ? "MTD" : dateFilter === "lastMonth" ? "Last Month" : "All Time";
  
  const invoiceStatCards = [
    { title: `Total Revenue (${dateFilterLabel})`, value: `Rs. ${stats.totalRevenue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, icon: IndianRupee, color: "text-green-500", description: "" },
    { title: `Overdue Invoices (${dateFilterLabel})`, value: `${stats.overdueInvoicesCount} (Rs. ${stats.overdueInvoicesAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})})`, icon: AlertTriangle, color: "text-red-500", description: stats.overdueInvoicesCount > 0 ? "Action required" : "No overdue invoices" },
    { title: "MoM Revenue Growth", value: stats.momRevenueGrowth !== null ? `${stats.momRevenueGrowth.toFixed(1)}%` : "N/A", icon: TrendingUp, color: stats.momRevenueGrowth !== null && stats.momRevenueGrowth >= 0 ? "text-green-500" : "text-red-500", description: "Prev. full month" },
    { title: `Sent Invoices (${dateFilterLabel})`, value: `Rs. ${stats.totalSentAmountForPeriod.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, icon: Send, color: "text-blue-500", description: `Sent invoices ${dateFilterLabel.toLowerCase()}` },
    { title: `Invoices Created (${dateFilterLabel})`, value: stats.invoicesCreatedCount.toString(), icon: FileText, color: "text-blue-500", description: "" },
    { title: "Total Active Clients", value: stats.activeClientsCount.toString(), icon: Users, color: "text-blue-500", description: "" },
  ];

  const quotationStatCards = [
    { title: `Total Quotation Value (${dateFilterLabel})`, value: `Rs. ${quotationStats.totalQuotationValue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, icon: IndianRupee, color: "text-green-500", description: "Total value of all quotations" },
    { title: `Quotations Created (${dateFilterLabel})`, value: quotationStats.quotationsCreatedCount.toString(), icon: Quote, color: "text-blue-500", description: "New quotations generated" },
    { title: "Accepted Quotations", value: quotationStats.acceptedQuotationsCount.toString(), icon: CheckCircle2, color: "text-green-500", description: "Successfully converted" },
    { title: "Pending Quotations", value: quotationStats.pendingQuotationsCount.toString(), icon: FileCheck, color: "text-yellow-500", description: "Awaiting response" },
    { title: "Conversion Rate", value: quotationStats.conversionRate !== null ? `${quotationStats.conversionRate.toFixed(1)}%` : "N/A", icon: TrendingUp, color: quotationStats.conversionRate !== null && quotationStats.conversionRate >= 50 ? "text-green-500" : "text-orange-500", description: "Acceptance rate" },
    { title: `Avg. Quotation Value (${dateFilterLabel})`, value: `Rs. ${quotationStats.averageQuotationValue !== null ? quotationStats.averageQuotationValue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'}`, icon: BarChartHorizontalBig, color: "text-blue-500", description: "All quotations" },
  ];

  const statCards = analyticsType === 'invoices' ? invoiceStatCards : quotationStatCards;

  const revenueChartConfig = {
    revenue: { label: "Revenue (Rs.)", color: "hsl(var(--chart-1))" },
  };
  
  const quotationChartConfig = {
    quotationValue: { label: "Quotation Value (Rs.)", color: "hsl(var(--chart-3))" },
  };
  
  const statusChartConfig = analyticsType === 'invoices' 
    ? invoiceStatusData.reduce((acc, item) => {
        acc[item.name.toLowerCase()] = { label: item.name, color: item.fill };
        return acc;
      }, {} as any)
    : quotationStatusData.reduce((acc, item) => {
        acc[item.name.toLowerCase()] = { label: item.name, color: item.fill };
        return acc;
      }, {} as any);

  const hasMeaningfulStats = analyticsType === 'invoices'
    ? stats.invoicesCreatedCount > 0 || stats.totalRevenue > 0 || stats.activeClientsCount > 0 || stats.momRevenueGrowth !== null || stats.totalSentAmountThisMonth > 0 || stats.totalSentAmountForPeriod > 0
    : quotationStats.quotationsCreatedCount > 0 || quotationStats.totalQuotationValue > 0 || quotationStats.conversionRate !== null || quotationStats.averageQuotationValue !== null;

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary/5 via-accent/5 to-primary/10 border-b border-border/50">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="relative px-6 py-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <PieChartIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-4xl lg:text-5xl font-headline font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                      Dashboard
                    </h1>
                    <p className="text-lg text-muted-foreground mt-1">Welcome back! Here's your business overview</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span>Live data</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>Real-time analytics</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
                {/* Analytics Type Toggle */}
                <div className="flex items-center gap-1 p-1 bg-background/80 backdrop-blur-sm rounded-xl border border-border/50 shadow-sm">
                  <Button
                    variant={analyticsType === 'invoices' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setAnalyticsType('invoices')}
                    className={`flex items-center gap-2 transition-all duration-300 rounded-lg px-4 py-2 ${
                      analyticsType === 'invoices' 
                        ? 'bg-primary text-primary-foreground shadow-md' 
                        : 'hover:bg-muted/50'
                    }`}
                    disabled={loadingStats || !currentUser}
                  >
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">Invoices</span>
                  </Button>
                  <Button
                    variant={analyticsType === 'quotations' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setAnalyticsType('quotations')}
                    className={`flex items-center gap-2 transition-all duration-300 rounded-lg px-4 py-2 ${
                      analyticsType === 'quotations' 
                        ? 'bg-primary text-primary-foreground shadow-md' 
                        : 'hover:bg-muted/50'
                    }`}
                    disabled={loadingStats || !currentUser}
                  >
                    <Quote className="h-4 w-4" />
                    <span className="font-medium">Quotations</span>
                  </Button>
                </div>
                
                {/* Controls */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Select value={dateFilter} onValueChange={(value: DateFilterOption) => setDateFilter(value)} disabled={loadingStats || !currentUser}>
                    <SelectTrigger className="w-full sm:w-[180px] bg-background/80 backdrop-blur-sm border-border/50">
                      <SelectValue placeholder="Filter by date" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="thisMonth">This Month</SelectItem>
                      <SelectItem value="lastMonth">Last Month</SelectItem>
                      <SelectItem value="allTime">All Time</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    asChild 
                    className="bg-gradient-to-r from-accent to-primary hover:from-accent/90 hover:to-primary/90 text-white shadow-lg hover:shadow-xl transition-all duration-300 w-full sm:w-auto px-6" 
                    disabled={!currentUser}
                  >
                    <Link href={analyticsType === 'invoices' ? "/dashboard/invoices/new" : "/dashboard/quotations/new"}>
                      <span className="font-medium">
                        {analyticsType === 'invoices' ? 'Create Invoice' : 'Create Quotation'}
                      </span>
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Stats Cards Section */}
        {loadingStats ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="border-0 shadow-md bg-gradient-to-br from-card to-card/50">
                <CardHeader className="pb-3">
                  <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent className="pt-0">
                  <Skeleton className="h-8 w-1/2 mb-2" />
                  <Skeleton className="h-3 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error && !loadingAuth ? (
          <div className="text-center py-16">
            <div className="mx-auto w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">Error Loading Statistics</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">{error}</p>
            <Button 
              onClick={() => currentUser && fetchDashboardData(currentUser.uid, dateFilter)} 
              className="bg-gradient-to-r from-accent to-primary hover:from-accent/90 hover:to-primary/90 text-white"
            >
              Try Again
            </Button>
          </div>
        ) : hasMeaningfulStats ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {statCards.map((stat, index) => (
              <Card 
                key={stat.title} 
                className="group relative overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-card via-card to-card/80 hover:scale-[1.02]"
              >
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
                  <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors duration-300">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${getIconBackground(index)} group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className="h-4 w-4 text-white" />
                  </div>
                </CardHeader>
                <CardContent className="pt-0 relative z-10">
                  <div className="text-2xl font-bold mb-1 group-hover:text-primary transition-colors duration-300">
                    {stat.value}
                  </div>
                  {stat.description && (
                    <p className="text-xs text-muted-foreground group-hover:text-muted-foreground/80 transition-colors duration-300">
                      {stat.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="mx-auto w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center mb-6">
              <PieChartIcon className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Data Available</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              No statistics available for the selected period. Start by creating some {analyticsType}!
            </p>
            <Button asChild className="bg-gradient-to-r from-accent to-primary hover:from-accent/90 hover:to-primary/90 text-white">
              <Link href={analyticsType === 'invoices' ? "/dashboard/invoices/new" : "/dashboard/quotations/new"}>
                Create {analyticsType === 'invoices' ? 'Invoice' : 'Quotation'}
              </Link>
            </Button>
          </div>
        )}

        {/* Charts Section */}
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Revenue/Quotation Chart */}
          <Card className="lg:col-span-3 border-0 shadow-lg bg-gradient-to-br from-card via-card to-card/80 hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent">
                  <BarChartHorizontalBig className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="font-headline text-xl">
                    {analyticsType === 'invoices' ? 'Revenue Trends' : 'Quotation Trends'}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {analyticsType === 'invoices' 
                      ? 'Track your paid invoice revenue over the last 6 months'
                      : 'Track your quotation values over the last 6 months'
                    }
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {loadingCharts ? (
                <div className="h-[350px] flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Loading chart data...</p>
                  </div>
                </div>
              ) : (analyticsType === 'invoices' ? monthlyRevenueData.length > 0 : monthlyQuotationData.length > 0) ? (
                <ChartContainer config={analyticsType === 'invoices' ? revenueChartConfig : quotationChartConfig} className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsType === 'invoices' ? monthlyRevenueData : monthlyQuotationData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                      <defs>
                        <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={analyticsType === 'invoices' ? 'hsl(var(--primary))' : 'hsl(var(--chart-3))'} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={analyticsType === 'invoices' ? 'hsl(var(--primary))' : 'hsl(var(--chart-3))'} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis 
                        dataKey="month" 
                        tickLine={false} 
                        axisLine={false} 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        tickFormatter={(value) => `₹${value/1000}k`} 
                        tickLine={false} 
                        axisLine={false} 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <RechartsTooltip
                        content={<ChartTooltipContent indicator="dot" hideLabel />}
                        cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "3 3" }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey={analyticsType === 'invoices' ? 'revenue' : 'quotationValue'} 
                        stroke={analyticsType === 'invoices' ? 'hsl(var(--primary))' : 'hsl(var(--chart-3))'} 
                        strokeWidth={3} 
                        dot={{ r: 5, fill: analyticsType === 'invoices' ? 'hsl(var(--primary))' : 'hsl(var(--chart-3))', strokeWidth: 2, stroke: 'white' }} 
                        activeDot={{ r: 7, stroke: analyticsType === 'invoices' ? 'hsl(var(--primary))' : 'hsl(var(--chart-3))', strokeWidth: 2, fill: 'white' }} 
                        fill="url(#colorGradient)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="h-[350px] flex items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                      <BarChartHorizontalBig className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">
                      {analyticsType === 'invoices' 
                        ? 'No revenue data to display for the period'
                        : 'No quotation data to display for the period'
                      }
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Overview Chart */}
          <Card className="lg:col-span-2 border-0 shadow-lg bg-gradient-to-br from-card via-card to-card/80 hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-accent to-primary">
                  <PieChartIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="font-headline text-xl">
                    Status Overview
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {analyticsType === 'invoices' 
                      ? 'Current breakdown of all your invoices'
                      : 'Current breakdown of all your quotations'
                    }
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 flex justify-center items-center">
              {loadingCharts ? (
                <div className="h-[350px] flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Loading chart data...</p>
                  </div>
                </div>
              ) : (analyticsType === 'invoices' ? invoiceStatusData.length > 0 : quotationStatusData.length > 0) ? (
                <ChartContainer config={statusChartConfig} className="h-[350px] w-full max-w-sm aspect-square">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <RechartsTooltip 
                        content={<ChartTooltipContent nameKey="name" hideIndicator />}
                        cursor={{ fill: 'transparent' }}
                      />
                      <Pie 
                        data={analyticsType === 'invoices' ? invoiceStatusData : quotationStatusData} 
                        dataKey="value" 
                        nameKey="name" 
                        cx="50%" 
                        cy="50%" 
                        outerRadius={120} 
                        innerRadius={60}
                        paddingAngle={2}
                        labelLine={false} 
                        label={({ name, percent }) => percent > 5 ? `${name}\n${(percent * 100).toFixed(0)}%` : ''}
                        fontSize={12}
                      >
                        {(analyticsType === 'invoices' ? invoiceStatusData : quotationStatusData).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} stroke="white" strokeWidth={2} />
                        ))}
                      </Pie>
                      <RechartsLegend 
                        content={<ChartLegendContent />} 
                        wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="h-[350px] flex items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                      <PieChartIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">
                      {analyticsType === 'invoices' 
                        ? 'No invoice status data available'
                        : 'No quotation status data available'
                      }
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity & Quick Actions */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* Recent Activity */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-card via-card to-card/80 hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="font-headline text-xl">Recent Activity</CardTitle>
                  <CardDescription className="text-sm">
                    {analyticsType === 'invoices' 
                      ? 'Latest invoice and client updates'
                      : 'Latest quotation and client updates'
                    }
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {loadingActivities ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4 p-4 rounded-xl bg-muted/30">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentActivities.filter(activity => 
                analyticsType === 'invoices' 
                  ? activity.type === 'invoice' || activity.type === 'client'
                  : activity.type === 'quotation' || activity.type === 'client'
              ).length > 0 ? (
                <div className="space-y-3">
                  {recentActivities
                    .filter(activity => 
                      analyticsType === 'invoices' 
                        ? activity.type === 'invoice' || activity.type === 'client'
                        : activity.type === 'quotation' || activity.type === 'client'
                    )
                    .slice(0, 4)
                    .map((activity) => (
                    <div key={activity.id + activity.type} className="flex items-center space-x-4 p-4 rounded-xl hover:bg-muted/50 transition-all duration-200 group">
                      <div className="flex-shrink-0">
                        <div className={`p-2 rounded-lg ${
                          activity.type === 'invoice' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                          activity.type === 'quotation' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                          'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                        }`}>
                          <activity.icon className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {activity.action}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.time}
                        </p>
                      </div>
                      {activity.link && (
                        <Link href={activity.link} className="text-muted-foreground group-hover:text-primary transition-colors">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="mx-auto w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                    <Activity className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground mb-2">
                    {analyticsType === 'invoices' 
                      ? 'No recent invoice activity found'
                      : 'No recent quotation activity found'
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">Activities will appear here as you use the system</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-card via-card to-card/80 hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-red-500">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="font-headline text-xl">Quick Actions</CardTitle>
                  <CardDescription className="text-sm">
                    {analyticsType === 'invoices' 
                      ? 'Common invoice tasks to get you started'
                      : 'Common quotation tasks to get you started'
                    }
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <Button asChild className="w-full justify-start h-12 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white border-0 shadow-md hover:shadow-lg transition-all duration-200" disabled={!currentUser}>
                <Link href={analyticsType === 'invoices' ? "/dashboard/invoices/new" : "/dashboard/quotations/new"}>
                  {analyticsType === 'invoices' ? (
                    <FileText className="mr-3 h-4 w-4" />
                  ) : (
                    <Quote className="mr-3 h-4 w-4" />
                  )}
                  {analyticsType === 'invoices' ? 'Create New Invoice' : 'Create New Quotation'}
                </Link>
              </Button>
              <Button asChild className="w-full justify-start h-12 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white border-0 shadow-md hover:shadow-lg transition-all duration-200" disabled={!currentUser}>
                <Link href="/dashboard/clients/new">
                  <Users className="mr-3 h-4 w-4" />
                  Add New Client
                </Link>
              </Button>
              
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-3 font-medium">VIEW & MANAGE</p>
                <div className="space-y-2">
                  <Button asChild className="w-full justify-start h-10 text-sm" variant="outline" disabled={!currentUser}>
                    <Link href={analyticsType === 'invoices' ? "/dashboard/invoices" : "/dashboard/quotations"}>
                      <FileCheck className="mr-2 h-4 w-4" />
                      {analyticsType === 'invoices' ? 'View All Invoices' : 'View All Quotations'}
                    </Link>
                  </Button>
                  <Button variant="outline" asChild className="w-full justify-start h-10 text-sm">
                    <Link href="/dashboard/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      Account Settings
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

    