
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
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
import { GSTIN_REGEX, GST_RATES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { CalendarIcon, PlusCircle, Trash2, Edit2, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, addDoc, doc, getDoc, serverTimestamp, Timestamp, updateDoc, query, where } from 'firebase/firestore';
import { db, getFirebaseAuthInstance } from '@/lib/firebase'; 
import { onAuthStateChanged, type User, type Auth } from "firebase/auth"; 

const lineItemSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  productName: z.string().min(1, "Product/Service name is required."),
  quantity: z.number().min(0.01, "Quantity must be greater than 0."),
  rate: z.number().min(0, "Rate must be non-negative."),
  discountPercentage: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(18), 
});

const billerInfoFormSchema = z.object({
  businessName: z.string().min(1, "Business name required"),
  gstin: z.string().optional().refine(val => !val || GSTIN_REGEX.test(val), "Invalid GSTIN"),
  addressLine1: z.string().min(1, "Address required"),
  addressLine2: z.string().optional().or(z.literal('')),
  city: z.string().min(1, "City required"),
  state: z.string().min(1, "State required"),
  postalCode: z.string().min(1, "Postal code required"),
  country: z.string().min(1, "Country required").default("India"),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email("Invalid business email").optional().or(z.literal('')),
  bankName: z.string().optional().or(z.literal('')),
  accountNumber: z.string().optional().or(z.literal('')),
  ifscCode: z.string().optional().or(z.literal('')),
  upiId: z.string().optional().or(z.literal('')),
  logoUrl: z.string().url("Invalid URL").optional().or(z.literal('')),
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
  billerInfo: billerInfoFormSchema, // This will hold the biller info fetched from user's doc for new invoices
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

interface InvoiceFormProps {
  initialData?: Invoice | null;
}

const defaultBillerInfo: BillerInfo = {
  businessName: "", gstin: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", country: "India",
  phone: "", email: "", bankName: "", accountNumber: "", ifscCode: "", upiId: "", logoUrl: ""
};

export function InvoiceForm({ initialData }: InvoiceFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientData, setSelectedClientData] = useState<Client | null>(null);
  const [loadingClients, setLoadingClients] = useState(!initialData); 
  const [loadingBillerInfo, setLoadingBillerInfo] = useState(!initialData); 
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      invoiceNumber: `INV-${String(new Date().getFullYear())}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random()*1000)+1}`,
      invoiceDate: new Date(),
      dueDate: addDays(new Date(), 15),
      clientId: initialData ? initialData.client.id : searchParams.get('clientId') || "",
      isInterState: initialData ? initialData.isInterState : false,
      lineItems: initialData 
        ? initialData.lineItems.map(item => ({ ...item, id: item.id || crypto.randomUUID() }))
        : [{ id: crypto.randomUUID(), productName: "", quantity: 1, rate: 0, discountPercentage: 0, taxRate: 18 }],
      notes: initialData?.notes || "",
      termsAndConditions: initialData?.termsAndConditions || "Thank you for your business! Payment is due within the specified date.",
      billerInfo: initialData ? initialData.billerInfo : defaultBillerInfo
    },
  });

  useEffect(() => {
    const authInstance: Auth = getFirebaseAuthInstance();
    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
      setCurrentUser(user);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchClientsAndBillerInfoForNewInvoice = useCallback(async (userId: string) => {
    setLoadingClients(true);
    setLoadingBillerInfo(true);
    try {
      // Fetch Clients
      const clientsRef = collection(db, "clients");
      const q = query(clientsRef, where("userId", "==", userId));
      const clientsQuerySnapshot = await getDocs(q);
      const clientsData = clientsQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      setClients(clientsData);

      const preselectedClientId = searchParams.get('clientId');
      if (preselectedClientId && clientsData.length > 0) {
          const client = clientsData.find(c => c.id === preselectedClientId);
          if (client) {
            setSelectedClientData(client);
            form.setValue("clientId", client.id); 
          }
      }

      // Fetch BillerInfo from User's document
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists() && userDocSnap.data()?.billerInfo) {
        form.setValue("billerInfo", userDocSnap.data()?.billerInfo as BillerInfo);
      } else {
        toast({ 
            title: "Biller Info Not Found", 
            description: "Your business information is not set up. Default values will be used. Please update in Settings.", 
            variant: "default" 
        });
        form.setValue("billerInfo", defaultBillerInfo); 
      }
    } catch (error) {
      console.error("Error fetching data for new invoice form:", error);
      toast({
        title: "Error Loading Data",
        description: "Could not load clients or your business info. Please try refreshing.",
        variant: "destructive",
      });
    } finally {
      setLoadingClients(false);
      setLoadingBillerInfo(false);
    }
  }, [form, searchParams, toast]);

  useEffect(() => {
    if (initialData) {
      const invoiceDate = initialData.invoiceDate instanceof Timestamp ? initialData.invoiceDate.toDate() : new Date(initialData.invoiceDate);
      const dueDate = initialData.dueDate instanceof Timestamp ? initialData.dueDate.toDate() : new Date(initialData.dueDate);
      
      form.reset({
        invoiceNumber: initialData.invoiceNumber,
        invoiceDate: invoiceDate,
        dueDate: dueDate,
        clientId: initialData.client.id,
        isInterState: initialData.isInterState,
        lineItems: initialData.lineItems.map(item => ({
          ...item,
          id: item.id || crypto.randomUUID(), 
        })),
        notes: initialData.notes || "",
        termsAndConditions: initialData.termsAndConditions || "Thank you for your business! Payment is due within the specified date.",
        billerInfo: initialData.billerInfo,
      });
      setSelectedClientData(initialData.client);
      setLoadingClients(false); 
      setLoadingBillerInfo(false); 
    } else if (currentUser) { 
      fetchClientsAndBillerInfoForNewInvoice(currentUser.uid);
    }
  }, [initialData, form, currentUser, fetchClientsAndBillerInfoForNewInvoice]);
  
  useEffect(() => {
    const clientToUse = initialData ? initialData.client : selectedClientData;
    const billerStateFromForm = form.getValues("billerInfo.state");

    if (clientToUse && billerStateFromForm) {
      form.setValue("isInterState", clientToUse.state !== billerStateFromForm);
    }
  // form.watch is used here, so including the specific watched field as a dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientData, initialData, form.watch("billerInfo.state"), form.setValue, form.getValues]);


  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  const watchLineItems = form.watch("lineItems");
  const watchIsInterState = form.watch("isInterState");

  const calculateLineItemTotals = (item: z.infer<typeof lineItemSchema>) => {
    const itemAmount = (item.quantity || 0) * (item.rate || 0) * (1 - (item.discountPercentage || 0) / 100);
    const tax = itemAmount * ((item.taxRate || 0) / 100);
    let cgst = 0, sgst = 0, igst = 0;
    if (watchIsInterState) {
      igst = tax;
    } else {
      cgst = tax / 2;
      sgst = tax / 2;
    }
    return { amount: itemAmount, cgst, sgst, igst, totalAmount: itemAmount + tax };
  };
  
  const calculateOverallTotals = () => {
    let subTotal = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;

    watchLineItems.forEach(item => {
      const {amount, cgst, sgst, igst} = calculateLineItemTotals(item);
      subTotal += amount;
      totalCGST += cgst;
      totalSGST += sgst;
      totalIGST += igst;
    });
    const grandTotal = subTotal + totalCGST + totalSGST + totalIGST;
    return { subTotal, totalCGST, totalSGST, totalIGST, grandTotal };
  };

  const totals = calculateOverallTotals();

  async function onSubmit(values: InvoiceFormValues) {
    if (!currentUser) {
      toast({ title: "Authentication Error", description: "You must be logged in to create or update an invoice.", variant: "destructive" });
      return;
    }

    const clientForInvoice = initialData ? initialData.client : selectedClientData;
    if (!clientForInvoice) {
      toast({ title: "Client Not Selected", description: "Please select a client.", variant: "destructive" });
      return;
    }
    
    const billerInfoForInvoice = values.billerInfo; 
    if (!billerInfoForInvoice?.businessName) {
         toast({ title: "Biller Info Missing", description: "Your business information is required. Please check settings.", variant: "destructive" });
        return;
    }

    const processedLineItems = values.lineItems.map(item => {
      const itemTotals = calculateLineItemTotals(item);
      return { ...item, ...itemTotals }; 
    });

    const currentTotals = calculateOverallTotals(); 

    const invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> & { updatedAt: Timestamp; createdAt?: Timestamp } = {
      userId: currentUser.uid,
      invoiceNumber: values.invoiceNumber,
      invoiceDate: Timestamp.fromDate(values.invoiceDate),
      dueDate: Timestamp.fromDate(values.dueDate),
      billerInfo: billerInfoForInvoice,
      client: clientForInvoice, 
      lineItems: processedLineItems,
      notes: values.notes,
      termsAndConditions: values.termsAndConditions,
      isInterState: values.isInterState,
      status: initialData ? initialData.status : 'draft',
      subTotal: currentTotals.subTotal,
      totalCGST: currentTotals.totalCGST,
      totalSGST: currentTotals.totalSGST,
      totalIGST: currentTotals.totalIGST,
      grandTotal: currentTotals.grandTotal,
      updatedAt: serverTimestamp() as Timestamp, 
    };
    
    // form.formState.isSubmitting = true; // This is handled by react-hook-form automatically
    try {
      if (initialData?.id) {
        const invoiceRef = doc(db, "invoices", initialData.id);
        const updatePayload = { ...invoiceData };
        if (initialData.createdAt) { 
             const originalCreatedAt = initialData.createdAt instanceof Timestamp 
                ? initialData.createdAt 
                : Timestamp.fromDate(new Date(initialData.createdAt));
            (updatePayload as Invoice).createdAt = originalCreatedAt;
        }
        await updateDoc(invoiceRef, updatePayload);
        toast({
          title: "Invoice Updated",
          description: `Invoice ${values.invoiceNumber} has been successfully updated.`,
        });
        router.push(`/dashboard/invoices/${initialData.id}`);
      } else {
        const fullInvoiceData = { ...invoiceData, createdAt: serverTimestamp() as Timestamp };
        const docRef = await addDoc(collection(db, "invoices"), fullInvoiceData);
        toast({
          title: "Invoice Created",
          description: `Invoice ${values.invoiceNumber} has been successfully created.`,
        });
        router.push(`/dashboard/invoices/${docRef.id}`);
      }
    } catch (error) {
      console.error("Error saving invoice:", error);
      toast({
        title: "Error",
        description: "Failed to save invoice. Please try again.",
        variant: "destructive",
      });
    } 
    // finally { form.formState.isSubmitting = false; } // This is handled by react-hook-form automatically
  }


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                    <Select 
                      onValueChange={(value) => {
                        if (!initialData) { 
                           field.onChange(value);
                           const client = clients.find(c => c.id === value);
                           setSelectedClientData(client || null);
                        }
                      }} 
                      value={field.value}
                      disabled={loadingAuth || loadingClients || !!initialData} 
                    >
                      <FormControl><SelectTrigger>
                        <SelectValue placeholder={
                            initialData ? initialData.client.name :
                            (loadingAuth || (loadingClients && !initialData)) ? "Loading..." : 
                            (!currentUser && !initialData) ? "Please log in" :
                            "Select a client"
                        } />
                      </SelectTrigger></FormControl>
                      <SelectContent>
                        {initialData ? (
                             <SelectItem value={initialData.client.id} disabled>{initialData.client.name}</SelectItem>
                        ) : (loadingAuth || loadingClients) ? (
                            <SelectItem value="loading" disabled>
                                <div className="flex items-center">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                                </div>
                            </SelectItem>
                        ) : clients.length === 0 ? (
                            <SelectItem value="no-clients" disabled>No clients found. Add one first.</SelectItem>
                        ) : (
                            clients.map(client => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
               <Button type="button" variant="outline" onClick={() => router.push('/dashboard/clients/new')} className="w-full md:w-auto" disabled={!!initialData || !currentUser}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add New Client
                </Button>
            </div>
             <FormField control={form.control} name="isInterState" render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <div className="space-y-1 leading-none">
                    <FormLabel>Inter-State Supply (Different State)?</FormLabel>
                    <FormDescription>Check if client's state is different from yours for IGST calculation. Auto-detected if client is selected.</FormDescription>
                    </div>
                </FormItem>
            )} />
          </CardContent>
        </Card>

        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-headline">Your Information (Biller)</CardTitle>
                <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/dashboard/settings")}>
                    <Edit2 className="mr-2 h-4 w-4"/> Edit Biller Info
                </Button>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
                {(loadingAuth || (loadingBillerInfo && !initialData)) ? (
                  <div className="space-y-2"> <Loader2 className="h-5 w-5 animate-spin" /> <p>Loading your business information...</p></div>
                ) : form.getValues("billerInfo.businessName") ? (
                  <>
                    <p><strong>{form.getValues("billerInfo.businessName")}</strong></p>
                    <p>GSTIN: {form.getValues("billerInfo.gstin") || "Not set"}</p>
                    <p>{form.getValues("billerInfo.addressLine1")}</p>
                    <p>State: {form.getValues("billerInfo.state")}</p>
                  </>
                ) : (
                  <p className="text-destructive">Your business information is not set up. Please update in Settings to ensure correct invoices.</p>
                )}
            </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-headline">Items / Services</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {fields.map((fieldItem, index) => (
              <div key={fieldItem.id} className="grid grid-cols-1 md:grid-cols-[4fr_1fr_2fr_1fr_2fr_minmax(80px,auto)_auto] gap-2 p-3 border rounded-md items-start relative">
                <FormField control={form.control} name={`lineItems.${index}.productName`} render={({ field }) => (
                    <FormItem><FormLabel className={index > 0 ? "sr-only md:not-sr-only": ""}>Product/Service</FormLabel><FormControl><Input placeholder="Item name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name={`lineItems.${index}.quantity`} render={({ field }) => (
                    <FormItem><FormLabel className={index > 0 ? "sr-only md:not-sr-only": ""}>Qty</FormLabel><FormControl><Input type="number" placeholder="1" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name={`lineItems.${index}.rate`} render={({ field }) => (
                    <FormItem><FormLabel className={index > 0 ? "sr-only md:not-sr-only": ""}>Rate (₹)</FormLabel><FormControl><Input type="number" placeholder="100.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name={`lineItems.${index}.discountPercentage`} render={({ field }) => (
                    <FormItem><FormLabel className={index > 0 ? "sr-only md:not-sr-only": ""}>Disc (%)</FormLabel><FormControl><Input type="number" placeholder="0" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name={`lineItems.${index}.taxRate`} render={({ field }) => (
                    <FormItem>
                        <FormLabel className={index > 0 ? "sr-only md:not-sr-only": ""}>Tax Rate</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseFloat(value))} defaultValue={String(field.value)}>
                            <FormControl><SelectTrigger><SelectValue placeholder="GST" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {GST_RATES.map(rate => <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>)} />
                <div className="flex flex-col items-end">
                  <FormLabel className={index > 0 ? "sr-only md:not-sr-only": ""}>Amount (₹)</FormLabel>
                  <p className="w-full text-right font-medium pt-2.5">
                    {calculateLineItemTotals(watchLineItems[index]).amount.toFixed(2)}
                  </p>
                </div>
                 {fields.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive hover:bg-destructive/10 self-end">
                    <Trash2 className="h-4 w-4" /> <span className="sr-only">Remove</span>
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => append({ id: crypto.randomUUID(), productName: "", quantity: 1, rate: 0, discountPercentage: 0, taxRate: 18 })}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Item
            </Button>
          </CardContent>
        </Card>
        
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

        <Card>
            <CardHeader><CardTitle className="font-headline">Additional Information</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea placeholder="Any additional notes for the client..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="termsAndConditions" render={({ field }) => (
                    <FormItem><FormLabel>Terms & Conditions (Optional)</FormLabel><FormControl><Textarea placeholder="Payment terms, warranty info, etc." {...field} /></FormControl><FormMessage /></FormItem>)} />
                
                <Separator />
                <h3 className="text-lg font-medium font-headline">Payment Details (from Biller Info)</h3>
                 <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                    {form.getValues("billerInfo.bankName") && <p><strong>Bank:</strong> {form.getValues("billerInfo.bankName")}</p>}
                    {form.getValues("billerInfo.accountNumber") && <p><strong>A/C No:</strong> {form.getValues("billerInfo.accountNumber")}</p>}
                    {form.getValues("billerInfo.ifscCode") && <p><strong>IFSC:</strong> {form.getValues("billerInfo.ifscCode")}</p>}
                    {form.getValues("billerInfo.upiId") && <p><strong>UPI:</strong> {form.getValues("billerInfo.upiId")}</p>}
                 </div>
                 <FormItem>
                     <FormLabel>Business Logo (Optional)</FormLabel>
                     <FormControl>
                        <div className="flex items-center gap-2">
                           {form.getValues("billerInfo.logoUrl") ? (
                             <p className="text-sm text-muted-foreground">Logo URL: {form.getValues("billerInfo.logoUrl")} (Set in settings)</p>
                           ) : (
                             <p className="text-sm text-muted-foreground">No logo URL set in settings.</p>
                           )}
                        </div>
                     </FormControl>
                     <FormDescription>To add/change logo, update Business Information in Settings. It will appear on the PDF.</FormDescription>
                 </FormItem>
            </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={form.formState.isSubmitting}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            className="bg-primary hover:bg-primary/90" 
            disabled={
                form.formState.isSubmitting || 
                loadingAuth ||
                (loadingClients && !initialData) || 
                (loadingBillerInfo && !initialData) || 
                !currentUser || 
                (!initialData && !form.getValues("billerInfo.businessName"))
            }
          >
            {(form.formState.isSubmitting || loadingAuth || (loadingClients && !initialData) || (loadingBillerInfo && !initialData)) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {form.formState.isSubmitting ? (initialData ? "Saving..." : "Creating Invoice...") : (initialData ? "Save Changes" : "Create Invoice")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
