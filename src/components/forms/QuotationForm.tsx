
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { Quotation, Client, BillerInfo, QuotationRow, QuotationItem } from "@/lib/types";
import { QuotationPreview } from "@/components/QuotationPreview";
import { cn } from "@/lib/utils";
import { ImageUpload } from "@/components/ui/image-upload";
import { format, addDays } from "date-fns";
import { CalendarIcon, PlusCircle, Trash2, GripVertical, Image, Type, Hash, Calendar as CalendarClock, Loader2, DollarSign } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, addDoc, doc, getDoc, serverTimestamp, Timestamp, query, where, updateDoc } from 'firebase/firestore';
import { db, getFirebaseAuthInstance } from '@/lib/firebase'; 
import { onAuthStateChanged, type User, type Auth } from "firebase/auth";

const quotationItemSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  type: z.enum(['text', 'image', 'number', 'date', 'amount']),
  label: z.string().min(1, "Label is required"),
  value: z.union([z.string(), z.number(), z.date()]),
  width: z.number().min(1).max(100).default(25),
  order: z.number().default(0),
});

const quotationRowSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  items: z.array(quotationItemSchema).min(1, "At least one item required"),
  order: z.number().default(0),
});

const quotationFormSchema = z.object({
  quotationNumber: z.string().min(1, "Quotation number is required"),
  quotationDate: z.date({ required_error: "Quotation date is required" }),
  validUntil: z.date({ required_error: "Valid until date is required" }),
  clientId: z.string().min(1, "Client is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  rows: z.array(quotationRowSchema).min(1, "At least one row is required"),
  notes: z.string().optional(),
  termsAndConditions: z.string().optional(),
  status: z.enum(['draft', 'sent', 'accepted', 'declined', 'expired']).default('draft'),
  currency: z.string().default("INR"),
});

type QuotationFormValues = z.infer<typeof quotationFormSchema>;

interface QuotationFormProps {
  initialData?: Quotation | null;
  isEdit?: boolean;
}

const defaultBillerInfo: BillerInfo = {
  businessName: "", gstin: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", country: "India",
  phone: "", email: "", bankName: "", accountNumber: "", ifscCode: "", upiId: "", logoUrl: ""
};

const itemTypeIcons = {
  text: Type,
  image: Image,
  number: Hash,
  date: CalendarClock,
  amount: DollarSign,
};

export function QuotationForm({ initialData, isEdit = false }: QuotationFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientData, setSelectedClientData] = useState<Client | null>(null);
  const [loadingClients, setLoadingClients] = useState(!initialData);
  const [loadingBillerInfo, setLoadingBillerInfo] = useState(!initialData);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [billerInfo, setBillerInfo] = useState<BillerInfo>(defaultBillerInfo);

  const form = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationFormSchema),
    defaultValues: {
      quotationNumber: initialData?.quotationNumber || `QUO-${String(new Date().getFullYear())}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random()*1000)+1}`,
      quotationDate: initialData?.quotationDate ? (initialData.quotationDate instanceof Timestamp ? initialData.quotationDate.toDate() : new Date(initialData.quotationDate)) : new Date(),
      validUntil: initialData?.validUntil ? (initialData.validUntil instanceof Timestamp ? initialData.validUntil.toDate() : new Date(initialData.validUntil)) : addDays(new Date(), 30),
      clientId: initialData ? initialData.client.id : searchParams.get('clientId') || "",
      title: initialData?.title || "",
      description: initialData?.description || "",
      rows: initialData?.rows || [
        {
          id: crypto.randomUUID(),
          order: 0,
          items: [
            { id: crypto.randomUUID(), type: 'text', label: 'Description', value: '', width: 50, order: 0 },
            { id: crypto.randomUUID(), type: 'number', label: 'Quantity', value: 1, width: 15, order: 1 },
            { id: crypto.randomUUID(), type: 'number', label: 'Rate', value: 0, width: 20, order: 2 },
            { id: crypto.randomUUID(), type: 'amount', label: 'Amount', value: 0, width: 15, order: 3 },
          ]
        }
      ],
      notes: initialData?.notes || "",
      termsAndConditions: initialData?.termsAndConditions || "This quotation is valid for 30 days from the date of issue.",
      status: initialData?.status || 'draft',
      currency: initialData?.currency || "INR",
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

  const fetchClientsAndBillerInfo = useCallback(async (userId: string) => {
    setLoadingClients(true);
    setLoadingBillerInfo(true);
    try {
      const clientsRef = collection(db, "clients");
      const q = query(clientsRef, where("userId", "==", userId));
      const clientsQuerySnapshot = await getDocs(q);
      const clientsData = clientsQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      setClients(clientsData);

      // Handle preselected client from URL or initial data
      const preselectedClientId = searchParams.get('clientId') || initialData?.client?.id;
      if (preselectedClientId && clientsData.length > 0) {
        const client = clientsData.find(c => c.id === preselectedClientId);
        if (client) {
          setSelectedClientData(client);
          form.setValue("clientId", client.id);
        }
      } else if (initialData && clientsData.length > 0) {
        // If editing, set the client from initial data
        const client = clientsData.find(c => c.id === initialData.client.id);
        if (client) {
          setSelectedClientData(client);
        }
      }

      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists() && userDocSnap.data()?.billerInfo) {
        setBillerInfo(userDocSnap.data()?.billerInfo as BillerInfo);
      } else {
        toast({
          title: "Biller Info Recommended",
          description: "Your business information isn't fully set up. Please update it in Settings.",
          variant: "default",
          duration: 5000,
        });
        setBillerInfo(defaultBillerInfo);
      }
    } catch (error) {
      console.error("Error fetching data for quotation form:", error);
      toast({
        title: "Error Loading Data",
        description: "Could not load clients or your business info. Please try refreshing.",
        variant: "destructive",
      });
    } finally {
      setLoadingClients(false);
      setLoadingBillerInfo(false);
    }
  }, [form, searchParams, toast, initialData?.client?.id]);

  useEffect(() => {
    if (currentUser) {
      fetchClientsAndBillerInfo(currentUser.uid);
    }
  }, [currentUser, fetchClientsAndBillerInfo]);

  // Set initial client data when editing
  useEffect(() => {
    if (initialData && clients.length > 0) {
      const client = clients.find(c => c.id === initialData.client.id);
      if (client) {
        setSelectedClientData(client);
        form.setValue("clientId", client.id);
      }
    }
  }, [initialData, clients, form]);

  const { fields: rowFields, append: appendRow, remove: removeRow } = useFieldArray({
    control: form.control,
    name: "rows",
  });

  const addNewRow = () => {
    appendRow({
      id: crypto.randomUUID(),
      order: rowFields.length,
      items: [
        { id: crypto.randomUUID(), type: 'text', label: 'Description', value: '', width: 50, order: 0 },
        { id: crypto.randomUUID(), type: 'number', label: 'Quantity', value: 1, width: 15, order: 1 },
        { id: crypto.randomUUID(), type: 'number', label: 'Rate', value: 0, width: 20, order: 2 },
        { id: crypto.randomUUID(), type: 'amount', label: 'Amount', value: 0, width: 15, order: 3 },
      ]
    });
  };

  const addItemToRow = (rowIndex: number) => {
    const currentRow = form.getValues(`rows.${rowIndex}`);
    const newItem: QuotationItem = {
      id: crypto.randomUUID(),
      type: 'text',
      label: 'New Item',
      value: '',
      width: 25,
      order: currentRow.items.length
    };
    form.setValue(`rows.${rowIndex}.items`, [...currentRow.items, newItem]);
  };

  const removeItemFromRow = (rowIndex: number, itemIndex: number) => {
    const currentRow = form.getValues(`rows.${rowIndex}`);
    if (currentRow.items.length > 1) {
      const updatedItems = currentRow.items.filter((_, index) => index !== itemIndex);
      form.setValue(`rows.${rowIndex}.items`, updatedItems);
    }
  };

  const calculateTotals = () => {
    const rows = form.watch("rows");
    let subTotal = 0;

    rows.forEach(row => {
      // Only consider items with type 'amount' for subtotal calculation
      const amountItems = row.items.filter(item => item.type === 'amount');
      amountItems.forEach(item => {
        if (typeof item.value === 'number') {
          subTotal += item.value;
        }
      });
    });

    const totalTax = subTotal * 0.18; // 18% GST
    const grandTotal = subTotal + totalTax;

    return { subTotal, totalTax, grandTotal };
  };

  const totals = calculateTotals();

  async function onSubmit(values: QuotationFormValues) {
    if (!currentUser) {
      toast({ title: "Authentication Error", description: "You must be logged in to create a quotation.", variant: "destructive" });
      return;
    }

    const clientForQuotation = clients.find(c => c.id === values.clientId);
    if (!clientForQuotation) {
      toast({ title: "Client Not Selected", description: "Please select a client.", variant: "destructive" });
      return;
    }

    const quotationData: Omit<Quotation, 'id' | 'createdAt' | 'updatedAt'> & { updatedAt: Timestamp; createdAt?: Timestamp } = {
      userId: currentUser.uid,
      quotationNumber: values.quotationNumber,
      quotationDate: Timestamp.fromDate(values.quotationDate),
      validUntil: Timestamp.fromDate(values.validUntil),
      billerInfo: billerInfo,
      client: clientForQuotation,
      title: values.title,
      description: values.description,
      rows: values.rows,
      notes: values.notes,
      termsAndConditions: values.termsAndConditions,
      status: values.status,
      currency: values.currency || "INR",
      subTotal: totals.subTotal,
      totalTax: totals.totalTax,
      grandTotal: totals.grandTotal,
      updatedAt: serverTimestamp() as Timestamp,
    };

    try {
      if (isEdit && initialData?.id) {
        // Update existing quotation
        const quotationRef = doc(db, "quotations", initialData.id);
        await updateDoc(quotationRef, quotationData);
        toast({
          title: "Quotation Updated",
          description: `Quotation ${values.quotationNumber} has been successfully updated.`,
        });
        router.push(`/dashboard/quotations/${initialData.id}`);
      } else {
        // Create new quotation
        const fullQuotationData = { ...quotationData, createdAt: serverTimestamp() as Timestamp };
        const docRef = await addDoc(collection(db, "quotations"), fullQuotationData);
        toast({
          title: "Quotation Created",
          description: `Quotation ${values.quotationNumber} has been successfully created.`,
        });
        router.push(`/dashboard/quotations/${docRef.id}`);
      }
    } catch (error) {
      console.error("Error saving quotation:", error);
      toast({
        title: "Error",
        description: `Failed to ${isEdit ? 'update' : 'save'} quotation. Please try again.`,
        variant: "destructive",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Quotation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="quotationNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quotation Number*</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quotationDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Quotation Date*</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value && !isNaN(new Date(field.value).getTime()) ? (
                              format(new Date(field.value), "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
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
                name="validUntil"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Valid Until*</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value && !isNaN(new Date(field.value).getTime()) ? (
                              format(new Date(field.value), "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
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

            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title*</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Website Development Quote" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client*</FormLabel>
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
                        <SelectTrigger>
                          <SelectValue placeholder={
                            (loadingAuth || (loadingClients && !initialData)) ? "Loading..." :
                            (!currentUser && !initialData) ? "Please log in" :
                            "Select a client"
                          } />
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
                              {client.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of the quotation..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Quotation Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {rowFields.map((row, rowIndex) => (
              <div key={row.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Row {rowIndex + 1}</h4>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addItemToRow(rowIndex)}
                    >
                      <PlusCircle className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                    {rowFields.length > 1 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeRow(rowIndex)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid gap-4">
                  {form.watch(`rows.${rowIndex}.items`).map((item, itemIndex) => {
                    const IconComponent = itemTypeIcons[item.type];
                    return (
                      <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`rows.${rowIndex}.items.${itemIndex}.type`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className={itemIndex > 0 ? "sr-only" : ""}>Type</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue>
                                        <div className="flex items-center">
                                          <IconComponent className="h-4 w-4 mr-2" />
                                          {field.value}
                                        </div>
                                      </SelectValue>
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="text">
                                      <div className="flex items-center">
                                        <Type className="h-4 w-4 mr-2" />
                                        Text
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="number">
                                      <div className="flex items-center">
                                        <Hash className="h-4 w-4 mr-2" />
                                        Number
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="date">
                                      <div className="flex items-center">
                                        <CalendarClock className="h-4 w-4 mr-2" />
                                        Date
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="image">
                                      <div className="flex items-center">
                                        <Image className="h-4 w-4 mr-2" />
                                        Image
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="amount">
                                      <div className="flex items-center">
                                        <DollarSign className="h-4 w-4 mr-2" />
                                        Amount
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="col-span-3">
                          <FormField
                            control={form.control}
                            name={`rows.${rowIndex}.items.${itemIndex}.label`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className={itemIndex > 0 ? "sr-only" : ""}>Label</FormLabel>
                                <FormControl>
                                  <Input placeholder="Column name" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="col-span-4">
                          <FormField
                            control={form.control}
                            name={`rows.${rowIndex}.items.${itemIndex}.value`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className={itemIndex > 0 ? "sr-only" : ""}>Value</FormLabel>
                                <FormControl>
                                  {item.type === 'number' || item.type === 'amount' ? (
                                    <Input
                                      type="number"
                                      placeholder={item.type === 'amount' ? "0.00" : "0"}
                                      step={item.type === 'amount' ? "0.01" : "1"}
                                      {...field}
                                      value={typeof field.value === 'number' ? field.value.toString() : field.value as string}
                                      onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  ) : item.type === 'date' ? (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant={"outline"}
                                          className={cn(
                                            "w-full pl-3 text-left font-normal",
                                            !field.value && "text-muted-foreground"
                                          )}
                                        >
                                          {field.value ? (
                                            format(new Date(field.value as string), "PPP")
                                          ) : (
                                            <span>Pick a date</span>
                                          )}
                                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-auto p-0">
                                        <Calendar
                                          mode="single"
                                          selected={field.value ? new Date(field.value as string) : undefined}
                                          onSelect={(date) => field.onChange(date)}
                                          initialFocus
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  ) : item.type === 'image' ? (
                                    <ImageUpload
                                      value={field.value as string}
                                      onChange={field.onChange}
                                      disabled={form.formState.isSubmitting}
                                    />
                                  ) : (
                                    <Input
                                      placeholder="Enter value"
                                      {...field}
                                      value={field.value as string}
                                    />
                                  )}
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="col-span-2">
                          <FormField
                            control={form.control}
                            name={`rows.${rowIndex}.items.${itemIndex}.width`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className={itemIndex > 0 ? "sr-only" : ""}>Width %</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="1"
                                    max="100"
                                    {...field}
                                    onChange={e => field.onChange(parseInt(e.target.value) || 25)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="col-span-1">
                          {form.watch(`rows.${rowIndex}.items`).length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItemFromRow(rowIndex, itemIndex)}
                              className="text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addNewRow} className="w-full">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Row
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>Rs. {totals.subTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax (18%):</span>
              <span>Rs. {totals.totalTax.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-xl font-bold">
              <span className="text-foreground">Grand Total:</span>
              <span>Rs. {totals.grandTotal.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Additional Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional notes for the client..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="termsAndConditions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Terms & Conditions (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Payment terms, validity, warranty info, etc."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Live Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedClientData && billerInfo.businessName ? (
              <QuotationPreview
                quotation={{
                  id: 'preview',
                  userId: currentUser?.uid || '',
                  quotationNumber: form.watch('quotationNumber'),
                  quotationDate: form.watch('quotationDate'),
                  validUntil: form.watch('validUntil'),
                  billerInfo: billerInfo,
                  client: selectedClientData,
                  title: form.watch('title'),
                  description: form.watch('description'),
                  rows: form.watch('rows'),
                  notes: form.watch('notes'),
                  termsAndConditions: form.watch('termsAndConditions'),
                  status: form.watch('status'),
                  currency: form.watch('currency'),
                  subTotal: totals.subTotal,
                  totalTax: totals.totalTax,
                  grandTotal: totals.grandTotal,
                  createdAt: Timestamp.fromDate(new Date()),
                  updatedAt: Timestamp.fromDate(new Date()),
                } as Quotation}
                showHeader={false}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Complete the form to see preview</p>
              </div>
            )}
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
              !currentUser
            }
          >
            {(form.formState.isSubmitting || loadingAuth || (loadingClients && !initialData)) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {form.formState.isSubmitting ? (isEdit ? "Updating Quotation..." : "Creating Quotation...") : (isEdit ? "Update Quotation" : "Create Quotation")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
