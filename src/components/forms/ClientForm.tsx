"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@/lib/types";
import { GSTIN_REGEX, INDIAN_STATES, GST_RATES } from "@/lib/constants";
import { getStateTaxConfig, isInterStateTax } from "@/lib/types";
import { useRouter } from "next/navigation";
import { db, getFirebaseAuthInstance } from "@/lib/firebase";
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { Loader2, Info } from "lucide-react";
import { useEffect, useState } from "react";
import type { User, Auth } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";

const clientFormSchema = z.object({
  name: z.string().min(1, "Client name is required."),
  gstin: z.string().optional().refine(val => !val || GSTIN_REGEX.test(val), {
    message: "Invalid GSTIN format.",
  }),
  email: z.string().email("Invalid email address.").optional().or(z.literal('')),
  phone: z.string().optional(),
  addressLine1: z.string().min(1, "Address line 1 is required."),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required."),
  state: z.string().min(1, "State is required."),
  postalCode: z.string().min(1, "Postal code is required."),
  country: z.string().default("India"),
  defaultTaxRate: z.number().min(0).max(100).default(18),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

interface ClientFormProps {
  initialData?: Client | null;
  onSave?: (data: Client) => void; 
}

export function ClientForm({ initialData, onSave }: ClientFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: initialData || {
      name: "",
      gstin: "",
      email: "",
      phone: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "India",
      defaultTaxRate: 18,
    },
  });

  const watchedState = form.watch("state");

  useEffect(() => {
    const authInstance: Auth = getFirebaseAuthInstance();
    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
      setCurrentUser(user);
      setLoadingAuth(false);
      if (!user && !initialData) {
        console.warn("ClientForm: User not logged in for new client.");
      }
    });
    return () => unsubscribe();
  }, [initialData]);

  async function onSubmit(values: ClientFormValues) {
    console.log("ClientForm onSubmit: Values submitted:", values);
    console.log("ClientForm onSubmit: Current user:", currentUser);
    console.log("ClientForm onSubmit: Initial data:", initialData);

    if (!currentUser && !initialData?.userId) { 
      toast({ title: "Error", description: "You must be logged in to save a client.", variant: "destructive" });
      console.error("ClientForm onSubmit: Attempted to save without user.");
      return;
    }
    
    try {
      if (initialData?.id) {
        // Update existing client
        console.log("ClientForm onSubmit: Updating existing client. ID:", initialData.id);
        const clientRef = doc(db, "clients", initialData.id);
        const updateValues = {
            ...values,
            userId: initialData.userId || currentUser?.uid, 
            updatedAt: serverTimestamp(), 
        };
        if (!updateValues.userId) {
            toast({ title: "Error", description: "User ID missing for update.", variant: "destructive" });
            console.error("ClientForm onSubmit: User ID missing for update. Values:", updateValues);
            return;
        }
        console.log("ClientForm onSubmit: Data for update:", updateValues);
        await updateDoc(clientRef, updateValues);
        toast({
          title: "Client Updated",
          description: `${values.name} has been successfully updated.`,
        });
        if (onSave) {
          onSave({ ...updateValues, id: initialData.id, updatedAt: new Date() } as unknown as Client);
        } else {
          router.push("/dashboard/clients");
          router.refresh(); 
        }
      } else {
        // Add new client
        if (!currentUser) { 
             toast({ title: "Error", description: "Authentication error, please re-login.", variant: "destructive" });
             console.error("ClientForm onSubmit: CurrentUser is null when trying to add new client.");
             return;
        }
        console.log("ClientForm onSubmit: Adding new client for user ID:", currentUser.uid);
        const clientDataWithUser = {
          ...values,
          userId: currentUser.uid,
          createdAt: serverTimestamp(), 
          updatedAt: serverTimestamp(),
        };
        console.log("ClientForm onSubmit: Data for new client:", clientDataWithUser);
        const docRef = await addDoc(collection(db, "clients"), clientDataWithUser);
        console.log("ClientForm onSubmit: New client added with ID:", docRef.id);
        toast({
          title: "Client Added",
          description: `${values.name} has been successfully added.`,
        });
        if (onSave) {
          onSave({ ...clientDataWithUser, id: docRef.id, createdAt: new Date(), updatedAt: new Date() } as unknown as Client);
        } else {
          router.push("/dashboard/clients");
          router.refresh(); 
        }
      }
    } catch (error: any) {
      console.error("ClientForm onSubmit: Error saving client: ", error);
      console.error("ClientForm onSubmit: Firestore Error Code:", error.code);
      console.error("ClientForm onSubmit: Firestore Error Message:", error.message);
      console.error("ClientForm onSubmit: Full Firestore Error:", error);
      toast({
        title: "Error Saving Client",
        description: `Failed to save client. ${error.message || "Please try again."}`,
        variant: "destructive",
      });
    } 
  }

  const isSubmitDisabled = form.formState.isSubmitting || loadingAuth || (!currentUser && !initialData);

  // Get tax configuration for selected state
  const stateTaxConfig = watchedState ? getStateTaxConfig(watchedState) : null;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client Name*</FormLabel>
                <FormControl><Input placeholder="Acme Corporation" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="gstin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>GSTIN (Optional)</FormLabel>
                <FormControl><Input placeholder="29AAAAA0000A1Z5" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email (Optional)</FormLabel>
                <FormControl><Input type="email" placeholder="contact@acme.com" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone (Optional)</FormLabel>
                <FormControl><Input placeholder="+91 9876543210" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="addressLine1"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address Line 1*</FormLabel>
              <FormControl><Input placeholder="123 Business Street" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="addressLine2"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address Line 2 (Optional)</FormLabel>
              <FormControl><Input placeholder="Near Landmark" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City*</FormLabel>
                <FormControl><Input placeholder="Bengaluru" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State*</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select State" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {INDIAN_STATES.map(state => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="postalCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Postal Code*</FormLabel>
                <FormControl><Input placeholder="560001" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* State Tax Information */}
        {stateTaxConfig && (
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Tax Configuration for {stateTaxConfig.state}:</strong><br />
              {stateTaxConfig.description}
              <br />
              <span className="text-sm text-blue-600 mt-1 block">
                State Code: {stateTaxConfig.stateCode} | 
                Tax Type: {stateTaxConfig.taxType === 'CGST_SGST' ? 'CGST + SGST (Intra-state) / IGST (Inter-state)' : 'IGST Only'}
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Tax Configuration Section */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium font-headline mb-4">Tax Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="defaultTaxRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default GST Rate (%)*</FormLabel>
                  <Select onValueChange={(value) => field.onChange(parseFloat(value))} defaultValue={String(field.value)}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select GST Rate" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {GST_RATES.map(rate => (
                        <SelectItem key={rate} value={String(rate)}>{rate}% GST</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    This will be the default tax rate applied to all line items for this client when creating invoices.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Tax Breakdown Preview */}
            <div className="space-y-3">
              <FormLabel>Tax Breakdown Preview</FormLabel>
              <div className="bg-gray-50 p-4 rounded-lg border">
                <h4 className="font-medium text-sm mb-2">For {form.watch("defaultTaxRate")}% GST:</h4>
                {stateTaxConfig && (
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Intra-state ({stateTaxConfig.state}):</span>
                      <span className="font-medium">
                        CGST {form.watch("defaultTaxRate") / 2}% + SGST {form.watch("defaultTaxRate") / 2}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Inter-state (Other states):</span>
                      <span className="font-medium">IGST {form.watch("defaultTaxRate")}%</span>
                    </div>
                  </div>
                )}
                <div className="mt-2 pt-2 border-t text-xs text-gray-500">
                  Tax type automatically determined based on biller and client states
                </div>
              </div>
            </div>
          </div>
        </div>

        <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem className="hidden"> 
                <FormLabel>Country</FormLabel>
                <FormControl><Input {...field} readOnly /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={form.formState.isSubmitting}>
            Cancel
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitDisabled}>
            {(form.formState.isSubmitting || loadingAuth) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loadingAuth && !initialData ? "Authenticating..." : form.formState.isSubmitting ? (initialData ? "Saving..." : "Adding Client...") : (initialData ? "Save Changes" : "Add Client")}
            </Button>
        </div>
      </form>
    </Form>
  );
}