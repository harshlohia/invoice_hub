"use client";

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Search, Palette, Eye, Edit, Trash2, Copy, Star, Users, Loader2, AlertTriangle, Sparkles } from 'lucide-react';
import { collection, getDocs, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db, getFirebaseAuthInstance } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { onAuthStateChanged, type User, type Auth } from 'firebase/auth';
import type { InvoiceTemplate } from '@/lib/types';
import { DEFAULT_TEMPLATE_SECTIONS, DEFAULT_TEMPLATE_STYLE } from '@/lib/types';
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

// Default template that's not stored in DB
const DEFAULT_TEMPLATE: InvoiceTemplate = {
  id: 'default',
  name: 'BillFlow Default',
  description: 'Clean and professional default template with modern styling',
  isPublic: true,
  isDefault: true,
  sections: DEFAULT_TEMPLATE_SECTIONS,
  style: DEFAULT_TEMPLATE_STYLE,
  usageCount: 0
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<InvoiceTemplate | null>(null);
  const { toast } = useToast();

  const fetchTemplates = useCallback(async (userId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const templatesRef = collection(db, "templates");
      
      // Fetch both public templates and user's private templates
      const queries = [
        query(templatesRef, where("isPublic", "==", true), orderBy("usageCount", "desc"))
      ];
      
      if (userId) {
        queries.push(
          query(templatesRef, where("userId", "==", userId), orderBy("createdAt", "desc"))
        );
      }
      
      const allTemplates: InvoiceTemplate[] = [DEFAULT_TEMPLATE]; // Start with default template
      
      for (const q of queries) {
        const querySnapshot = await getDocs(q);
        const templateData = querySnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as InvoiceTemplate));
        allTemplates.push(...templateData);
      }
      
      // Remove duplicates (in case a user's template is also public)
      const uniqueTemplates = allTemplates.filter((template, index, self) => 
        index === self.findIndex(t => t.id === template.id)
      );
      
      setTemplates(uniqueTemplates);
    } catch (err) {
      console.error("Error fetching templates:", err);
      setError("Failed to load templates. Please try again.");
      toast({ title: "Error", description: "Could not fetch templates.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const authInstance: Auth = getFirebaseAuthInstance();
    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
      setCurrentUser(user);
      fetchTemplates(user?.uid);
    });
    return () => unsubscribe();
  }, [fetchTemplates]);

  const handleDeleteTemplate = async (templateId: string) => {
    if (!templateId || templateId === 'default') return;
    try {
      await deleteDoc(doc(db, "templates", templateId));
      setTemplates(prevTemplates => prevTemplates.filter(template => template.id !== templateId));
      toast({
        title: "Template Deleted",
        description: "The template has been successfully deleted.",
      });
    } catch (err) {
      console.error("Error deleting template:", err);
      toast({
        title: "Error",
        description: "Failed to delete template. Please try again.",
        variant: "destructive",
      });
    }
    setTemplateToDelete(null);
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const defaultTemplate = filteredTemplates.find(t => t.id === 'default');
  const publicTemplates = filteredTemplates.filter(t => t.isPublic && t.id !== 'default');
  const userTemplates = filteredTemplates.filter(t => !t.isPublic && t.userId === currentUser?.uid);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight flex items-center">
            <Palette className="mr-3 h-8 w-8 text-primary" />
            Invoice Templates
          </h1>
          <p className="text-muted-foreground">Create and manage custom invoice templates for your business.</p>
        </div>
        <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Link href="/dashboard/templates/create">
            <PlusCircle className="mr-2 h-5 w-5" /> Create Template
          </Link>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 p-4 border rounded-lg bg-card shadow">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Search templates by name or description..." 
            className="pl-10 w-full" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading && (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-4 text-lg text-muted-foreground">Loading templates...</p>
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <h3 className="mt-2 text-xl font-semibold">Error Loading Templates</h3>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => fetchTemplates(currentUser?.uid)} className="mt-4">Retry</Button>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-8">
          {/* Default Template */}
          {defaultTemplate && (
            <div>
              <h2 className="text-2xl font-headline font-bold mb-4 flex items-center">
                <Sparkles className="mr-2 h-6 w-6 text-accent" />
                Default Template
              </h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <TemplateCard 
                  template={defaultTemplate} 
                  isOwner={false}
                  isDefault={true}
                  onDeleteRequest={() => {}} // Can't delete default template
                />
              </div>
            </div>
          )}

          {/* User's Templates */}
          {currentUser && userTemplates.length > 0 && (
            <div>
              <h2 className="text-2xl font-headline font-bold mb-4">My Templates</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {userTemplates.map((template) => (
                  <TemplateCard 
                    key={template.id} 
                    template={template} 
                    isOwner={true}
                    onDeleteRequest={() => setTemplateToDelete(template)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Public Templates */}
          <div>
            <h2 className="text-2xl font-headline font-bold mb-4 flex items-center">
              <Users className="mr-2 h-6 w-6" />
              Community Templates
            </h2>
            {publicTemplates.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {publicTemplates.map((template) => (
                  <TemplateCard 
                    key={template.id} 
                    template={template} 
                    isOwner={template.userId === currentUser?.uid}
                    onDeleteRequest={() => setTemplateToDelete(template)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Palette className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-xl font-semibold">No Community Templates</h3>
                <p className="mt-1 text-sm text-muted-foreground">Be the first to create a public template!</p>
              </div>
            )}
          </div>

          {/* Empty State */}
          {!loading && !error && filteredTemplates.length === 0 && (
            <div className="text-center py-12">
              <Palette className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-xl font-semibold">
                {templates.length === 0 ? "No templates yet" : "No templates match your search"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {templates.length === 0 ? "Create your first custom template to get started." : "Try adjusting your search term."}
              </p>
              {templates.length === 0 && (
                <Button className="mt-6" asChild>
                  <Link href="/dashboard/templates/create">Create Template</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {templateToDelete && (
        <AlertDialog open={!!templateToDelete} onOpenChange={() => setTemplateToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the template "{templateToDelete.name}" and all its configurations.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setTemplateToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDeleteTemplate(templateToDelete.id!)}
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

interface TemplateCardProps {
  template: InvoiceTemplate;
  isOwner: boolean;
  isDefault?: boolean;
  onDeleteRequest: () => void;
}

function TemplateCard({ template, isOwner, isDefault = false, onDeleteRequest }: TemplateCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="font-headline text-xl flex items-center gap-2">
              {template.name}
              {template.isDefault && <Star className="h-4 w-4 text-yellow-500 fill-current" />}
              {isDefault && <Sparkles className="h-4 w-4 text-accent fill-current" />}
            </CardTitle>
            <CardDescription className="mt-1">{template.description}</CardDescription>
          </div>
          <div className="flex gap-1">
            {template.isPublic && <Badge variant="secondary">Public</Badge>}
            {isOwner && <Badge variant="outline">Mine</Badge>}
            {isDefault && <Badge className="bg-accent text-accent-foreground">Default</Badge>}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-grow">
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Sections:</span>
            <span>{template.sections?.filter(s => s.visible).length || 0}</span>
          </div>
          <div className="flex justify-between">
            <span>Usage:</span>
            <span>{template.usageCount || 0} times</span>
          </div>
          <div className="flex justify-between">
            <span>Style:</span>
            <div className="flex items-center gap-1">
              <div 
                className="w-3 h-3 rounded-full border" 
                style={{ backgroundColor: template.style?.primaryColor || '#3F51B5' }}
              />
              <span className="capitalize">{template.style?.spacing || 'normal'}</span>
            </div>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex gap-2 border-t pt-4">
        <Button variant="outline" size="sm" asChild className="flex-1">
          <Link href={`/dashboard/templates/${template.id}`}>
            <Eye className="mr-1 h-4 w-4" /> Preview
          </Link>
        </Button>
        
        {isOwner && !isDefault ? (
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/templates/${template.id}/edit`}>
                <Edit className="mr-1 h-4 w-4" /> Edit
              </Link>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
              onClick={onDeleteRequest}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <Copy className="mr-1 h-4 w-4" /> Clone
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}