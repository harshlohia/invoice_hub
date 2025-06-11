
"use client";

import { QuotationForm } from '@/components/forms/QuotationForm';

export default function NewQuotationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold tracking-tight">Create Quotation</h1>
        <p className="text-muted-foreground">Create a new quotation for your client</p>
      </div>
      <QuotationForm />
    </div>
  );
}
