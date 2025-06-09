"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical } from "lucide-react";
import type { TemplateSection, TemplateColumn } from '@/lib/types';

interface ColumnEditorProps {
  sections: TemplateSection[];
  onUpdateSection: (sectionId: string, updates: Partial<TemplateSection>) => void;
}

export function ColumnEditor({ sections, onUpdateSection }: ColumnEditorProps) {
  const lineItemsSection = sections.find(s => s.type === 'lineItems');
  
  if (!lineItemsSection) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">No line items section found. Add a line items section to configure columns.</p>
        </CardContent>
      </Card>
    );
  }

  const columns = lineItemsSection.columns || [];

  const addColumn = () => {
    const newColumn: TemplateColumn = {
      id: `col_${Date.now()}`,
      label: 'New Column',
      field: 'custom',
      width: 15,
      align: 'left',
      visible: true,
      format: 'text'
    };

    const updatedColumns = [...columns, newColumn];
    onUpdateSection(lineItemsSection.id, { columns: updatedColumns });
  };

  const updateColumn = (columnId: string, updates: Partial<TemplateColumn>) => {
    const updatedColumns = columns.map(col => 
      col.id === columnId ? { ...col, ...updates } : col
    );
    onUpdateSection(lineItemsSection.id, { columns: updatedColumns });
  };

  const removeColumn = (columnId: string) => {
    const updatedColumns = columns.filter(col => col.id !== columnId);
    onUpdateSection(lineItemsSection.id, { columns: updatedColumns });
  };

  const moveColumn = (columnId: string, direction: 'left' | 'right') => {
    const index = columns.findIndex(col => col.id === columnId);
    if (index === -1) return;
    
    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= columns.length) return;
    
    const newColumns = [...columns];
    [newColumns[index], newColumns[newIndex]] = [newColumns[newIndex], newColumns[index]];
    
    onUpdateSection(lineItemsSection.id, { columns: newColumns });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Table Columns</CardTitle>
          <CardDescription>Configure the columns for your line items table.</CardDescription>
        </div>
        <Button onClick={addColumn} size="sm">
          <Plus className="mr-2 h-4 w-4" /> Add Column
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {columns.map((column, index) => (
          <div key={column.id} className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <Badge variant={column.visible ? "default" : "secondary"}>
                  {column.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {column.width}% width
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveColumn(column.id, 'left')}
                  disabled={index === 0}
                >
                  ←
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveColumn(column.id, 'right')}
                  disabled={index === columns.length - 1}
                >
                  →
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeColumn(column.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`label-${column.id}`}>Column Label</Label>
                <Input
                  id={`label-${column.id}`}
                  value={column.label}
                  onChange={(e) => updateColumn(column.id, { label: e.target.value })}
                  placeholder="Column header"
                />
              </div>
              
              <div>
                <Label htmlFor={`field-${column.id}`}>Data Field</Label>
                <Select
                  value={column.field}
                  onValueChange={(value) => updateColumn(column.id, { field: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="index">Row Number</SelectItem>
                    <SelectItem value="productName">Product/Service Name</SelectItem>
                    <SelectItem value="quantity">Quantity</SelectItem>
                    <SelectItem value="rate">Rate</SelectItem>
                    <SelectItem value="discountPercentage">Discount %</SelectItem>
                    <SelectItem value="amount">Amount</SelectItem>
                    <SelectItem value="taxRate">Tax Rate</SelectItem>
                    <SelectItem value="cgst">CGST</SelectItem>
                    <SelectItem value="sgst">SGST</SelectItem>
                    <SelectItem value="igst">IGST</SelectItem>
                    <SelectItem value="totalAmount">Total Amount</SelectItem>
                    <SelectItem value="custom">Custom Field</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor={`width-${column.id}`}>Width (%)</Label>
                <Input
                  id={`width-${column.id}`}
                  type="number"
                  value={column.width}
                  onChange={(e) => updateColumn(column.id, { width: parseInt(e.target.value) || 15 })}
                  min="5"
                  max="50"
                />
              </div>
              
              <div>
                <Label htmlFor={`align-${column.id}`}>Alignment</Label>
                <Select
                  value={column.align}
                  onValueChange={(value: 'left' | 'center' | 'right') => updateColumn(column.id, { align: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor={`format-${column.id}`}>Format</Label>
                <Select
                  value={column.format || 'text'}
                  onValueChange={(value: 'text' | 'number' | 'currency' | 'percentage') => updateColumn(column.id, { format: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="currency">Currency</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  checked={column.visible}
                  onCheckedChange={(checked) => updateColumn(column.id, { visible: checked })}
                />
                <Label>Visible</Label>
              </div>
            </div>
          </div>
        ))}

        {columns.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No columns configured. Add your first column to get started.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}