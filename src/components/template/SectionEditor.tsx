"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { TemplateSection } from '@/lib/types';

interface SectionEditorProps {
  section: TemplateSection;
  onUpdate: (updates: Partial<TemplateSection>) => void;
}

const AVAILABLE_FIELDS = {
  header: ['invoiceNumber', 'invoiceDate', 'dueDate', 'status'],
  billerInfo: ['businessName', 'addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'gstin', 'phone', 'email'],
  clientInfo: ['name', 'addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'gstin', 'email', 'phone'],
  lineItems: [], // Handled by columns
  totals: ['subTotal', 'totalCGST', 'totalSGST', 'totalIGST', 'grandTotal'],
  notes: ['notes'],
  terms: ['termsAndConditions'],
  payment: ['bankName', 'accountNumber', 'ifscCode', 'upiId'],
  footer: ['thankYouMessage']
};

export function SectionEditor({ section, onUpdate }: SectionEditorProps) {
  const availableFields = AVAILABLE_FIELDS[section.type] || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Section: {section.title}</CardTitle>
        <CardDescription>Customize the appearance and content of this section.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="title">Section Title</Label>
            <Input
              id="title"
              value={section.title || ''}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="Section title"
            />
          </div>
          
          <div>
            <Label htmlFor="fontSize">Font Size</Label>
            <Input
              id="fontSize"
              type="number"
              value={section.fontSize || 12}
              onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) || 12 })}
              min="8"
              max="24"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="textColor">Text Color</Label>
            <div className="flex gap-2">
              <Input
                id="textColor"
                type="color"
                value={section.textColor || '#000000'}
                onChange={(e) => onUpdate({ textColor: e.target.value })}
                className="w-16 h-10 p-1"
              />
              <Input
                value={section.textColor || '#000000'}
                onChange={(e) => onUpdate({ textColor: e.target.value })}
                placeholder="#000000"
                className="flex-1"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="backgroundColor">Background Color</Label>
            <div className="flex gap-2">
              <Input
                id="backgroundColor"
                type="color"
                value={section.backgroundColor || '#ffffff'}
                onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
                className="w-16 h-10 p-1"
              />
              <Input
                value={section.backgroundColor || '#ffffff'}
                onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
                placeholder="#ffffff"
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="fontWeight">Font Weight</Label>
            <Select
              value={section.fontWeight || 'normal'}
              onValueChange={(value: 'normal' | 'bold') => onUpdate({ fontWeight: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="bold">Bold</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="padding">Padding</Label>
            <Input
              id="padding"
              type="number"
              value={section.padding || 10}
              onChange={(e) => onUpdate({ padding: parseInt(e.target.value) || 10 })}
              min="0"
              max="50"
            />
          </div>
          
          <div>
            <Label htmlFor="margin">Margin</Label>
            <Input
              id="margin"
              type="number"
              value={section.margin || 10}
              onChange={(e) => onUpdate({ margin: parseInt(e.target.value) || 10 })}
              min="0"
              max="50"
            />
          </div>
        </div>

        {availableFields.length > 0 && (
          <div>
            <Label>Fields to Display</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {availableFields.map((field) => (
                <div key={field} className="flex items-center space-x-2">
                  <Checkbox
                    id={field}
                    checked={section.fields?.includes(field) || false}
                    onCheckedChange={(checked) => {
                      const currentFields = section.fields || [];
                      const newFields = checked
                        ? [...currentFields, field]
                        : currentFields.filter(f => f !== field);
                      onUpdate({ fields: newFields });
                    }}
                  />
                  <Label htmlFor={field} className="text-sm capitalize">
                    {field.replace(/([A-Z])/g, ' $1').trim()}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}