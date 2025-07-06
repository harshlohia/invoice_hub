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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, Client, LineItem, BillerInfo } from "@/lib/types";
import { GSTIN_REGEX } from "@/lib/constants";
import { isInterStateTax } from "@/lib/types";
import { cn } from "@/lib/utils";
import { InvoicePreview } from "@/components/InvoicePreview";
import { format, addDays } from "date-fns";
import { 
  CalendarIcon, 
  PlusCircle, 
  Trash2, 
  Edit2, 
  Loader2, 
  ArrowRight, 
  ArrowLeft,
  FileText,
  Users,
  Eye,
  CheckCircle2,
  AlertCircle,
  Info,
  Sparkles,
  Calculator,
  CreditCard,
  Building2,
  MapPin,
  Phone,
  Mail,
  Banknote
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, addDoc, doc, getDoc, serverTimestamp, Timestamp, updateDoc, query, where } from 'firebase/firestore';
import { db, getFirebaseAuthInstance } from '@/lib/firebase'; 
import { onAuthStateChanged, type User, type Auth } from "firebase/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

interface ModernInvoiceFormProps {
  initialData?: Invoice | null;
  onStepChange?: (step: number) => void;
}

const defaultBillerInfo: BillerInfo = {
  businessName: "", gstin: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", country: "India",
  phone: "", email: "", bankName: "", accountNumber: "", ifscCode: "", upiId: "", logoUrl: ""
};

const steps = [
  { id: 1, title: "Basic Information", description: "Invoice details and client selection" },
  { id: 2, title: "Items & Services", description: "Add products and services" },
  { id: 3, title: "Review & Create", description: "Preview and finalize your invoice" }
];

export function ModernInvoiceForm({ initialData, onStepChange }: ModernInvoiceFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientData, setSelectedClientData] = useState<Client | null>(null);
  const [loadingClients, setLoadingClients] = useState(!initialData);
  const [loadingBillerInfo, setLoadingBillerInfo] = useState(!initialData);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [generatedInvoiceNumber, setGeneratedInvoiceNumber] = useState<string>(
    initialData?.invoiceNumber || ""
  );

  // Update parent component about step changes
  useEffect(() => {
    onStepChange?.(currentStep);
  }, [currentStep, onStepChange]);

  // Generate invoice number
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

  // Authentication setup
  useEffect(() => {
    const authInstance: Auth = getFirebaseAuthInstance();
    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
      setCurrentUser(user);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch clients and biller info
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

  // Load data on mount
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

  // Auto-detect inter-state tax
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

  // Calculate totals
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
      quantity: 1,
      rate: itemAmount,
      discountPercentage: 0,
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

  // Form submission
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

  // Step navigation
  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Validate current step
  const validateStep = (step: number) => {
    const values = form.getValues();
    switch (step) {
      case 1:
        if (!values.invoiceNumber || !values.invoiceDate || !values.dueDate || !values.clientId) {
          toast({
            title: "Validation Error",
            description: "Please fill in all required fields.",
            variant: "destructive"
          });
          return false;
        }
        return true;
      case 2:
        if (!values.lineItems || values.lineItems.length === 0) {
          toast({
            title: "Validation Error",
            description: "Please add at least one line item.",
            variant: "destructive"
          });
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNextStep = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const isValid = validateStep(currentStep);
    if (isValid) {
      nextStep();
    }
  };

  // Reset form when stable values are generated
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Step 1: Basic Information */}
        {currentStep === 1 && (
          <div className="space-y-8 animate-in slide-in-from-right-5 duration-300">
            {/* Invoice Details Card */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50/50 to-indigo-50/30">
              <CardHeader className="pb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-semibold text-slate-900">Invoice Details</CardTitle>
                    <p className="text-sm text-slate-600 mt-1">Basic information about your invoice</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="invoiceNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-slate-700">Invoice Number *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            className="h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500/20" 
                            placeholder="INV-2024-001"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="invoiceDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-slate-700">Invoice Date *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(
                                  "h-11 w-full justify-start text-left font-normal border-slate-200 hover:border-blue-500",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-3 h-4 w-4 text-slate-500" />
                                {field.value && !isNaN(new Date(field.value).getTime()) 
                                  ? format(new Date(field.value), "PPP") 
                                  : "Select date"
                                }
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-slate-700">Due Date *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(
                                  "h-11 w-full justify-start text-left font-normal border-slate-200 hover:border-blue-500",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-3 h-4 w-4 text-slate-500" />
                                {field.value && !isNaN(new Date(field.value).getTime()) 
                                  ? format(new Date(field.value), "PPP") 
                                  : "Select date"
                                }
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-slate-700">Status *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11 border-slate-200 focus:border-blue-500">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-gray-400 rounded-full mr-2" />
                                Draft
                              </div>
                            </SelectItem>
                            <SelectItem value="sent">
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-blue-400 rounded-full mr-2" />
                                Sent
                              </div>
                            </SelectItem>
                            <SelectItem value="paid">
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-green-400 rounded-full mr-2" />
                                Paid
                              </div>
                            </SelectItem>
                            <SelectItem value="overdue">
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-red-400 rounded-full mr-2" />
                                Overdue
                              </div>
                            </SelectItem>
                            <SelectItem value="cancelled">
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-gray-600 rounded-full mr-2" />
                                Cancelled
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isInterState"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-slate-200 p-4 bg-white">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-medium text-slate-700">
                            Inter-State Supply
                          </FormLabel>
                          <FormDescription className="text-xs text-slate-500">
                            Enable for transactions across state borders
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Client Selection Card */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50/50 to-emerald-50/30">
              <CardHeader className="pb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Users className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-semibold text-slate-900">Client Information</CardTitle>
                      <p className="text-sm text-slate-600 mt-1">Select the client for this invoice</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/dashboard/clients/new')}
                    disabled={!currentUser}
                    className="border-green-200 text-green-700 hover:bg-green-50"
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Client
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-slate-700">Select Client *</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          const client = clients.find(c => c.id === value);
                          setSelectedClientData(client || null);
                        }}
                        value={field.value}
                        disabled={loadingAuth || loadingClients}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11 border-slate-200 focus:border-green-500">
                            <SelectValue
                              placeholder={
                                (loadingAuth || (loadingClients && !initialData))
                                  ? "Loading..."
                                  : (!currentUser && !initialData)
                                  ? "Please log in"
                                  : "Select a client"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(loadingAuth || loadingClients) && !initialData ? (
                            <SelectItem value="loading" disabled>
                              <div className="flex items-center">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Loading...
                              </div>
                            </SelectItem>
                          ) : clients.length === 0 && !initialData ? (
                            <SelectItem value="no-clients" disabled>
                              No clients found. Add one first.
                            </SelectItem>
                          ) : (
                            clients.map(client => (
                              <SelectItem key={client.id} value={client.id}>
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                    {client.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-medium">{client.name}</p>
                                    <p className="text-xs text-slate-500">{client.city}, {client.state}</p>
                                  </div>
                                </div>
                              </SelectItem>
                            ))
                          )}
                          {initialData && (
                            <SelectItem value={initialData.client.id} disabled>
                              {initialData.client.name}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedClientData && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-lg font-bold">
                          {selectedClientData.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900">{selectedClientData.name}</h4>
                          <p className="text-sm text-slate-600">{selectedClientData.city}, {selectedClientData.state}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                        GST: {selectedClientData.defaultTaxRate}%
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-slate-500" />
                          <span className="text-slate-600">{selectedClientData.addressLine1}</span>
                        </div>
                        {selectedClientData.email && (
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4 text-slate-500" />
                            <span className="text-slate-600">{selectedClientData.email}</span>
                          </div>
                        )}
                        {selectedClientData.phone && (
                          <div className="flex items-center space-x-2">
                            <Phone className="h-4 w-4 text-slate-500" />
                            <span className="text-slate-600">{selectedClientData.phone}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="p-3 bg-white/60 rounded-lg">
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Tax Configuration</p>
                          {watchIsInterState ? (
                            <p className="text-sm text-slate-700">
                              <span className="font-medium">IGST:</span> {selectedClientData.defaultTaxRate}% (Inter-state)
                            </p>
                          ) : (
                            <p className="text-sm text-slate-700">
                              <span className="font-medium">CGST:</span> {selectedClientData.defaultTaxRate / 2}% + 
                              <span className="font-medium"> SGST:</span> {selectedClientData.defaultTaxRate / 2}%
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Biller Information Card */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50/50 to-pink-50/30">
              <CardHeader className="pb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Building2 className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-semibold text-slate-900">Your Business Information</CardTitle>
                      <p className="text-sm text-slate-600 mt-1">Information that will appear on the invoice</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/dashboard/settings")}
                    className="border-purple-200 text-purple-700 hover:bg-purple-50"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Info
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(loadingAuth || (loadingBillerInfo && !initialData)) ? (
                  <div className="flex items-center space-x-3 p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
                    <p className="text-slate-600">Loading your business information...</p>
                  </div>
                ) : form.getValues("billerInfo.businessName") ? (
                  <div className="bg-white/60 rounded-lg p-6 space-y-4">
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white text-lg font-bold">
                        {form.getValues("billerInfo.businessName").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900">{form.getValues("billerInfo.businessName")}</h4>
                        <p className="text-sm text-slate-600 mt-1">{form.getValues("billerInfo.addressLine1")}</p>
                        <p className="text-sm text-slate-600">{form.getValues("billerInfo.city")}, {form.getValues("billerInfo.state")}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        {form.getValues("billerInfo.gstin") && (
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-slate-500">GSTIN:</span>
                            <span className="text-slate-700">{form.getValues("billerInfo.gstin")}</span>
                          </div>
                        )}
                        {form.getValues("billerInfo.email") && (
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4 text-slate-500" />
                            <span className="text-slate-700">{form.getValues("billerInfo.email")}</span>
                          </div>
                        )}
                        {form.getValues("billerInfo.phone") && (
                          <div className="flex items-center space-x-2">
                            <Phone className="h-4 w-4 text-slate-500" />
                            <span className="text-slate-700">{form.getValues("billerInfo.phone")}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        {form.getValues("billerInfo.bankName") && (
                          <div className="flex items-center space-x-2">
                            <Banknote className="h-4 w-4 text-slate-500" />
                            <span className="text-slate-700">{form.getValues("billerInfo.bankName")}</span>
                          </div>
                        )}
                        {form.getValues("billerInfo.upiId") && (
                          <div className="flex items-center space-x-2">
                            <CreditCard className="h-4 w-4 text-slate-500" />
                            <span className="text-slate-700">{form.getValues("billerInfo.upiId")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      Your business information is not set up. Please update it in Settings to ensure correct invoices.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Items & Services */}
        {currentStep === 2 && (
          <div className="space-y-8 animate-in slide-in-from-right-5 duration-300">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50/50 to-teal-50/30">
              <CardHeader className="pb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <Sparkles className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-semibold text-slate-900">Items & Services</CardTitle>
                      <p className="text-sm text-slate-600 mt-1">Add products and services to your invoice</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                    {fields.length} {fields.length === 1 ? 'item' : 'items'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {fields.map((fieldItem, index) => (
                    <div
                      key={fieldItem.id}
                      className="group relative bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-all duration-200"
                    >
                      <div className="absolute top-4 left-4 w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {index + 1}
                      </div>
                      
                      <div className="ml-12 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name={`lineItems.${index}.date`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className={index > 0 ? "sr-only md:not-sr-only" : ""}>Date</FormLabel>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className={cn(
                                          "h-11 w-full justify-start text-left font-normal border-slate-200 hover:border-emerald-500",
                                          !field.value && "text-muted-foreground"
                                        )}
                                      >
                                        <CalendarIcon className="mr-3 h-4 w-4 text-slate-500" />
                                        {field.value && field.value instanceof Date && !isNaN(field.value.getTime())
                                          ? format(field.value, "MMM dd")
                                          : "Date"
                                        }
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={field.value}
                                      onSelect={field.onChange}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`lineItems.${index}.productName`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className={index > 0 ? "sr-only md:not-sr-only" : ""}>
                                  Product/Service
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Enter item name"
                                    {...field}
                                    className="h-11 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex space-x-2">
                            <FormField
                              control={form.control}
                              name={`lineItems.${index}.amount`}
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel className={index > 0 ? "sr-only md:not-sr-only" : ""}>
                                    Amount (Rs.)
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      placeholder="0.00"
                                      {...field}
                                      onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                      className="h-11 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            {fields.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => remove(index)}
                                className="mt-8 h-11 w-11 text-red-500 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {/* Item calculation preview */}
                        {watchLineItems[index]?.amount > 0 && (
                          <div className="bg-slate-50 rounded-lg p-4 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600">Item Total (incl. tax):</span>
                              <span className="font-medium text-slate-900">
                                Rs.{calculateLineItemTotals(watchLineItems[index]).totalAmount.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => append({ id: generateStableId(), productName: "", amount: 0, date: new Date() })}
                  className="w-full h-12 border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400"
                >
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Add Another Item
                </Button>
              </CardContent>
            </Card>

            {/* Summary Card */}
            <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50/50 to-indigo-50/30">
              <CardHeader className="pb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calculator className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-semibold text-slate-900">Invoice Summary</CardTitle>
                    <p className="text-sm text-slate-600 mt-1">Calculated totals and taxes</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-white rounded-xl p-6 space-y-4">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-medium text-slate-900">Rs.{totals.subTotal.toFixed(2)}</span>
                  </div>
                  
                  {!watchIsInterState && (
                    <>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-600">CGST ({((selectedClientData?.defaultTaxRate || 18) / 2)}%):</span>
                        <span className="font-medium text-slate-900">Rs.{totals.totalCGST.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-600">SGST ({((selectedClientData?.defaultTaxRate || 18) / 2)}%):</span>
                        <span className="font-medium text-slate-900">Rs.{totals.totalSGST.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  
                  {watchIsInterState && (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-600">IGST ({selectedClientData?.defaultTaxRate || 18}%):</span>
                      <span className="font-medium text-slate-900">Rs.{totals.totalIGST.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <Separator className="my-4" />
                  
                  <div className="flex justify-between items-center py-2">
                    <span className="text-xl font-semibold text-slate-900">Grand Total:</span>
                    <span className="text-2xl font-bold text-blue-600">Rs.{totals.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Additional Information */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <FileText className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-semibold text-slate-900">Additional Information</CardTitle>
                    <p className="text-sm text-slate-600 mt-1">Optional notes and terms</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-slate-700">Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any additional notes for the client..."
                          {...field}
                          className="min-h-[100px] border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-slate-500">
                        These notes will appear on the invoice
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="termsAndConditions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-slate-700">Terms & Conditions (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Payment terms, warranty info, etc."
                          {...field}
                          className="min-h-[100px] border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                        />
                      </FormControl>
                      <FormDescription className="text-xs text-slate-500">
                        Legal terms and payment conditions
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Review & Preview */}
        {currentStep === 3 && (
          <div className="space-y-8 animate-in slide-in-from-right-5 duration-300">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50/50 to-emerald-50/30">
              <CardHeader className="pb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Eye className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-semibold text-slate-900">Invoice Preview</CardTitle>
                    <p className="text-sm text-slate-600 mt-1">Review your invoice before creating</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-white rounded-xl p-6 border border-slate-200">
                  <InvoicePreview
                    showActions={false}
                    invoice={{
                      id: watchedValues.invoiceNumber || "PREVIEW",
                      invoiceNumber: watchedValues.invoiceNumber || "PREVIEW",
                      invoiceDate: watchedValues.invoiceDate || new Date(),
                      dueDate: watchedValues.dueDate || addDays(new Date(), 15),
                      billerInfo: watchedValues.billerInfo || defaultBillerInfo,
                      client: selectedClientData || {
                        id: "preview",
                        name: "Select a client",
                        email: "",
                        phone: "",
                        addressLine1: "",
                        addressLine2: "",
                        city: "",
                        state: "",
                        postalCode: "",
                        country: "India",
                        gstin: "",
                        defaultTaxRate: 18,
                        userId: "",
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now()
                      },
                      lineItems: watchedValues.lineItems?.map(item => ({
                        ...item,
                        ...calculateLineItemTotals(item)
                      })) || [],
                      notes: watchedValues.notes || "",
                      termsAndConditions: watchedValues.termsAndConditions || "",
                      isInterState: watchedValues.isInterState || false,
                      status: watchedValues.status || 'draft',
                      currency: watchedValues.currency || "INR",
                      subTotal: totals.subTotal,
                      totalCGST: totals.totalCGST,
                      totalSGST: totals.totalSGST,
                      totalIGST: totals.totalIGST,
                      grandTotal: totals.grandTotal,
                      userId: currentUser?.uid || "",
                      createdAt: Timestamp.now(),
                      updatedAt: Timestamp.now()
                    } as Invoice}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Final Review Checklist */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-semibold text-slate-900">Final Review</CardTitle>
                    <p className="text-sm text-slate-600 mt-1">Ensure everything looks correct</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-sm text-slate-700">Invoice details completed</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      {selectedClientData ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-amber-500" />
                      )}
                      <span className="text-sm text-slate-700">Client selected</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      {watchLineItems?.length > 0 ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-amber-500" />
                      )}
                      <span className="text-sm text-slate-700">Items added</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      {form.getValues("billerInfo.businessName") ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-amber-500" />
                      )}
                      <span className="text-sm text-slate-700">Business info available</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Info className="h-5 w-5 text-blue-500" />
                      <span className="text-sm text-slate-700">Total: Rs.{totals.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation Footer */}
        <div className="flex items-center justify-between pt-8 border-t border-slate-200 bg-white">
          <div className="flex items-center space-x-4">
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                className="h-11 px-6"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push('/dashboard/invoices')}
              className="h-11 px-6 text-slate-600 hover:text-slate-900"
            >
              Cancel
            </Button>
            
            {currentStep < 3 ? (
              <Button
                type="button"
                onClick={handleNextStep}
                className="h-11 px-8 bg-blue-600 hover:bg-blue-700"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="h-11 px-8 bg-green-600 hover:bg-green-700 relative z-10"
                style={{ minWidth: '160px' }}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {initialData ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {initialData ? "Update Invoice" : "Create Invoice"}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}