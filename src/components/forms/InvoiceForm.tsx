"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, Client, LineItem, BillerInfo } from "@/lib/types";
import { mockClients, mockBiller } from "@/lib/types"; // Mock data for now
import { GSTIN_REGEX, INDIAN_STATES, GST_RATES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { CalendarIcon, PlusCircle, Trash2, IndianRupee, Upload, Edit2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const lineItemSchema = z.object({
  id: z.string().optional(), // For existing items
  productName: z.string().min(1, "Product/Service name is required."),
  quantity: z.number().min(0.01, "Quantity must be greater than 0."),
  rate: z.number().min(0, "Rate must be non-negative."),
  discountPercentage: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(18), // Default GST Rate
});

const invoiceFormSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required."),
  invoiceDate: z.date({ required_error: "Invoice date is required."}),
  dueDate: z.date({ required_error: "Due date is required."}),
  clientId: z.string().min(1, "Client is required."),
  isInterState: z.boolean().default(false),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required."),
  notes: z.string().optional(),
  termsAndConditions: z.string().optional(),
  // Biller info would typically come from user profile/settings
  billerBusinessName: z.string().min(1, "Business name required").default(mockBiller.businessName),
  billerGstin: z.string().refine(val => GSTIN_REGEX.test(val), "Invalid GSTIN").default(mockBiller.gstin),
  billerAddress: z.string().min(1, "Address required").default(mockBiller.addressLine1),
  billerState: z.string().min(1, "State required").default(mockBiller.state),
  // Payment details
  bankName: z.string().optional().default(mockBiller.bankName || ""),
  accountNumber: z.string().optional().default(mockBiller.accountNumber || ""),
  ifscCode: z.string().optional().default(mockBiller.ifscCode || ""),
  upiId: z.string().optional().default(mockBiller.upiId || ""),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

interface InvoiceFormProps {
  initialData?: Invoice | null; // For editing
}

export function InvoiceForm({ initialData }: InvoiceFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>(mockClients); // Mock client list

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: initialData
      ? {
          ...initialData,
          clientId: initialData.client.id,
          invoiceDate: new Date(initialData.invoiceDate),
          dueDate: new Date(initialData.dueDate),
          lineItems: initialData.lineItems.map(item => ({...item, id: item.id || crypto.randomUUID()})), // Ensure ID for key
          billerBusinessName: initialData.billerInfo.businessName,
          billerGstin: initialData.billerInfo.gstin,
          billerAddress: initialData.billerInfo.addressLine1,
          billerState: initialData.billerInfo.state,
          bankName: initialData.billerInfo.bankName,
          accountNumber: initialData.billerInfo.accountNumber,
          ifscCode: initialData.billerInfo.ifscCode,
          upiId: initialData.billerInfo.upiId,
        }
      : {
          invoiceNumber: `INV-${String(new Date().getFullYear())}${String(new Date().getMonth() + 1).padStart(2, '0')}-00${Math.floor(Math.random()*100)+1}`, // Example auto-number
          invoiceDate: new Date(),
          dueDate: addDays(new Date(), 15), // Default due date 15 days from now
          clientId: searchParams.get('clientId') || "",
          isInterState: false,
          lineItems: [{ productName: "", quantity: 1, rate: 0, discountPercentage: 0, taxRate: 18 }],
          notes: "",
          termsAndConditions: "Thank you for your business! Payment is due within 15 days.",
          billerBusinessName: mockBiller.businessName,
          billerGstin: mockBiller.gstin,
          billerAddress: mockBiller.addressLine1,
          billerState: mockBiller.state,
          bankName: mockBiller.bankName || "",
          accountNumber: mockBiller.accountNumber || "",
          ifscCode: mockBiller.ifscCode || "",
          upiId: mockBiller.upiId || "",
        },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  const watchLineItems = form.watch("lineItems");
  const watchIsInterState = form.watch("isInterState");

  const calculateTotals = () => {
    let subTotal = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;

    watchLineItems.forEach(item => {
      const itemAmount = (item.quantity || 0) * (item.rate || 0) * (1 - (item.discountPercentage || 0) / 100);
      subTotal += itemAmount;
      const tax = itemAmount * ((item.taxRate || 0) / 100);
      if (watchIsInterState) {
        totalIGST += tax;
      } else {
        totalCGST += tax / 2;
        totalSGST += tax / 2;
      }
    });
    const grandTotal = subTotal + totalCGST + totalSGST + totalIGST;
    return { subTotal, totalCGST, totalSGST, totalIGST, grandTotal };
  };

  const totals = calculateTotals();

  async function onSubmit(values: InvoiceFormValues) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    console.log("Invoice data:", values, totals);
    toast({
      title: initialData ? "Invoice Updated" : "Invoice Created",
      description: `Invoice ${values.invoiceNumber} has been successfully ${initialData ? 'updated' : 'created'}.`,
    });
    router.push("/dashboard/invoices");
  }

  // TODO: Biller Info should be editable in a modal or separate settings page
  // TODO: Client selection should ideally allow adding new client inline or via modal

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Invoice Details & Client */}
        <Card>
          <CardHeader><CardTitle className="font-headline">Invoice Details</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <FormField control={form.control} name="invoiceNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Number*</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="invoiceDate" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Invoice Date*</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date*</FormLabel>
                     <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4 items-end">
              <FormField control={form.control} name="clientId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client*</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {clients.map(client => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
               <Button type="button" variant="outline" onClick={() => router.push('/dashboard/clients/new')} className="w-full md:w-auto">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add New Client
                </Button>
            </div>
             <FormField control={form.control} name="isInterState" render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <div className="space-y-1 leading-none">
                    <FormLabel>Inter-State Supply (Different State)?</FormLabel>
                    <FormDescription>Check if client's state is different from yours for IGST calculation.</FormDescription>
                    </div>
                </FormItem>
            )} />
          </CardContent>
        </Card>

        {/* Biller Information - Placeholder/Readonly */}
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-headline">Your Information (Biller)</CardTitle>
                <Button type="button" variant="ghost" size="sm" onClick={() => alert("Biller info editing coming soon in Settings.")}>
                    <Edit2 className="mr-2 h-4 w-4"/> Edit Biller Info
                </Button>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p><strong>{form.getValues("billerBusinessName")}</strong></p>
                <p>GSTIN: {form.getValues("billerGstin")}</p>
                <p>{form.getValues("billerAddress")}</p>
                <p>State: {form.getValues("billerState")}</p>
                {/* Hidden fields for form submission but displayed here */}
                <FormField control={form.control} name="billerBusinessName" render={({ field }) => <FormItem className="hidden"><FormControl><Input {...field} /></FormControl></FormItem>} />
                <FormField control={form.control} name="billerGstin" render={({ field }) => <FormItem className="hidden"><FormControl><Input {...field} /></FormControl></FormItem>} />
                <FormField control={form.control} name="billerAddress" render={({ field }) => <FormItem className="hidden"><FormControl><Input {...field} /></FormControl></FormItem>} />
                <FormField control={form.control} name="billerState" render={({ field }) => <FormItem className="hidden"><FormControl><Input {...field} /></FormControl></FormItem>} />
            </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader><CardTitle className="font-headline">Items / Services</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 p-3 border rounded-md relative">
                <FormField control={form.control} name={`lineItems.${index}.productName`} render={({ field }) => (
                    <FormItem className="col-span-12 md:col-span-4"><FormLabel className={index > 0 ? "sr-only": ""}>Product/Service</FormLabel><FormControl><Input placeholder="Item name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name={`lineItems.${index}.quantity`} render={({ field }) => (
                    <FormItem className="col-span-6 md:col-span-1"><FormLabel className={index > 0 ? "sr-only": ""}>Qty</FormLabel><FormControl><Input type="number" placeholder="1" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name={`lineItems.${index}.rate`} render={({ field }) => (
                    <FormItem className="col-span-6 md:col-span-2"><FormLabel className={index > 0 ? "sr-only": ""}>Rate (₹)</FormLabel><FormControl><Input type="number" placeholder="100.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name={`lineItems.${index}.discountPercentage`} render={({ field }) => (
                    <FormItem className="col-span-6 md:col-span-1"><FormLabel className={index > 0 ? "sr-only": ""}>Disc (%)</FormLabel><FormControl><Input type="number" placeholder="0" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name={`lineItems.${index}.taxRate`} render={({ field }) => (
                    <FormItem className="col-span-6 md:col-span-2">
                        <FormLabel className={index > 0 ? "sr-only": ""}>Tax Rate</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseFloat(value))} defaultValue={String(field.value)}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select GST Rate" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {GST_RATES.map(rate => <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>)} />
                <div className="col-span-12 md:col-span-2 flex items-end">
                  <p className="w-full text-right font-medium">₹{((watchLineItems[index]?.quantity || 0) * (watchLineItems[index]?.rate || 0) * (1 - (watchLineItems[index]?.discountPercentage || 0)/100)).toFixed(2)}</p>
                </div>
                 {fields.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="absolute top-1 right-1 md:static md:col-span-12 md:mt-2 md:w-full lg:col-span-1 lg:mt-0 lg:self-end text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" /> <span className="md:hidden lg:inline ml-2">Remove</span>
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => append({ productName: "", quantity: 1, rate: 0, discountPercentage: 0, taxRate: 18 })}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Item
            </Button>
          </CardContent>
        </Card>
        
        {/* Totals Display */}
        <Card>
          <CardHeader><CardTitle className="font-headline">Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span>₹{totals.subTotal.toFixed(2)}</span></div>
            {!watchIsInterState && (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">CGST:</span><span>₹{totals.totalCGST.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">SGST:</span><span>₹{totals.totalSGST.toFixed(2)}</span></div>
              </>
            )}
            {watchIsInterState && (
              <div className="flex justify-between"><span className="text-muted-foreground">IGST:</span><span>₹{totals.totalIGST.toFixed(2)}</span></div>
            )}
            <Separator />
            <div className="flex justify-between text-xl font-bold"><span className="text-foreground">Grand Total:</span><span>₹{totals.grandTotal.toFixed(2)}</span></div>
          </CardContent>
        </Card>

        {/* Notes, T&C, Payment Details */}
        <Card>
            <CardHeader><CardTitle className="font-headline">Additional Information</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea placeholder="Any additional notes for the client..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="termsAndConditions" render={({ field }) => (
                    <FormItem><FormLabel>Terms & Conditions (Optional)</FormLabel><FormControl><Textarea placeholder="Payment terms, warranty info, etc." {...field} /></FormControl><FormMessage /></FormItem>)} />
                
                <Separator />
                <h3 className="text-lg font-medium font-headline">Payment Details</h3>
                 <div className="grid md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="bankName" render={({ field }) => (
                        <FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input placeholder="e.g. HDFC Bank" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="accountNumber" render={({ field }) => (
                        <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input placeholder="e.g. 1234567890" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="ifscCode" render={({ field }) => (
                        <FormItem><FormLabel>IFSC Code</FormLabel><FormControl><Input placeholder="e.g. HDFC0000123" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="upiId" render={({ field }) => (
                        <FormItem><FormLabel>UPI ID</FormLabel><FormControl><Input placeholder="e.g. yourbiz@upi" {...field} /></FormControl><FormMessage /></FormItem>)} />
                 </div>
                 <FormItem>
                     <FormLabel>Business Logo (Optional)</FormLabel>
                     <FormControl>
                        <div className="flex items-center gap-2">
                            <Input type="file" className="max-w-xs" disabled /> 
                            <Button type="button" variant="outline" disabled><Upload className="mr-2 h-4 w-4"/> Upload Logo</Button>
                        </div>
                     </FormControl>
                     <FormDescription>Logo upload coming soon. Will appear on PDF.</FormDescription>
                 </FormItem>
            </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={form.formState.isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (initialData ? "Saving..." : "Creating Invoice...") : (initialData ? "Save Changes" : "Create Invoice")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
