
"use client";

import { useEffect, useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { User, Building2, Palette, Bell, ShieldCheck, Loader2 } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import type { BillerInfo } from '@/lib/types'; // Using BillerInfo for business details
import { GSTIN_REGEX } from '@/lib/constants';
import { Skeleton } from '@/components/ui/skeleton';

// Assuming a single user for now, so settings are stored under a fixed ID
const BUSINESS_SETTINGS_DOC_ID = "mainBusinessInfo"; 
const USER_PROFILE_DOC_ID = "mainUserProfile";


const profileFormSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z.string().email("Invalid email address."),
});
type ProfileFormValues = z.infer<typeof profileFormSchema>;

const businessFormSchema = z.object({
  businessName: z.string().min(1, "Business name is required."),
  gstin: z.string().optional().refine(val => !val || GSTIN_REGEX.test(val), {
    message: "Invalid GSTIN format.",
  }),
  addressLine1: z.string().min(1, "Address is required."),
  // Other BillerInfo fields can be added here: city, state, postalCode, phone, email for business etc.
  // For simplicity, only including a few for now. These match BillerInfo type.
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  businessEmail: z.string().email("Invalid email").optional().or(z.literal('')),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  upiId: z.string().optional(),
  logoUrl: z.string().url("Invalid URL").optional().or(z.literal('')),
});
type BusinessFormValues = Partial<BillerInfo>; // Allow partial updates, use BillerInfo for structure

export default function SettingsPage() {
  const { toast } = useToast();
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingBusiness, setLoadingBusiness] = useState(true);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { firstName: "", lastName: "", email: "" },
  });

  const businessForm = useForm<BusinessFormValues>({
    resolver: zodResolver(businessFormSchema),
    defaultValues: { 
      businessName: "", 
      gstin: "", 
      addressLine1: "",
      city: "",
      state: "",
      postalCode: "",
      phone: "",
      email: "", // This is business email, distinct from user profile email
      bankName: "",
      accountNumber: "",
      ifscCode: "",
      upiId: "",
      logoUrl: "",
    },
  });

  useEffect(() => {
    const fetchProfile = async () => {
      setLoadingProfile(true);
      try {
        const docRef = doc(db, "settings", USER_PROFILE_DOC_ID);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          profileForm.reset(docSnap.data() as ProfileFormValues);
        }
      } catch (error) {
        console.error("Error fetching profile settings:", error);
        toast({ title: "Error", description: "Could not load profile settings.", variant: "destructive" });
      } finally {
        setLoadingProfile(false);
      }
    };

    const fetchBusinessInfo = async () => {
      setLoadingBusiness(true);
      try {
        const docRef = doc(db, "settings", BUSINESS_SETTINGS_DOC_ID);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          businessForm.reset(docSnap.data() as BusinessFormValues);
        }
      } catch (error) {
        console.error("Error fetching business settings:", error);
        toast({ title: "Error", description: "Could not load business settings.", variant: "destructive" });
      } finally {
        setLoadingBusiness(false);
      }
    };
    fetchProfile();
    fetchBusinessInfo();
  }, [profileForm, businessForm, toast]);

  const onProfileSubmit = async (values: ProfileFormValues) => {
    try {
      await setDoc(doc(db, "settings", USER_PROFILE_DOC_ID), values, { merge: true });
      toast({ title: "Profile Saved", description: "Your profile information has been updated." });
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({ title: "Error", description: "Failed to save profile.", variant: "destructive" });
    }
  };

  const onBusinessSubmit = async (values: BusinessFormValues) => {
    try {
      await setDoc(doc(db, "settings", BUSINESS_SETTINGS_DOC_ID), values, { merge: true });
      toast({ title: "Business Info Saved", description: "Your business information has been updated." });
    } catch (error) {
      console.error("Error saving business info:", error);
      toast({ title: "Error", description: "Failed to save business information.", variant: "destructive" });
    }
  };
  
  const renderProfileForm = () => (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline flex items-center"><User className="mr-2 h-5 w-5 text-primary" /> Profile Information</CardTitle>
        <CardDescription>Update your personal and contact details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingProfile ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>First Name</Label><Skeleton className="h-10 w-full" /></div>
              <div><Label>Last Name</Label><Skeleton className="h-10 w-full" /></div>
            </div>
            <div><Label>Email Address</Label><Skeleton className="h-10 w-full" /></div>
            <Skeleton className="h-10 w-24" />
          </div>
        ) : (
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={profileForm.control} name="firstName" render={({ field }) => (
                  <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={profileForm.control} name="lastName" render={({ field }) => (
                  <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={profileForm.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={profileForm.formState.isSubmitting}>
              {profileForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Save Profile
            </Button>
          </form>
        </Form>
        )}
      </CardContent>
    </Card>
  );

  const renderBusinessForm = () => (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline flex items-center"><Building2 className="mr-2 h-5 w-5 text-primary" /> Business Information</CardTitle>
        <CardDescription>Manage your business details, GSTIN, and address for invoices.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
         {loadingBusiness ? (
          <div className="space-y-4">
            <div><Label>Business Name</Label><Skeleton className="h-10 w-full" /></div>
            <div><Label>GSTIN</Label><Skeleton className="h-10 w-full" /></div>
            <div><Label>Business Address</Label><Skeleton className="h-10 w-full" /></div>
            <Skeleton className="h-10 w-32" />
          </div>
        ) : (
        <Form {...businessForm}>
          <form onSubmit={businessForm.handleSubmit(onBusinessSubmit)} className="space-y-4">
            <FormField control={businessForm.control} name="businessName" render={({ field }) => (
                <FormItem><FormLabel>Business Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={businessForm.control} name="gstin" render={({ field }) => (
                <FormItem><FormLabel>GSTIN</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={businessForm.control} name="addressLine1" render={({ field }) => (
                <FormItem><FormLabel>Business Address Line 1</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            {/* Add more fields for city, state, postalCode, phone, email as needed */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={businessForm.control} name="city" render={({ field }) => (
                    <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={businessForm.control} name="state" render={({ field }) => (
                    <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={businessForm.control} name="postalCode" render={({ field }) => (
                    <FormItem><FormLabel>Postal Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={businessForm.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Business Phone</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={businessForm.control} name="email" render={({ field }) => ( // Renamed to avoid conflict with profileForm.email
                    <FormItem><FormLabel>Business Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
             </div>
            <h3 className="text-md font-medium pt-2">Bank Details (for Invoices)</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField control={businessForm.control} name="bankName" render={({ field }) => (
                    <FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={businessForm.control} name="accountNumber" render={({ field }) => (
                    <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={businessForm.control} name="ifscCode" render={({ field }) => (
                    <FormItem><FormLabel>IFSC Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={businessForm.control} name="upiId" render={({ field }) => (
                    <FormItem><FormLabel>UPI ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
             </div>
             <FormField control={businessForm.control} name="logoUrl" render={({ field }) => (
                <FormItem><FormLabel>Logo URL (Optional)</FormLabel><FormControl><Input type="url" placeholder="https://example.com/logo.png" {...field} /></FormControl><FormMessage /></FormItem>)} />


            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={businessForm.formState.isSubmitting}>
              {businessForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Save Business Info
            </Button>
          </form>
        </Form>
        )}
      </CardContent>
    </Card>
  );


  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-headline font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and application settings.</p>
      </div>

      {renderProfileForm()}
      {renderBusinessForm()}
      
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><Palette className="mr-2 h-5 w-5 text-primary" /> Invoice Templates</CardTitle>
          <CardDescription>Customize the look and feel of your invoices. (Coming Soon)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Advanced template customization options will be available here.</p>
           <Button variant="outline" disabled>Manage Templates</Button>
        </CardContent>
      </Card>

       <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><Bell className="mr-2 h-5 w-5 text-primary" /> Notifications</CardTitle>
          <CardDescription>Manage your notification preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
                <Label htmlFor="emailNotifications" className="flex flex-col space-y-1">
                    <span>Email Notifications</span>
                    <span className="font-normal leading-snug text-muted-foreground">
                        Receive email updates for important events.
                    </span>
                </Label>
                <Switch id="emailNotifications" defaultChecked disabled />
            </div>
            <div className="flex items-center justify-between">
                <Label htmlFor="paymentReminders" className="flex flex-col space-y-1">
                    <span>Payment Reminders</span>
                    <span className="font-normal leading-snug text-muted-foreground">
                        Automatically send payment reminders for overdue invoices.
                    </span>
                </Label>
                <Switch id="paymentReminders" disabled/>
            </div>
          <Button className="bg-primary hover:bg-primary/90" disabled>Save Notification Settings</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center"><ShieldCheck className="mr-2 h-5 w-5 text-primary" /> Security</CardTitle>
          <CardDescription>Manage your account security settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div>
                <Button variant="outline" disabled>Change Password</Button>
            </div>
            <div>
                <Button variant="outline" disabled>Enable Two-Factor Authentication</Button>
                 <p className="text-xs text-muted-foreground mt-1">Coming soon.</p>
            </div>
        </CardContent>
      </Card>

    </div>
  );
}
