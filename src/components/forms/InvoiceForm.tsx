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
import { GSTIN_REGEX } from "@/lib/constants";
import { isInterStateTax } from "@/lib/types";
import { cn } from "@/lib/utils";
import { InvoicePreview } from "@/components/InvoicePreview";
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
  amount: z.number().min(0, "Amount must be non-negative."),
  date: z.date().optional(),
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
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).default('draft'),
  isInterState: z.boolean().default(false),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required."),
  notes: z.string().optional(),
  termsAndConditions: z.string().optional(),
  billerInfo: billerInfoFormSchema, 
  currency: z.string().default("INR"),
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
  const [generatedInvoiceNumber, setGeneratedInvoiceNumber] = useState<string>(
    initialData?.invoiceNumber || ""
  );

  useEffect(() => {
    if (!initialData?.invoiceNumber && generatedInvoiceNumber === "") {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const randomNum = Math.floor(Math.random() * 1000) + 1;
      setGeneratedInvoiceNumber(`INV-${year}${month}-${randomNum}`);
    }
  }, [initialData?.invoiceNumber, generatedInvoiceNumber]);

  const [initialLineItems, setInitialLineItems] = useState<any[]>(
    initialData?.lineItems || []
  );

  useEffect(() => {
    if (initialData?.lineItems) {
      setInitialLineItems(initialData.lineItems.map(item => ({
        id: item.id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        productName: item.productName,
        amount: item.amount,
        date: item.date ? new Date(item.date) : new Date()
      })));
    } else if (initialLineItems.length === 0) {
      setInitialLineItems([{ 
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, 
        productName: "", 
        amount: 0, 
        date: new Date() 
      }]);
    }
  }, [initialData?.lineItems]);

  const generateStableId = useCallback(() => {
    return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    mode: "onChange",
    defaultValues: {
      invoiceNumber: initialData?.invoiceNumber || "",
      invoiceDate: initialData?.invoiceDate ? (initialData.invoiceDate instanceof Timestamp ? initialData.invoiceDate.toDate() : new Date(initialData.invoiceDate)) : new Date(),
      dueDate: initialData?.dueDate ? (initialData.dueDate instanceof Timestamp ? initialData.dueDate.toDate() : new Date(initialData.dueDate)) : addDays(new Date(), 15),
      clientId: initialData ? initialData.client.id : searchParams.get('clientId') || "",
      status: initialData ? initialData.status : 'draft',
      isInterState: initialData ? initialData.isInterState : false,
      lineItems: initialData?.lineItems || [],
      notes: initialData?.notes || "",
      termsAndConditions: initialData?.termsAndConditions || "Thank you for your business! Payment is due within the specified date.",
      billerInfo: initialData ? initialData.billerInfo : defaultBillerInfo,
      currency: initialData?.currency || "INR",
    },
  });

  // Watch form values for real-time preview updates
  const watchedValues = form.watch();

  // Reset form values once stable values are generated
  useEffect(() => {
    if (generatedInvoiceNumber && initialLineItems.length > 0) {
      form.reset({
        invoiceNumber: generatedInvoiceNumber,
        invoiceDate: initialData?.invoiceDate ? (initialData.invoiceDate instanceof Timestamp ? initialData.invoiceDate.toDate() : new Date(initialData.invoiceDate)) : new Date(),
        dueDate: initialData?.dueDate ? (initialData.dueDate instanceof Timestamp ? initialData.dueDate.toDate() : new Date(initialData.dueDate)) : addDays(new Date(), 15),
        clientId: initialData ? initialData.client.id : searchParams.get('clientId') || "",
        status: initialData ? initialData.status : 'draft',
        isInterState: initialData ? initialData.isInterState : false,
        lineItems: initialLineItems,
        notes: initialData?.notes || "",
        termsAndConditions: initialData?.termsAndConditions || "Thank you for your business! Payment is due within the specified date.",
        billerInfo: initialData ? initialData.billerInfo : defaultBillerInfo,
        currency: initialData?.currency || "INR",
      });
    }
  }, [generatedInvoiceNumber, initialLineItems, form, initialData, searchParams, defaultBillerInfo]);

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

      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists() && userDocSnap.data()?.billerInfo) {
        form.setValue("billerInfo", userDocSnap.data()?.billerInfo as BillerInfo);
      } else {
        toast({ 
            title: "Biller Info Recommended", 
            description: "Your business information isn't fully set up. Please update it in Settings for complete invoices.", 
            variant: "default",
            duration: 5000,
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
        status: initialData.status,
        isInterState: initialData.isInterState,
        lineItems: initialData.lineItems.map(item => ({
          id: item.id || generateStableId(),
          productName: item.productName,
          amount: item.amount,
          date: item.date ? new Date(item.date) : new Date(),
        })),
        notes: initialData.notes || "",
        termsAndConditions: initialData.termsAndConditions || "Thank you for your business! Payment is due within the specified date.",
        billerInfo: initialData.billerInfo,
        currency: initialData.currency || "INR",
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
      const isInterState = isInterStateTax(billerStateFromForm, clientToUse.state);
      form.setValue("isInterState", isInterState);
    }
  }, [selectedClientData, initialData, form.watch("billerInfo.state"), form.setValue, form.getValues]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  const watchLineItems = form.watch("lineItems");
  const watchIsInterState = form.watch("isInterState");

  const calculateLineItemTotals = (item: z.infer<typeof lineItemSchema>) => {
    const clientTaxRate = selectedClientData?.defaultTaxRate || 18;
    const itemAmount = item.amount || 0;
    const tax = itemAmount * (clientTaxRate / 100);
    let cgst = 0, sgst = 0, igst = 0;
    if (watchIsInterState) {
      igst = tax;
    } else {
      cgst = tax / 2;
      sgst = tax / 2;
    }
    return { 
      amount: itemAmount, 
      cgst, 
      sgst, 
      igst, 
      totalAmount: itemAmount + tax,
      quantity: 1, // Default quantity
      rate: itemAmount, // Rate same as amount
      discountPercentage: 0, // Default discount
      taxRate: clientTaxRate
    };
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

    const clientForInvoice = initialData ? initialData.client : clients.find(c => c.id === values.clientId);
    if (!clientForInvoice) {
      toast({ title: "Client Not Selected", description: "Please select a client.", variant: "destructive" });
      return;
    }
    
    const billerInfoForInvoice = {
      ...values.billerInfo,
      gstin: values.billerInfo?.gstin || ""
    }; 
    if (!billerInfoForInvoice?.businessName && !initialData?.billerInfo?.businessName) {
         toast({ title: "Biller Info Missing", description: "Your business information is required. Please check settings.", variant: "destructive" });
        return;
    }

    const processedLineItems = values.lineItems.map(item => {
      const itemTotals = calculateLineItemTotals(item);
      return { 
        ...item, 
        ...itemTotals,
        date: item.date || new Date()
      }; 
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
      status: values.status, 
      currency: values.currency || "INR",
      subTotal: currentTotals.subTotal,
      totalCGST: currentTotals.totalCGST,
      totalSGST: currentTotals.totalSGST,
      totalIGST: currentTotals.totalIGST,
      grandTotal: currentTotals.grandTotal,
      updatedAt: serverTimestamp() as Timestamp, 
    };
    
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
                            {field.value && !isNaN(new Date(field.value).getTime()) ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
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
                            {field.value && !isNaN(new Date(field.value).getTime()) ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
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
                        field.onChange(value);
                        const client = clients.find(c => c.id === value);
                        setSelectedClientData(client || null);
                      }} 
                      value={field.value}
                      disabled={loadingAuth || loadingClients } 
                    >
                      <FormControl><SelectTrigger>
                        <SelectValue placeholder={
                            (loadingAuth || (loadingClients && !initialData)) ? "Loading..." : 
                            (!currentUser && !initialData) ? "Please log in" :
                            "Select a client"
                        } />
                      </SelectTrigger></FormControl>
                      <SelectContent>
                        {(loadingAuth || loadingClients) && !initialData ? (
                            <SelectItem value="loading\" disabled>
                                <div className="flex items-center">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                                </div>
                            </SelectItem>
                        ) : clients.length === 0 && !initialData ? (
                            <SelectItem value="no-clients" disabled>No clients found. Add one first.</SelectItem>
                        ) : (
                            clients.map(client => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)
                        )}
                         {initialData && <SelectItem value={initialData.client.id} disabled>{initialData.client.name}</SelectItem>}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
               <Button type="button" variant="outline" onClick={() => router.push('/dashboard/clients/new')} className="w-full md:w-auto" disabled={!currentUser}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add New Client
                </Button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Status*</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger>
                            <SelectValue placeholder="Select status" />
                        </SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="sent">Sent</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="isInterState" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 shadow-sm mt-auto h-10">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <div className="space-y-1 leading-none">
                        <FormLabel>Inter-State Supply?</FormLabel>
                        </div>
                    </FormItem>
                )} />
            </div>
            {selectedClientData && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Client Tax Configuration</h4>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-blue-700">
                      <span className="font-semibold">{selectedClientData.name}</span> ({selectedClientData.state})
                    </p>
                    <p className="text-blue-600">
                      Default GST Rate: <span className="font-semibold">{selectedClientData.defaultTaxRate}%</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-700">Tax Breakdown:</p>
                    {watchIsInterState ? (
                      <p className="text-blue-600">IGST: {selectedClientData.defaultTaxRate}% (Inter-state)</p>
                    ) : (
                      <p className="text-blue-600">
                        CGST: {selectedClientData.defaultTaxRate / 2}% + SGST: {selectedClientData.defaultTaxRate / 2}% (Intra-state)
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  This rate will be automatically applied to all line items. You can change this in the client settings.
                </p>
              </div>
            )}
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
                  <p className="text-destructive-foreground bg-destructive/80 p-2 rounded-md">Your business information is not set up. Please update in Settings to ensure correct invoices.</p>
                )}
            </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-headline">Items / Services</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {fields.map((fieldItem, index) => (
              <div key={fieldItem.id} className="grid grid-cols-1 md:grid-cols-[50px_150px_1fr_200px_auto] gap-2 p-3 border rounded-md items-start relative">
                <div className="text-center font-medium text-sm pt-2">
                  {index + 1}
                </div>
                <FormField control={form.control} name={`lineItems.${index}.date`} render={({ field }) => (
                    <FormItem>
                      <FormLabel className={index > 0 ? "sr-only md:not-sr-only": ""}>Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                              {field.value && field.value instanceof Date && !isNaN(field.value.getTime()) ? format(field.value, "PPP") : <span>Date</span>}
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
                  )} />
                <FormField control={form.control} name={`lineItems.${index}.productName`} render={({ field }) => (
                    <FormItem><FormLabel className={index > 0 ? "sr-only md:not-sr-only": ""}>Product/Service</FormLabel><FormControl><Input placeholder="Item name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name={`lineItems.${index}.amount`} render={({ field }) => (
                    <FormItem><FormLabel className={index > 0 ? "sr-only md:not-sr-only": ""}>Amount (Rs.)</FormLabel><FormControl><Input type="number" placeholder="100.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl><FormMessage /></FormItem>)} />
                 {fields.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive hover:bg-destructive/10 self-end">
                    <Trash2 className="h-4 w-4" /> <span className="sr-only">Remove</span>
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => append({ id: generateStableId(), productName: "", amount: 0, date: new Date() })}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Item
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle className="font-headline">Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span>Rs. {totals.subTotal.toFixed(2)}</span></div>
            {!watchIsInterState && (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">CGST ({((selectedClientData?.defaultTaxRate || 18) / 2)}%):</span><span>Rs. {totals.totalCGST.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">SGST ({((selectedClientData?.defaultTaxRate || 18) / 2)}%):</span><span>Rs. {totals.totalSGST.toFixed(2)}</span></div>
              </>
            )}
            {watchIsInterState && (
              <div className="flex justify-between"><span className="text-muted-foreground">IGST ({selectedClientData?.defaultTaxRate || 18}%):</span><span>Rs. {totals.totalIGST.toFixed(2)}</span></div>
            )}
            <Separator />
            <div className="flex justify-between text-xl font-bold"><span className="text-foreground">Grand Total:</span><span>Rs. {totals.grandTotal.toFixed(2)}</span></div>
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

        {/* Invoice Preview Section */}
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="text-xl font-headline">Invoice Preview</CardTitle>
                <p className="text-sm text-muted-foreground">Preview how your invoice will look before creating it</p>
            </CardHeader>
            <CardContent>
                <InvoicePreview 
                    showActions={false}
                    invoice={{
                        id: watchedValues.invoiceNumber || "PREVIEW",
                        invoiceNumber: watchedValues.invoiceNumber || "PREVIEW",
                        invoiceDate: watchedValues.invoiceDate || new Date(),
                        dueDate: watchedValues.dueDate || addDays(new Date(), 30),
                        status: watchedValues.status || "draft",
                        isInterState: watchedValues.isInterState || false,
                        client: selectedClientData || {
                            id: "",
                            name: "Select a client",
                            gstin: "",
                            addressLine1: "",
                            addressLine2: "",
                            city: "",
                            state: "",
                            postalCode: "",
                            country: "India",
                            email: "",
                            phone: "",
                            userId: "",
                            defaultTaxRate: 18
                        },
                        lineItems: (watchedValues.lineItems || []).map(item => ({
                            ...item,
                            cgst: 0,
                            sgst: 0,
                            igst: 0,
                            totalAmount: item.amount || 0,
                            taxRate: 18,
                            quantity: 1,
                            rate: item.amount || 0,
                            discountPercentage: 0
                        })),
                        subTotal: watchedValues.lineItems?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0,
                        totalCGST: (() => {
                            const subtotal = watchedValues.lineItems?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
                            const isInterState = watchedValues.isInterState || false;
                            return isInterState ? 0 : subtotal * 0.09;
                        })(),
                        totalSGST: (() => {
                            const subtotal = watchedValues.lineItems?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
                            const isInterState = watchedValues.isInterState || false;
                            return isInterState ? 0 : subtotal * 0.09;
                        })(),
                        totalIGST: (() => {
                            const subtotal = watchedValues.lineItems?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
                            const isInterState = watchedValues.isInterState || false;
                            return isInterState ? subtotal * 0.18 : 0;
                        })(),
                        grandTotal: (() => {
                            const subtotal = watchedValues.lineItems?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
                            return subtotal * 1.18;
                        })(),
                        notes: watchedValues.notes || "",
                        termsAndConditions: watchedValues.termsAndConditions || "",
                        billerInfo: {
                            businessName: watchedValues.billerInfo?.businessName || "",
                            gstin: watchedValues.billerInfo?.gstin || "",
                            addressLine1: watchedValues.billerInfo?.addressLine1 || "",
                            addressLine2: watchedValues.billerInfo?.addressLine2,
                            city: watchedValues.billerInfo?.city || "",
                            state: watchedValues.billerInfo?.state || "",
                            postalCode: watchedValues.billerInfo?.postalCode || "",
                            country: watchedValues.billerInfo?.country || "India",
                            email: watchedValues.billerInfo?.email,
                            phone: watchedValues.billerInfo?.phone,
                            bankName: watchedValues.billerInfo?.bankName,
                            accountNumber: watchedValues.billerInfo?.accountNumber,
                            ifscCode: watchedValues.billerInfo?.ifscCode,
                            upiId: watchedValues.billerInfo?.upiId,
                            logoUrl: watchedValues.billerInfo?.logoUrl
                        },
                        userId: currentUser?.uid || "",
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now()
                    }}
                />
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