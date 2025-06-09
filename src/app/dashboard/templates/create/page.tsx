"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Eye, Plus, Trash2, GripVertical, Palette, Layout, Settings } from "lucide-react";
import Link from 'next/link';
import type { InvoiceTemplate, TemplateSection, TemplateColumn, TemplateStyle } from '@/lib/types';
import { DEFAULT_TEMPLATE_SECTIONS, DEFAULT_TEMPLATE_STYLE, DEFAULT_TEMPLATE_COLUMNS } from '@/lib/types';
import { TemplatePreview } from '@/components/TemplatePreview';
import { SectionEditor } from '@/components/template/SectionEditor';
import { StyleEditor } from '@/components/template/StyleEditor';
import { ColumnEditor } from '@/components/template/ColumnEditor';
import { db, getFirebaseAuthInstance } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, type User, type Auth } from 'firebase/auth';

export default function CreateTemplatePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Template state
  const [template, setTemplate] = useState<Partial<InvoiceTemplate>>({
    name: '',
    description: '',
    isPublic: false,
    isDefault: false,
    sections: [...DEFAULT_TEMPLATE_SECTIONS],
    style: { ...DEFAULT_TEMPLATE_STYLE }
  });

  const [activeTab, setActiveTab] = useState('basic');
  const [selectedSection, setSelectedSection] = useState<string>('header');

  useEffect(() => {
    const authInstance: Auth = getFirebaseAuthInstance();
    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveTemplate = async () => {
    if (!currentUser) {
      toast({ title: "Error", description: "You must be logged in to create templates.", variant: "destructive" });
      return;
    }

    if (!template.name?.trim()) {
      toast({ title: "Error", description: "Template name is required.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const templateData = {
        ...template,
        userId: template.isPublic ? null : currentUser.uid,
        usageCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "templates"), templateData);
      
      toast({
        title: "Template Created",
        description: `Template "${template.name}" has been successfully created.`,
      });
      
      router.push(`/dashboard/templates/${docRef.id}`);
    } catch (error) {
      console.error("Error creating template:", error);
      toast({
        title: "Error",
        description: "Failed to create template. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateTemplate = (updates: Partial<InvoiceTemplate>) => {
    setTemplate(prev => ({ ...prev, ...updates }));
  };

  const updateSection = (sectionId: string, updates: Partial<TemplateSection>) => {
    setTemplate(prev => ({
      ...prev,
      sections: prev.sections?.map(section => 
        section.id === sectionId ? { ...section, ...updates } : section
      ) || []
    }));
  };

  const updateStyle = (updates: Partial<TemplateStyle>) => {
    setTemplate(prev => ({
      ...prev,
      style: { ...prev.style, ...updates }
    }));
  };

  const addSection = () => {
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

    setTemplate(prev => ({
      ...prev,
      sections: [...(prev.sections || []), newSection]
    }));
  };

  const removeSection = (sectionId: string) => {
    setTemplate(prev => ({
      ...prev,
      sections: prev.sections?.filter(section => section.id !== sectionId) || []
    }));
  };

  const moveSection = (sectionId: string, direction: 'up' | 'down') => {
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
    
    setTemplate(prev => ({ ...prev, sections }));
  };

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
            <h1 className="text-3xl font-headline font-bold tracking-tight">Create Template</h1>
            <p className="text-muted-foreground">Design a custom invoice template for your business.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled>
            <Eye className="mr-2 h-4 w-4" /> Preview
          </Button>
          <Button onClick={handleSaveTemplate} disabled={loading || !currentUser}>
            {loading ? (
              <>Loading...</>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Save Template
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
                style={template.style || DEFAULT_TEMPLATE_STYLE}
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
              <TemplatePreview template={template as InvoiceTemplate} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}