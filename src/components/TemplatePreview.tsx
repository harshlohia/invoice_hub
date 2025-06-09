"use client";

import type { InvoiceTemplate } from '@/lib/types';
import { Card } from "@/components/ui/card";

interface TemplatePreviewProps {
  template: InvoiceTemplate;
}

export function TemplatePreview({ template }: TemplatePreviewProps) {
  if (!template.sections || !template.style) {
    return (
      <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground">Configure template to see preview</p>
      </div>
    );
  }

  const sortedSections = [...template.sections]
    .filter(section => section.visible)
    .sort((a, b) => a.position - b.position);

  return (
    <div 
      className="w-full bg-white border rounded-lg p-4 text-xs overflow-hidden"
      style={{ 
        backgroundColor: template.style.backgroundColor,
        color: template.style.textColor,
        fontFamily: template.style.fontFamily
      }}
    >
      {sortedSections.map((section) => (
        <div
          key={section.id}
          className="mb-2"
          style={{
            backgroundColor: section.backgroundColor,
            color: section.textColor,
            fontSize: `${(section.fontSize || 12) * 0.7}px`,
            fontWeight: section.fontWeight,
            padding: `${(section.padding || 10) * 0.5}px`,
            margin: `${(section.margin || 10) * 0.3}px 0`
          }}
        >
          {section.title && (
            <div className="font-bold mb-1\" style={{ color: template.style.primaryColor }}>
              {section.title}
            </div>
          )}
          
          {section.type === 'header' && (
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold">INVOICE</div>
                <div className="text-xs opacity-75"># INV-2025-001</div>
              </div>
              <div className="text-right text-xs">
                <div>Date: 08 Jan, 2025</div>
                <div>Due: 23 Jan, 2025</div>
              </div>
            </div>
          )}
          
          {section.type === 'billerInfo' && (
            <div>
              <div className="font-bold">Your Business Name</div>
              <div className="text-xs opacity-75">123 Business Street</div>
              <div className="text-xs opacity-75">City, State - 123456</div>
            </div>
          )}
          
          {section.type === 'clientInfo' && (
            <div>
              <div className="font-bold">Client Name</div>
              <div className="text-xs opacity-75">456 Client Avenue</div>
              <div className="text-xs opacity-75">Client City, State - 654321</div>
            </div>
          )}
          
          {section.type === 'lineItems' && section.columns && (
            <div>
              <div 
                className="grid gap-1 p-1 text-white font-bold"
                style={{ 
                  backgroundColor: template.style.primaryColor,
                  gridTemplateColumns: section.columns
                    .filter(col => col.visible)
                    .map(col => `${col.width}%`)
                    .join(' ')
                }}
              >
                {section.columns.filter(col => col.visible).map(col => (
                  <div key={col.id} className={`text-${col.align}`}>
                    {col.label}
                  </div>
                ))}
              </div>
              <div 
                className="grid gap-1 p-1 text-xs border-b"
                style={{ 
                  gridTemplateColumns: section.columns
                    .filter(col => col.visible)
                    .map(col => `${col.width}%`)
                    .join(' ')
                }}
              >
                <div>1</div>
                <div>Sample Item</div>
                <div className="text-right">2</div>
                <div className="text-right">₹1,000</div>
                <div className="text-right">0%</div>
                <div className="text-right">₹2,000</div>
              </div>
            </div>
          )}
          
          {section.type === 'totals' && (
            <div className="text-right space-y-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹2,000.00</span>
              </div>
              <div className="flex justify-between">
                <span>CGST:</span>
                <span>₹180.00</span>
              </div>
              <div className="flex justify-between">
                <span>SGST:</span>
                <span>₹180.00</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-1" style={{ color: template.style.primaryColor }}>
                <span>Grand Total:</span>
                <span>₹2,360.00</span>
              </div>
            </div>
          )}
          
          {section.type === 'notes' && (
            <div className="text-xs opacity-75">
              Thank you for your business! Payment is due within the specified date.
            </div>
          )}
          
          {section.type === 'terms' && (
            <div className="text-xs opacity-75">
              Payment terms and conditions will appear here.
            </div>
          )}
          
          {section.type === 'payment' && (
            <div className="text-xs opacity-75">
              <div>Bank: Sample Bank</div>
              <div>A/C: 1234567890</div>
              <div>IFSC: SAMP0001234</div>
            </div>
          )}
          
          {section.type === 'footer' && (
            <div className="text-center text-xs" style={{ color: template.style.primaryColor }}>
              Thank you for your business!
            </div>
          )}
        </div>
      ))}
    </div>
  );
}