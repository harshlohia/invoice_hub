"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Edit, Copy, Star, Users, Download, Loader2, AlertTriangle, Eye } from "lucide-react";
import Link from 'next/link';
import type { InvoiceTemplate } from '@/lib/types';
import { TemplatePreview } from '@/components/TemplatePreview';
import { db, getFirebaseAuthInstance } from '@/lib/firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { onAuthStateChanged, type User, type Auth } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const templateId = params.id as string;
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<InvoiceTemplate | null>(null);

  useEffect(() => {
    const authInstance: Auth = getFirebaseAuthInstance();
    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (templateId) {
      fetchTemplate();
    }
  }, [templateId]);

  const fetchTemplate = async () => {
    setLoading(true);
    setError(null);
    try {
      const templateRef = doc(db, 'templates', templateId);
      const templateSnap = await getDoc(templateRef);
      
      if (templateSnap.exists()) {
        const templateData = { id: templateSnap.id, ...templateSnap.data() } as InvoiceTemplate;
        setTemplate(templateData);
        
        // Increment usage count for analytics
        await updateDoc(templateRef, {
          usageCount: increment(1)
        });
      } else {
        setError('Template not found.');
      }
    } catch (err) {
      console.error("Error fetching template:", err);
      setError('Failed to load template data.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseTemplate = () => {
    if (!template) return;
    
    // Navigate to create invoice with this template
    router.push(`/dashboard/invoices/new?templateId=${template.id}`);
  };

  const handleCloneTemplate = () => {
    if (!template) return;
    
    // Navigate to create template with this template as base
    router.push(`/dashboard/templates/create?cloneId=${template.id}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-96 w-full" />
          </div>
          <div className="lg:col-span-1">
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Alert variant="destructive" className="text-left">
          <AlertTriangle className="h-5 w-5"/>
          <AlertTitle className="font-headline">Error Loading Template</AlertTitle>
          <AlertDescription>{error || 'Template not found'}</AlertDescription>
        </Alert>
        <Button asChild variant="link" className="mt-6">
          <Link href="/dashboard/templates">Back to Templates</Link>
        </Button>
      </div>
    );
  }

  const isOwner = template.userId === currentUser?.uid;
  const createdDate = template.createdAt ? new Date(template.createdAt.seconds * 1000) : null;
  const updatedDate = template.updatedAt ? new Date(template.updatedAt.seconds * 1000) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/templates">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-headline font-bold tracking-tight">{template.name}</h1>
              <div className="flex gap-2">
                {template.isPublic && <Badge variant="secondary"><Users className="h-3 w-3 mr-1" />Public</Badge>}
                {template.isDefault && <Badge variant="default"><Star className="h-3 w-3 mr-1" />Default</Badge>}
                {isOwner && <Badge variant="outline">Mine</Badge>}
              </div>
            </div>
            <p className="text-muted-foreground">{template.description || 'No description provided.'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isOwner && (
            <Button variant="outline\" asChild>
              <Link href={`/dashboard/templates/${templateId}/edit`}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </Link>
            </Button>
          )}
          {!isOwner && (
            <Button variant="outline" onClick={handleCloneTemplate}>
              <Copy className="mr-2 h-4 w-4" /> Clone
            </Button>
          )}
          <Button onClick={handleUseTemplate} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            Use Template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template Preview */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Template Preview</CardTitle>
              <CardDescription>Full-size preview of how invoices will look with this template.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-white p-8 rounded-lg border shadow-sm">
                <TemplatePreview template={template} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Template Details */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sections:</span>
                  <span>{template.sections?.filter(s => s.visible).length || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Usage Count:</span>
                  <span>{template.usageCount || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Font Family:</span>
                  <span className="capitalize">{template.style?.fontFamily || 'Helvetica'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Spacing:</span>
                  <span className="capitalize">{template.style?.spacing || 'normal'}</span>
                </div>
              </div>

              {createdDate && (
                <div className="pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Created:</span>
                    <span>{format(createdDate, 'MMM dd, yyyy')}</span>
                  </div>
                  {updatedDate && updatedDate.getTime() !== createdDate.getTime() && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Updated:</span>
                      <span>{format(updatedDate, 'MMM dd, yyyy')}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Color Scheme</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-6 h-6 rounded border"
                    style={{ backgroundColor: template.style?.primaryColor || '#3F51B5' }}
                  />
                  <div>
                    <p className="text-xs font-medium">Primary</p>
                    <p className="text-xs text-muted-foreground">{template.style?.primaryColor || '#3F51B5'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-6 h-6 rounded border"
                    style={{ backgroundColor: template.style?.secondaryColor || '#f8f9fa' }}
                  />
                  <div>
                    <p className="text-xs font-medium">Secondary</p>
                    <p className="text-xs text-muted-foreground">{template.style?.secondaryColor || '#f8f9fa'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-6 h-6 rounded border"
                    style={{ backgroundColor: template.style?.backgroundColor || '#ffffff' }}
                  />
                  <div>
                    <p className="text-xs font-medium">Background</p>
                    <p className="text-xs text-muted-foreground">{template.style?.backgroundColor || '#ffffff'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-6 h-6 rounded border"
                    style={{ backgroundColor: template.style?.textColor || '#212529' }}
                  />
                  <div>
                    <p className="text-xs font-medium">Text</p>
                    <p className="text-xs text-muted-foreground">{template.style?.textColor || '#212529'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={handleUseTemplate} className="w-full">
                <Eye className="mr-2 h-4 w-4" />
                Use for New Invoice
              </Button>
              
              {isOwner ? (
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/dashboard/templates/${templateId}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Template
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" className="w-full" onClick={handleCloneTemplate}>
                  <Copy className="mr-2 h-4 w-4" />
                  Clone Template
                </Button>
              )}
              
              <Button variant="outline" className="w-full" disabled>
                <Download className="mr-2 h-4 w-4" />
                Export Template
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}