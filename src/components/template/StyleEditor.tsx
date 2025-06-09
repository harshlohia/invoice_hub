"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TemplateStyle } from '@/lib/types';

interface StyleEditorProps {
  style: TemplateStyle;
  onUpdate: (updates: Partial<TemplateStyle>) => void;
}

export function StyleEditor({ style, onUpdate }: StyleEditorProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Colors</CardTitle>
          <CardDescription>Set the color scheme for your template.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primaryColor"
                  type="color"
                  value={style.primaryColor}
                  onChange={(e) => onUpdate({ primaryColor: e.target.value })}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={style.primaryColor}
                  onChange={(e) => onUpdate({ primaryColor: e.target.value })}
                  placeholder="#3F51B5"
                  className="flex-1"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="secondaryColor">Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="secondaryColor"
                  type="color"
                  value={style.secondaryColor}
                  onChange={(e) => onUpdate({ secondaryColor: e.target.value })}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={style.secondaryColor}
                  onChange={(e) => onUpdate({ secondaryColor: e.target.value })}
                  placeholder="#f8f9fa"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="backgroundColor">Background Color</Label>
              <div className="flex gap-2">
                <Input
                  id="backgroundColor"
                  type="color"
                  value={style.backgroundColor}
                  onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={style.backgroundColor}
                  onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
                  placeholder="#ffffff"
                  className="flex-1"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="textColor">Text Color</Label>
              <div className="flex gap-2">
                <Input
                  id="textColor"
                  type="color"
                  value={style.textColor}
                  onChange={(e) => onUpdate({ textColor: e.target.value })}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={style.textColor}
                  onChange={(e) => onUpdate({ textColor: e.target.value })}
                  placeholder="#212529"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Typography</CardTitle>
          <CardDescription>Configure fonts and text styling.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fontFamily">Font Family</Label>
              <Select
                value={style.fontFamily}
                onValueChange={(value) => onUpdate({ fontFamily: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Helvetica">Helvetica</SelectItem>
                  <SelectItem value="Arial">Arial</SelectItem>
                  <SelectItem value="Times">Times</SelectItem>
                  <SelectItem value="Courier">Courier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="fontSize">Base Font Size</Label>
              <Input
                id="fontSize"
                type="number"
                value={style.fontSize}
                onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) || 10 })}
                min="8"
                max="16"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Layout</CardTitle>
          <CardDescription>Configure layout and spacing options.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="logoPosition">Logo Position</Label>
              <Select
                value={style.logoPosition}
                onValueChange={(value: 'left' | 'center' | 'right') => onUpdate({ logoPosition: value })}
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
              <Label htmlFor="logoSize">Logo Size</Label>
              <Select
                value={style.logoSize}
                onValueChange={(value: 'small' | 'medium' | 'large') => onUpdate({ logoSize: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="spacing">Spacing</Label>
              <Select
                value={style.spacing}
                onValueChange={(value: 'compact' | 'normal' | 'spacious') => onUpdate({ spacing: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">Compact</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="spacious">Spacious</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="borderStyle">Border Style</Label>
            <Select
              value={style.borderStyle}
              onValueChange={(value: 'none' | 'minimal' | 'full') => onUpdate({ borderStyle: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Borders</SelectItem>
                <SelectItem value="minimal">Minimal Borders</SelectItem>
                <SelectItem value="full">Full Borders</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}