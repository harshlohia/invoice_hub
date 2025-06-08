
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Lock, Loader2 } from "lucide-react";
import { getFirebaseAuthInstance, db } from "@/lib/firebase"; 
import { createUserWithEmailAndPassword, type Auth } from "firebase/auth"; 
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const signupFormSchema = z.object({
  businessName: z.string().min(1, { message: "Business name is required." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupFormSchema>;

export function SignupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      businessName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: SignupFormValues) {
    console.log("Attempting signup with:", values.email);
    try {
      const authInstance: Auth = getFirebaseAuthInstance(); 
      const userCredential = await createUserWithEmailAndPassword(authInstance, values.email, values.password);
      console.log("Firebase user created successfully:", userCredential.user);
      const firestoreUser = userCredential.user; // Renamed to avoid confusion with User icon import

      if (firestoreUser && firestoreUser.email) { 
        console.log(`Attempting to store user data in Firestore for UID: ${firestoreUser.uid}, Email: ${firestoreUser.email}`);
        try {
          await setDoc(doc(db, "users", firestoreUser.uid), {
            uid: firestoreUser.uid,
            email: firestoreUser.email,
            businessName: values.businessName,
            createdAt: serverTimestamp(),
            firstName: "", 
            lastName: "",
          });
          console.log("User data stored in Firestore for UID:", firestoreUser.uid);
          toast({
            title: "Account Created Successfully",
            description: "User profile created. Please log in to continue.",
          });
          router.push("/login"); 
        } catch (firestoreError: any) {
          console.error("Firestore Error Code:", firestoreError.code);
          console.error("Firestore Error Message:", firestoreError.message);
          console.error("Full Firestore Error:", firestoreError);
          toast({
            title: "Account Created, Profile Save Failed",
            description: `User account created, but failed to save profile details to Firestore: ${firestoreError.message}. Please update in settings or check console.`,
            variant: "destructive",
          });
          router.push("/login"); 
        }
      } else {
        console.error("User object from Firebase Auth was not fully populated. Cannot save to Firestore.");
        toast({
          title: "Account Creation Issue",
          description: "User account was created, but profile details could not be saved due to an unexpected issue. Please contact support or try updating in settings.",
          variant: "destructive",
        });
        router.push("/login"); 
      }
    } catch (error: any) {
      let errorMessage = "Failed to create account. Please try again.";
      let isExpectedAuthError = false;

      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "This email address is already in use.";
        isExpectedAuthError = true;
        console.warn(`Firebase Auth: ${error.message} (Code: ${error.code})`);
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "The password is too weak. Please use a stronger password.";
        isExpectedAuthError = true;
        console.warn(`Firebase Auth: ${error.message} (Code: ${error.code})`);
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "The email address is not valid.";
        isExpectedAuthError = true;
        console.warn(`Firebase Auth: ${error.message} (Code: ${error.code})`);
      }
      
      if (!isExpectedAuthError) {
        console.error("Firebase Signup Error Details:", error);
        console.error("Error Code:", error.code);
        console.error("Error Message:", error.message);
        errorMessage = `An unexpected error occurred: ${error.message}. Check console for details.`;
      }
      
      toast({
        title: "Signup Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="businessName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business Name</FormLabel>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <FormControl>
                  <Input placeholder="Your Company Pvt. Ltd." {...field} className="pl-10" />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <FormControl>
                  <Input type="email" placeholder="you@example.com" {...field} className="pl-10" />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} className="pl-10" />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} className="pl-10" />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {form.formState.isSubmitting ? "Creating Account..." : "Create Account"}
        </Button>
        <Button variant="outline" className="w-full" type="button" disabled={form.formState.isSubmitting}>
          Sign up with Google
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </Form>
  );
}
