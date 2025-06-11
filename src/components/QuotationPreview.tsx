"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { Quotation, QuotationRow } from "@/lib/types";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import Image from "next/image";

interface QuotationPreviewProps {
  quotation: Quotation;
  showHeader?: boolean;
}

export function QuotationPreview({ quotation, showHeader = true }: QuotationPreviewProps) {
  const formatDate = (date: Date | Timestamp) => {
    if (date instanceof Timestamp) {
      return format(date.toDate(), "dd/MM/yyyy");
    }
    return format(date, "dd/MM/yyyy");
  };

  const renderItemValue = (item: any) => {
    switch (item.type) {
      case 'image':
        return item.value ? (
          <div className="flex justify-center">
            <Image
              src={item.value}
              alt={item.label}
              width={80}
              height={60}
              className="rounded object-cover border"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">No image</span>
        );
      case 'number':
        return typeof item.value === 'number' ? item.value.toFixed(2) : '0.00';
      case 'date':
        return item.value ? format(new Date(item.value), "dd/MM/yyyy") : '';
      default:
        return item.value || '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {showHeader && (
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <h1 className="text-2xl font-bold text-primary">QUOTATION</h1>
                <p className="text-sm text-muted-foreground">#{quotation.quotationNumber}</p>
              </div>
              <Badge variant={quotation.status === 'accepted' ? 'default' : 'secondary'} className="capitalize">
                {quotation.status}
              </Badge>
            </div>
          </CardHeader>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Biller Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">From</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <h3 className="font-semibold">{quotation.billerInfo.businessName}</h3>
            {quotation.billerInfo.gstin && (
              <p className="text-sm">GSTIN: {quotation.billerInfo.gstin}</p>
            )}
            <div className="text-sm text-muted-foreground">
              <p>{quotation.billerInfo.addressLine1}</p>
              {quotation.billerInfo.addressLine2 && <p>{quotation.billerInfo.addressLine2}</p>}
              <p>{quotation.billerInfo.city}, {quotation.billerInfo.state} {quotation.billerInfo.postalCode}</p>
              <p>{quotation.billerInfo.country}</p>
            </div>
            {quotation.billerInfo.phone && (
              <p className="text-sm">Phone: {quotation.billerInfo.phone}</p>
            )}
            {quotation.billerInfo.email && (
              <p className="text-sm">Email: {quotation.billerInfo.email}</p>
            )}
          </CardContent>
        </Card>

        {/* Client Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">To</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <h3 className="font-semibold">{quotation.client.name}</h3>
            {quotation.client.gstin && (
              <p className="text-sm">GSTIN: {quotation.client.gstin}</p>
            )}
            <div className="text-sm text-muted-foreground">
              <p>{quotation.client.addressLine1}</p>
              {quotation.client.addressLine2 && <p>{quotation.client.addressLine2}</p>}
              <p>{quotation.client.city}, {quotation.client.state} {quotation.client.postalCode}</p>
              <p>{quotation.client.country}</p>
            </div>
            {quotation.client.phone && (
              <p className="text-sm">Phone: {quotation.client.phone}</p>
            )}
            {quotation.client.email && (
              <p className="text-sm">Email: {quotation.client.email}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quotation Details */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div>
              <p className="text-sm font-medium">Quotation Date</p>
              <p className="text-sm text-muted-foreground">{formatDate(quotation.quotationDate)}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Valid Until</p>
              <p className="text-sm text-muted-foreground">{formatDate(quotation.validUntil)}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Currency</p>
              <p className="text-sm text-muted-foreground">{quotation.currency}</p>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">{quotation.title}</h3>
            {quotation.description && (
              <p className="text-sm text-muted-foreground">{quotation.description}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quotation Items */}
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {quotation.rows.map((row: QuotationRow, rowIndex: number) => (
              <div key={row.id} className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-2 bg-gray-50 p-3 text-sm font-medium">
                  {row.items.map((item, itemIndex) => (
                    <div
                      key={item.id}
                      className={`col-span-${Math.max(1, Math.floor(item.width / 8.33))}`}
                      style={{ gridColumn: `span ${Math.max(1, Math.floor(item.width / 8.33))}` }}
                    >
                      {item.label}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-12 gap-2 p-3 text-sm">
                  {row.items.map((item, itemIndex) => (
                    <div
                      key={`${item.id}-value`}
                      className={`col-span-${Math.max(1, Math.floor(item.width / 8.33))}`}
                      style={{ gridColumn: `span ${Math.max(1, Math.floor(item.width / 8.33))}` }}
                    >
                      {renderItemValue(item)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>₹{quotation.subTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax (18%):</span>
              <span>₹{quotation.totalTax.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Grand Total:</span>
              <span>₹{quotation.grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes and Terms */}
      {(quotation.notes || quotation.termsAndConditions) && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {quotation.notes && (
              <div>
                <h4 className="font-medium mb-2">Notes</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quotation.notes}</p>
              </div>
            )}
            {quotation.termsAndConditions && (
              <div>
                <h4 className="font-medium mb-2">Terms & Conditions</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quotation.termsAndConditions}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}