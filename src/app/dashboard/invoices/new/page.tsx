import { InvoiceForm } from "@/components/forms/InvoiceForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewInvoicePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-headline font-bold tracking-tight">Create New Invoice</h1>
        <p className="text-muted-foreground">Fill in the details below to generate a new invoice.</p>
      </div>
      <InvoiceForm />
    </div>
  );
}
