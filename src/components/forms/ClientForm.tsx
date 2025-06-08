
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@/lib/types";
import { GSTIN_REGEX, INDIAN_STATES } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { db, getFirebaseAuthInstance } from "@/lib/firebase";
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { User, Auth } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";

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

  async function onSubmit(values: ClientFormValues) {
    if (!currentUser && !initialData?.userId) { // For new clients, user must be logged in
      toast({ title: "Error", description: "You must be logged in to save a client.", variant: "destructive" });
      return;
    }
    
    form.formState.isSubmitting = true;
    try {
      if (initialData?.id) {
        // Update existing client
        const clientRef = doc(db, "clients", initialData.id);
        // Ensure userId is not accidentally changed if it exists, or set it if somehow missing from initialData (shouldn't happen)
        const updateValues = {
            ...values,
            userId: initialData.userId || currentUser?.uid, 
            // updatedAt: serverTimestamp(), 
        };
        if (!updateValues.userId) {
            toast({ title: "Error", description: "User ID missing for update.", variant: "destructive" });
            form.formState.isSubmitting = false;
            return;
        }
        await updateDoc(clientRef, updateValues);
        toast({
          title: "Client Updated",
          description: `${values.name} has been successfully updated.`,
        });
        if (onSave) {
          onSave({ ...updateValues, id: initialData.id } as Client);
        } else {
          router.push("/dashboard/clients");
          router.refresh(); 
        }
      } else {
        // Add new client
        if (!currentUser) { // Double check for new client
             toast({ title: "Error", description: "Authentication error, please re-login.", variant: "destructive" });
             form.formState.isSubmitting = false;
             return;
        }
        const clientDataWithUser = {
          ...values,
          userId: currentUser.uid,
          // createdAt: serverTimestamp(), 
        };
        const docRef = await addDoc(collection(db, "clients"), clientDataWithUser);
        toast({
          title: "Client Added",
          description: `${values.name} has been successfully added.`,
        });
        if (onSave) {
          onSave({ ...clientDataWithUser, id: docRef.id });
        } else {
          router.push("/dashboard/clients");
          router.refresh(); 
        }
      }
    } catch (error) {
      console.error("Error saving client: ", error);
      toast({
        title: "Error",
        description: "Failed to save client. Please try again.",
        variant: "destructive",
      });
    } finally {
      form.formState.isSubmitting = false;
      form.reset(form.getValues()); 
    }
  }

  const isSubmitDisabled = form.formState.isSubmitting || loadingAuth || (!currentUser && !initialData);

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
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitDisabled}>
            Cancel
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitDisabled}>
            {(form.formState.isSubmitting || loadingAuth) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loadingAuth && !initialData ? "Loading..." : form.formState.isSubmitting ? (initialData ? "Saving..." : "Adding Client...") : (initialData ? "Save Changes" : "Add Client")}
            </Button>
        </div>
      </form>
    </Form>
  );
}
