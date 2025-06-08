
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDZFgHIErLWKfhLDRyUNlpSLLSVzTwBfmg",
  authDomain: "invoice-hub-1765e.firebaseapp.com",
  projectId: "invoice-hub-1765e",
  storageBucket: "invoice-hub-1765e.appspot.com",
  messagingSenderId: "986012587191",
  appId: "1:986012587191:web:78b800673eba561686e932"
};

// Initialize Firebase
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db: Firestore = getFirestore(app);

// Export a function to get the auth instance
// This helps ensure Firebase is fully initialized, especially in Next.js client components.
export function getFirebaseAuthInstance(): Auth {
  return getAuth(app);
}

export { db, app }; // Export app if needed elsewhere, db is commonly used
