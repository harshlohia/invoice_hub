"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Eye, Plus, Trash2, GripVertical, Palette, Layout, Settings, Loader2, AlertTriangle } from "lucide-react";
import Link from 'next/link';
import type { InvoiceTemplate, TemplateSection, TemplateStyle } from '@/lib/types';
import { TemplatePreview } from '@/components/TemplatePreview';
import { SectionEditor } from '@/components/template/SectionEditor';
import { StyleEditor } from '@/components/template/StyleEditor';
import { ColumnEditor } from '@/components/template/ColumnEditor';
import { db, getFirebaseAuthInstance } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, type User, type Auth } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function EditTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const templateId = params.id as string;
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<InvoiceTemplate | null>(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [selectedSection, setSelectedSection] = useState<string>('header');

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

  const handleSaveTemplate = async () => {
    if (!currentUser || !template) {
      toast({ title: "Error", description: "You must be logged in to save templates.", variant: "destructive" });
      return;
    }

    if (!template.name?.trim()) {
      toast({ title: "Error", description: "Template name is required.", variant: "destructive" });
      return;
    }

    // Check if user owns this template or if it's public
    if (template.userId && template.userId !== currentUser.uid) {
      toast({ title: "Error", description: "You don't have permission to edit this template.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const templateRef = doc(db, 'templates', templateId);
      const updateData = {
        ...template,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(templateRef, updateData);
      
      toast({
        title: "Template Updated",
        description: `Template "${template.name}" has been successfully updated.`,
      });
      
      router.push(`/dashboard/templates/${templateId}`);
    } catch (error) {
      console.error("Error updating template:", error);
      toast({
        title: "Error",
        description: "Failed to update template. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateTemplate = (updates: Partial<InvoiceTemplate>) => {
    setTemplate(prev => prev ? { ...prev, ...updates } : null);
  };

  const updateSection = (sectionId: string, updates: Partial<TemplateSection>) => {
    setTemplate(prev => prev ? {
      ...prev,
      sections: prev.sections?.map(section => 
        section.id === sectionId ? { ...section, ...updates } : section
      ) || []
    } : null);
  };

  const updateStyle = (updates: Partial<TemplateStyle>) => {
    setTemplate(prev => prev ? {
      ...prev,
      style: { ...prev.style, ...updates }
    } : null);
  };

  const addSection = () => {
    if (!template) return;
    
    const newSection: TemplateSection = {
      id: `section_${Date.now()}`,
      type: 'notes',
      title: 'New Section',
      visible: true,
      position: (template.sections?.length || 0) + 1,
      textColor: '#212529',
      fontSize: 12,
      fontWeight: 'normal',
      padding: 10,
      margin: 10,
      fields: []
    };

    setTemplate(prev => prev ? {
      ...prev,
      sections: [...(prev.sections || []), newSection]
    } : null);
  };

  const removeSection = (sectionId: string) => {
    setTemplate(prev => prev ? {
      ...prev,
      sections: prev.sections?.filter(section => section.id !== sectionId) || []
    } : null);
  };

  const moveSection = (sectionId: string, direction: 'up' | 'down') => {
    if (!template) return;
    
    const sections = [...(template.sections || [])];
    const index = sections.findIndex(s => s.id === sectionId);
    
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;
    
    [sections[index], sections[newIndex]] = [sections[newIndex], sections[index]];
    
    // Update positions
    sections.forEach((section, idx) => {
      section.position = idx + 1;
    });
    
    setTemplate(prev => prev ? { ...prev, sections } : null);
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

  // Check if user can edit this template
  const canEdit = !template.userId || template.userId === currentUser?.uid;

  if (!canEdit) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Alert variant="destructive" className="text-left">
          <AlertTriangle className="h-5 w-5"/>
          <AlertTitle className="font-headline">Permission Denied</AlertTitle>
          <AlertDescription>You don't have permission to edit this template.</AlertDescription>
        </Alert>
        <Button asChild variant="link" className="mt-6">
          <Link href="/dashboard/templates">Back to Templates</Link>
        </Button>
      </div>
    );
  }

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
            <h1 className="text-3xl font-headline font-bold tracking-tight">Edit Template</h1>
            <p className="text-muted-foreground">Modify "{template.name}" template design.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/templates/${templateId}`}>
              <Eye className="mr-2 h-4 w-4" /> Preview
            </Link>
          </Button>
          <Button onClick={handleSaveTemplate} disabled={saving || !currentUser}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template Editor */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Basic
              </TabsTrigger>
              <TabsTrigger value="sections" className="flex items-center gap-2">
                <Layout className="h-4 w-4" />
                Sections
              </TabsTrigger>
              <TabsTrigger value="style" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Style
              </TabsTrigger>
              <TabsTrigger value="columns" className="flex items-center gap-2">
                <GripVertical className="h-4 w-4" />
                Columns
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Template Information</CardTitle>
                  <CardDescription>Basic details about your template.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="name">Template Name*</Label>
                    <Input
                      id="name"
                      value={template.name || ''}
                      onChange={(e) => updateTemplate({ name: e.target.value })}
                      placeholder="e.g., Professional Blue, Modern Minimal"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={template.description || ''}
                      onChange={(e) => updateTemplate({ description: e.target.value })}
                      placeholder="Describe your template design and use case..."
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Public Template</Label>
                      <p className="text-sm text-muted-foreground">
                        Make this template available to all users
                      </p>
                    </div>
                    <Switch
                      checked={template.isPublic || false}
                      onCheckedChange={(checked) => updateTemplate({ isPublic: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Set as Default</Label>
                      <p className="text-sm text-muted-foreground">
                        Use this template for new invoices by default
                      </p>
                    </div>
                    <Switch
                      checked={template.isDefault || false}
                      onCheckedChange={(checked) => updateTemplate({ isDefault: checked })}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sections" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Template Sections</CardTitle>
                    <CardDescription>Configure which sections to include and their order.</CardDescription>
                  </div>
                  <Button onClick={addSection} size="sm">
                    <Plus className="mr-2 h-4 w-4" /> Add Section
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {template.sections?.map((section) => (
                    <div key={section.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant={section.visible ? "default" : "secondary"}>
                            {section.type}
                          </Badge>
                          <span className="font-medium">{section.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveSection(section.id, 'up')}
                            disabled={section.position === 1}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveSection(section.id, 'down')}
                            disabled={section.position === template.sections?.length}
                          >
                            ↓
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedSection(section.id)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSection(section.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={section.visible}
                            onCheckedChange={(checked) => updateSection(section.id, { visible: checked })}
                          />
                          <Label>Visible</Label>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Position: {section.position}
                        </div>
                      </div>

                      {selectedSection === section.id && (
                        <SectionEditor
                          section={section}
                          onUpdate={(updates) => updateSection(section.id, updates)}
                        />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="style" className="space-y-4">
              <StyleEditor
                style={template.style}
                onUpdate={updateStyle}
              />
            </TabsContent>

            <TabsContent value="columns" className="space-y-4">
              <ColumnEditor
                sections={template.sections || []}
                onUpdateSection={updateSection}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Live Preview */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>See how your template will look.</CardDescription>
            </CardHeader>
            <CardContent>
              <TemplatePreview template={template} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}