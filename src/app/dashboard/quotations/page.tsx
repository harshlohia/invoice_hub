
"use client";

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from 'next/link';
import { PlusCircle, Search, Eye, Edit, Download, Trash2, Filter, Loader2, AlertTriangle } from "lucide-react";
import { db, getFirebaseAuthInstance } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { User as FirebaseAuthUser, Auth } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import type { Quotation } from '@/lib/types';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const statusColors: Record<Quotation['status'], string> = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
  expired: 'bg-orange-100 text-orange-800',
};

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [filteredQuotations, setFilteredQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentUser, setCurrentUser] = useState<FirebaseAuthUser | null>(null);

  useEffect(() => {
    const authInstance: Auth = getFirebaseAuthInstance();
    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
      setCurrentUser(user);
      if (!user) {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchQuotations = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const quotationsRef = collection(db, "quotations");
      const q = query(
        quotationsRef,
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      
      const quotationsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          quotationDate: data.quotationDate instanceof Timestamp ? data.quotationDate.toDate() : new Date(data.quotationDate),
          validUntil: data.validUntil instanceof Timestamp ? data.validUntil.toDate() : new Date(data.validUntil),
        } as Quotation;
      });
      
      setQuotations(quotationsData);
      setFilteredQuotations(quotationsData);
    } catch (err) {
      console.error("Error fetching quotations:", err);
      setError("Failed to load quotations. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchQuotations(currentUser.uid);
    }
  }, [currentUser, fetchQuotations]);

  useEffect(() => {
    let filtered = quotations;
    
    if (searchTerm) {
      filtered = filtered.filter(quotation =>
        quotation.quotationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quotation.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quotation.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (statusFilter !== "all") {
      filtered = filtered.filter(quotation => quotation.status === statusFilter);
    }
    
    setFilteredQuotations(filtered);
  }, [quotations, searchTerm, statusFilter]);

  if (!currentUser && !loading) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-2 text-xl font-semibold">Not Logged In</h3>
        <p className="mt-1 text-sm text-muted-foreground">Please log in to view your quotations.</p>
        <Button asChild className="mt-4">
          <Link href="/login">Log In</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex gap-4 items-center">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h3 className="mt-2 text-xl font-semibold">Error Loading Quotations</h3>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button onClick={() => currentUser && fetchQuotations(currentUser.uid)} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Quotations</h1>
          <p className="text-muted-foreground">Create and manage your quotations</p>
        </div>
        <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Link href="/dashboard/quotations/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Quotation
          </Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search quotations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredQuotations.length === 0 ? (
        <div className="text-center py-12 bg-muted/20 rounded-lg border-2 border-dashed">
          <PlusCircle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold">No quotations found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {quotations.length === 0 
              ? "Get started by creating your first quotation." 
              : "Try adjusting your search or filter criteria."
            }
          </p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/quotations/new">Create Quotation</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredQuotations.map((quotation) => (
            <Card key={quotation.id} className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg font-semibold">
                      {quotation.quotationNumber}
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                      {quotation.client.name}
                    </CardDescription>
                  </div>
                  <Badge className={statusColors[quotation.status]}>
                    {quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-medium">{quotation.title}</h4>
                  {quotation.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {quotation.description}
                    </p>
                  )}
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Date: {format(quotation.quotationDate, 'MMM dd, yyyy')}</span>
                  <span>Valid: {format(quotation.validUntil, 'MMM dd, yyyy')}</span>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">
                    Rs. {quotation.grandTotal.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/dashboard/quotations/${quotation.id}`}>
                      <Eye className="mr-1 h-3 w-3" />
                      View
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/dashboard/quotations/${quotation.id}/edit`}>
                      <Edit className="mr-1 h-3 w-3" />
                      Edit
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
