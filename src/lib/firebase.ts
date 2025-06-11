import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA7X0lfZbW6LoPZixfRHsxx1AdmtImM4MA",
  authDomain: "invoice-hub-80f7e.firebaseapp.com",
  projectId: "invoice-hub-80f7e",
  storageBucket: "invoice-hub-80f7e.firebasestorage.app",
  messagingSenderId: "1047418322494",
  appId: "1:1047418322494:web:f50e3d6c76325da9f15b6f"
};

// Initialize Firebase
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const db: Firestore = getFirestore(app);
const authInstance: Auth = getAuth(app); // Initialize Auth instance once
const storage: FirebaseStorage = getStorage(app);

export function getFirebaseAuthInstance(): Auth {
  return authInstance; // Return the already initialized instance
}

export { db, app, storage };