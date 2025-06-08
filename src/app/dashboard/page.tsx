
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { IndianRupee, FileText, Users, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export default function DashboardPage() {
  const stats = [
    { title: "Total Revenue (MTD)", value: "Rs. 1,25,430", icon: IndianRupee, color: "text-green-500", description: "+15.2% from last month" },
    { title: "Invoices Created (MTD)", value: "78", icon: FileText, color: "text-blue-500", description: "5 new today" },
    { title: "Active Clients", value: "32", icon: Users, color: "text-purple-500", description: "2 new this week" },
    { title: "Overdue Invoices", value: "5 (Rs. 22,800)", icon: AlertTriangle, color: "text-red-500", description: "Action required" },
  ];

  const recentActivities = [
    { action: "Invoice #INV0078 created for Tech Solutions Ltd.", time: "15 mins ago", icon: FileText },
    { action: "Payment received for Invoice #INV0072.", time: "1 hour ago", icon: CheckCircle2, color: "text-green-500" },
    { action: "Client 'Innovate Hub' added.", time: "3 hours ago", icon: Users },
    { action: "Invoice #INV0070 is now overdue.", time: "1 day ago", icon: Clock, color: "text-orange-500" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's an overview of your business.</p>
        </div>
        <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Link href="/dashboard/invoices/new">Create New Invoice</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="font-headline">Recent Activity</CardTitle>
            <CardDescription>What's been happening recently.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivities.map((activity, index) => (
              <div key={index} className="flex items-start gap-3">
                <activity.icon className={`h-5 w-5 mt-1 ${activity.color || 'text-primary'}`} />
                <div>
                  <p className="text-sm font-medium">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            ))}
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

