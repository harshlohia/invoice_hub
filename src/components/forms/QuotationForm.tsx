
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CalendarIcon, Plus, Trash2, GripVertical, Type, Hash, CalendarClock, Image, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { getFirebaseAuthInstance, db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, getDocs, query, where, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import type { Quotation, QuotationRow, QuotationItem, Client, BillerInfo } from '@/lib/types';
import { QuotationPreview } from '@/components/QuotationPreview';
import { ImageUpload } from '@/components/ImageUpload';

const quotationFormSchema = z.object({
  quotationNumber: z.string().min(1, 'Quotation number is required'),
  quotationDate: z.date({
    required_error: 'Quotation date is required',
  }),
  validUntil: z.date({
    required_error: 'Valid until date is required',
  }),
  clientId: z.string().min(1, 'Client is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  rows: z.array(z.object({
    id: z.string(),
    items: z.array(z.object({
      id: z.string(),
      type: z.enum(['text', 'image', 'number', 'date']),
      label: z.string(),
      value: z.union([z.string(), z.number(), z.date()]),
      width: z.number().optional(),
      order: z.number(),
    })),
    order: z.number(),
  })),
  notes: z.string().optional(),
  termsAndConditions: z.string().optional(),
  status: z.enum(['draft', 'sent', 'accepted', 'declined', 'expired']),
  currency: z.string().default('INR'),
});

type QuotationFormValues = z.infer<typeof quotationFormSchema>;

const defaultBillerInfo: BillerInfo = {
  businessName: '',
  gstin: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'India',
  phone: '',
  email: '',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  upiId: '',
  logoUrl: ''
};

interface QuotationFormProps {
  initialData?: Partial<Quotation>;
  isEdit?: boolean;
}

const itemTypeIcons = {
  text: Type,
  image: Image,
  number: Hash,
  date: CalendarClock,
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
      quotationNumber: initialData?.quotationNumber || `QUO-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random() * 1000)}`,
      quotationDate: initialData?.quotationDate instanceof Date ? initialData.quotationDate : new Date(),
      validUntil: initialData?.validUntil instanceof Date ? initialData.validUntil : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      clientId: initialData?.client?.id || searchParams.get('clientId') || "",
      title: initialData?.title || '',
      description: initialData?.description || '',
      rows: initialData?.rows || [
        {
          id: crypto.randomUUID(),
          order: 0,
          items: [
            { id: crypto.randomUUID(), type: 'text', label: 'Description', value: '', width: 50, order: 0 },
            { id: crypto.randomUUID(), type: 'number', label: 'Quantity', value: 1, width: 15, order: 1 },
            { id: crypto.randomUUID(), type: 'number', label: 'Rate', value: 0, width: 20, order: 2 },
            { id: crypto.randomUUID(), type: 'number', label: 'Amount', value: 0, width: 15, order: 3 },
          ]
        }
      ],
      notes: initialData?.notes || '',
      termsAndConditions: initialData?.termsAndConditions || '',
      status: initialData?.status || 'draft',
      currency: initialData?.currency || 'INR',
    },
  });

  useEffect(() => {
    const auth = getFirebaseAuthInstance();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const fetchClientsAndBillerInfo = async () => {
      setLoadingClients(true);
      setLoadingBillerInfo(true);
      try {
        const clientsRef = collection(db, "clients");
        const q = query(clientsRef, where("userId", "==", currentUser.uid));
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
          const client = clientsData.find(c => c.id === initialData.client?.id);
          if (client) {
            setSelectedClientData(client);
          }
        }

        const userDocRef = doc(db, "users", currentUser.uid);
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
    };
    fetchClientsAndBillerInfo();
  }, [currentUser, form, searchParams, toast, initialData?.client?.id]);

  const calculateTotals = () => {
    const rows = form.watch('rows');
    let subTotal = 0;

    rows.forEach(row => {
      const amountItem = row.items.find(item => item.type === 'number' && item.label.toLowerCase().includes('amount'));
      if (amountItem && typeof amountItem.value === 'number') {
        subTotal += amountItem.value;
      }
    });

    const totalTax = subTotal * 0.18; // 18% tax
    const grandTotal = subTotal + totalTax;

    return { subTotal, totalTax, grandTotal };
  };

  const totals = calculateTotals();

  const addNewRow = () => {
    const currentRows = form.getValues('rows');
    const newRow: QuotationRow = {
      id: `row-${Date.now()}`,
      items: [
        {
          id: `item-${Date.now()}-1`,
          type: 'text',
          label: 'Description',
          value: '',
          width: 50,
          order: 1,
        },
        {
          id: `item-${Date.now()}-2`,
          type: 'number',
          label: 'Amount',
          value: 0,
          width: 50,
          order: 2,
        },
      ],
      order: currentRows.length + 1,
    };

    form.setValue('rows', [...currentRows, newRow]);
  };

  const removeRow = (rowIndex: number) => {
    const currentRows = form.getValues('rows');
    const updatedRows = currentRows.filter((_, index) => index !== rowIndex);
    form.setValue('rows', updatedRows);
  };

  const addItemToRow = (rowIndex: number) => {
    const currentRows = form.getValues('rows');
    const row = currentRows[rowIndex];
    const newItem: QuotationItem = {
      id: `item-${Date.now()}`,
      type: 'text',
      label: 'New Field',
      value: '',
      width: 25,
      order: row.items.length + 1,
    };

    row.items.push(newItem);
    form.setValue('rows', currentRows);
  };

  const removeItemFromRow = (rowIndex: number, itemIndex: number) => {
    const currentRows = form.getValues('rows');
    const row = currentRows[rowIndex];
    row.items = row.items.filter((_, index) => index !== itemIndex);
    form.setValue('rows', currentRows);
  };

  const onSubmit = async (values: QuotationFormValues) => {
    if (!currentUser) {
      toast({
        title: 'Error',
        description: 'You must be logged in to create a quotation.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedClientData) {
      toast({
        title: 'Error',
        description: 'Please select a client.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const quotationData = {
        userId: currentUser.uid,
        quotationNumber: values.quotationNumber,
        quotationDate: values.quotationDate,
        validUntil: values.validUntil,
        billerInfo: billerInfo,
        client: selectedClientData,
        title: values.title,
        description: values.description,
        rows: values.rows,
        notes: values.notes,
        termsAndConditions: values.termsAndConditions,
        status: values.status,
        currency: values.currency,
        subTotal: totals.subTotal,
        totalTax: totals.totalTax,
        grandTotal: totals.grandTotal,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (isEdit && initialData?.id) {
        await updateDoc(doc(db, 'quotations', initialData.id), quotationData);
        toast({
          title: 'Success',
          description: 'Quotation updated successfully.',
        });
        router.push(`/dashboard/quotations/${initialData.id}`);
      } else {
        await addDoc(collection(db, 'quotations'), quotationData);
        toast({
          title: 'Success',
          description: 'Quotation created successfully.',
        });
        router.push('/dashboard/quotations');
      }

    } catch (error) {
      console.error('Error saving quotation:', error);
      toast({
        title: 'Error',
        description: 'Failed to save quotation. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (loadingAuth) {
    return <div>Loading...</div>;
  }

  if (!currentUser) {
    router.push('/login');
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Form Section */}
        <div className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle className="font-headline">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="quotationNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quotation Number</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="sent">Sent</SelectItem>
                              <SelectItem value="accepted">Accepted</SelectItem>
                              <SelectItem value="declined">Declined</SelectItem>
                              <SelectItem value="expired">Expired</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="quotationDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Quotation Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
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
                                disabled={(date) =>
                                  date > new Date() || date < new Date("1900-01-01")
                                }
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
                          <FormLabel>Valid Until</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
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
                                disabled={(date) => date < new Date()}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter quotation title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Enter quotation description" />
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
                </CardContent>
              </Card>

              {/* Items Section */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="font-headline">Items</CardTitle>
                    <Button type="button" onClick={addNewRow} size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Row
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {form.watch('rows').map((row, rowIndex) => (
                    <div key={row.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">Row {rowIndex + 1}</h4>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={() => addItemToRow(rowIndex)}
                            size="sm"
                            variant="outline"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Field
                          </Button>
                          <Button
                            type="button"
                            onClick={() => removeRow(rowIndex)}
                            size="sm"
                            variant="destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-4">
                        {row.items.map((item, itemIndex) => (
                          <div key={item.id} className="border rounded p-3 space-y-3">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Field {itemIndex + 1}</span>
                              </div>
                              <Button
                                type="button"
                                onClick={() => removeItemFromRow(rowIndex, itemIndex)}
                                size="sm"
                                variant="ghost"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs font-medium">Type</label>
                                <Select
                                  value={item.type}
                                  onValueChange={(value: 'text' | 'image' | 'number' | 'date') => {
                                    const currentRows = form.getValues('rows');
                                    currentRows[rowIndex].items[itemIndex].type = value;
                                    form.setValue('rows', currentRows);
                                  }}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(itemTypeIcons).map(([type, Icon]) => (
                                      <SelectItem key={type} value={type}>
                                        <div className="flex items-center gap-2">
                                          <Icon className="h-3 w-3" />
                                          {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <label className="text-xs font-medium">Label</label>
                                <Input
                                  value={item.label}
                                  onChange={(e) => {
                                    const currentRows = form.getValues('rows');
                                    currentRows[rowIndex].items[itemIndex].label = e.target.value;
                                    form.setValue('rows', currentRows);
                                  }}
                                  className="h-8"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-xs font-medium">Value</label>
                              {item.type === 'image' ? (
                                <ImageUpload
                                  onImageUpload={(url) => {
                                    const currentRows = form.getValues('rows');
                                    currentRows[rowIndex].items[itemIndex].value = url;
                                    form.setValue('rows', currentRows);
                                  }}
                                  currentImageUrl={item.value as string}
                                />
                              ) : item.type === 'number' ? (
                                <Input
                                  type="number"
                                  value={item.value as number}
                                  onChange={(e) => {
                                    const currentRows = form.getValues('rows');
                                    currentRows[rowIndex].items[itemIndex].value = parseFloat(e.target.value) || 0;
                                    form.setValue('rows', currentRows);
                                  }}
                                  className="h-8"
                                />
                              ) : item.type === 'date' ? (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className="h-8 w-full justify-start text-left font-normal"
                                    >
                                      {item.value ? format(new Date(item.value as string), "PPP") : "Pick a date"}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={item.value ? new Date(item.value as string) : undefined}
                                      onSelect={(date) => {
                                        if (date) {
                                          const currentRows = form.getValues('rows');
                                          currentRows[rowIndex].items[itemIndex].value = date;
                                          form.setValue('rows', currentRows);
                                        }
                                      }}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                              ) : (
                                <Input
                                  value={item.value as string}
                                  onChange={(e) => {
                                    const currentRows = form.getValues('rows');
                                    currentRows[rowIndex].items[itemIndex].value = e.target.value;
                                    form.setValue('rows', currentRows);
                                  }}
                                  className="h-8"
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {form.watch('rows').length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No items added yet. Click "Add Row" to get started.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-headline">Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>₹{totals.subTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax (18%):</span>
                      <span>₹{totals.totalTax.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold">
                      <span>Grand Total:</span>
                      <span>₹{totals.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-4">
                <Button type="submit" className="flex-1">
                  {isEdit ? 'Update Quotation' : 'Create Quotation'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </div>

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
                  createdAt: new Date(),
                  updatedAt: new Date(),
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
      </div>
    </div>
  );
}
