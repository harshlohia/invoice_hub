
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

// Your web app's Firebase configuration, now from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Ensure all required Firebase config values are present
if (
  !firebaseConfig.apiKey ||
  !firebaseConfig.authDomain ||
  !firebaseConfig.projectId ||
  !firebaseConfig.storageBucket ||
  !firebaseConfig.messagingSenderId ||
  !firebaseConfig.appId
) {
  // In a development environment, you might want to throw an error or log a more detailed message.
  // For now, we'll log a warning. The app might not function correctly without these.
  console.warn(
    "Firebase configuration is missing or incomplete. Check your environment variables."
  );
  // You could throw an error here to halt execution if Firebase is critical:
  // throw new Error("Firebase configuration is missing or incomplete from environment variables.");
}

// Initialize Firebase
let app: FirebaseApp;
if (getApps().length === 0) {
  // Only initialize if no apps exist, and if config is somewhat valid
  if (firebaseConfig.projectId) { // Check projectId as a basic guard
    app = initializeApp(firebaseConfig);
  } else {
    // Fallback or error handling if critical config like projectId is missing
    // This scenario should ideally be caught by the check above.
    // For robustness, we ensure 'app' is defined, even if it's a dummy or will fail later.
    console.error("Critical Firebase projectId is missing. Firebase cannot be initialized.");
    // A more robust app might have a fallback or a way to show an error state.
    // For now, this will likely cause Firebase features to fail.
    app = {} as FirebaseApp; // Placeholder to satisfy type, real app won't work
  }
} else {
  app = getApp();
}

const db: Firestore = firebaseConfig.projectId ? getFirestore(app) : {} as Firestore;

export function getFirebaseAuthInstance(): Auth {
  if (!firebaseConfig.projectId) {
    console.error("Firebase cannot be initialized for Auth due to missing projectId.");
    return {} as Auth; // Return a dummy Auth object or handle error appropriately
  }
  return getAuth(app);
}

export { db, app }; // Export app if needed elsewhere, db is commonly used
