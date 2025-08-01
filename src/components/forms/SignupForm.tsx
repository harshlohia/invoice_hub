
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
import { createUserWithEmailAndPassword, type Auth, type User as FirebaseUser } from "firebase/auth"; 
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
    console.log("Signup attempt with:", values.email);
    form.control.handleSubmit(async (data) => { // Using handleSubmit to ensure form state is accurate
        try {
            const authInstance: Auth = getFirebaseAuthInstance(); 
            console.log("Firebase Auth Instance obtained.");

            const userCredential = await createUserWithEmailAndPassword(authInstance, data.email, data.password);
            console.log("Firebase Auth: User created successfully.");
            
            const firebaseUser = userCredential.user as FirebaseUser; // Explicit cast for clarity
            
            // Detailed logging of the user object from Auth
            console.log("Firebase Auth User Object:", JSON.stringify(firebaseUser, null, 2));

            if (firebaseUser && firebaseUser.uid && firebaseUser.email) {
                const userId = firebaseUser.uid;
                const userEmail = firebaseUser.email;
                const userBusinessName = data.businessName;

                console.log(` Firestore Save Prep: UID=${userId}, Email=${userEmail}, BusinessName=${userBusinessName}`);
                
                const userDocData = {
                uid: userId,
                email: userEmail,
                businessName: userBusinessName,
                createdAt: serverTimestamp(),
                firstName: "", 
                lastName: "",
                };
                console.log("Firestore Save: Data to be written:", JSON.stringify(userDocData, null, 2));

                try {
                    console.log(`Firestore Save: Attempting to write to collection 'users', document ID '${userId}'`);
                    await setDoc(doc(db, "users", userId), userDocData);
                    console.log(`Firestore Save: SUCCESS - User data stored for UID: ${userId}`);
                    toast({
                        title: "Account & Profile Created!",
                        description: "Welcome! Your account and profile have been successfully saved.",
                    });
                    router.push("/login"); 
                } catch (firestoreError: any) {
                    console.error("Firestore Save: FAILED - Firestore Write Error Code:", firestoreError.code);
                    console.error("Firestore Save: FAILED - Firestore Write Error Message:", firestoreError.message);
                    console.error("Firestore Save: FAILED - Full Firestore Error:", firestoreError);
                    toast({
                        title: "Account Created, Profile Save Failed",
                        description: `Your Firebase account was created, but saving profile details to Firestore failed: ${firestoreError.message}. Please try updating your profile in settings later or contact support if the issue persists.`,
                        variant: "destructive",
                    });
                    // Still redirect to login as auth account was made, user might want to retry saving profile later
                    router.push("/login"); 
                }
            } else {
                console.error("CRITICAL FAILURE: Firebase Auth user object missing uid or email after successful creation.");
                console.log("Auth User UID received:", firebaseUser?.uid);
                console.log("Auth User Email received:", firebaseUser?.email);
                toast({
                title: "Account Creation Issue",
                description: "Your Firebase account was created, but critical user info (UID/email) was missing from the response. Profile could not be saved. Please contact support.",
                variant: "destructive",
                });
                router.push("/login"); // Redirect as auth account likely made
            }
        } catch (authError: any) {
            let errorMessage = "Failed to create account. Please try again.";
            let isExpectedAuthError = false;
            console.warn("Firebase Auth: Error during createUserWithEmailAndPassword.");

            if (authError.code === 'auth/email-already-in-use') {
                errorMessage = "This email address is already in use. Please try logging in or use a different email.";
                isExpectedAuthError = true;
                console.warn(`Firebase Auth: Specific Error - ${authError.message} (Code: ${authError.code})`);
            } else if (authError.code === 'auth/weak-password') {
                errorMessage = "The password is too weak. Please use a stronger password (at least 8 characters).";
                isExpectedAuthError = true;
                console.warn(`Firebase Auth: Specific Error - ${authError.message} (Code: ${authError.code})`);
            } else if (authError.code === 'auth/invalid-email') {
                errorMessage = "The email address is not valid. Please check and try again.";
                isExpectedAuthError = true;
                console.warn(`Firebase Auth: Specific Error - ${authError.message} (Code: ${authError.code})`);
            }
            
            if (!isExpectedAuthError) {
                console.error("Firebase Auth: UNEXPECTED Error Details:", authError);
                console.error("Firebase Auth: UNEXPECTED Error Code:", authError.code);
                console.error("Firebase Auth: UNEXPECTED Error Message:", authError.message);
                errorMessage = `An unexpected error occurred during signup: ${authError.message}. Please check the console for more details.`;
            }
            
            toast({
                title: "Signup Failed",
                description: errorMessage,
                variant: "destructive",
            });
        }
    })(values); // Pass form values to the wrapped async function
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
