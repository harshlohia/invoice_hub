
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; 

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDZFgHIErLWKfhLDRyUNlpSLLSVzTwBfmg",
  authDomain: "invoice-hub-1765e.firebaseapp.com",
  projectId: "invoice-hub-1765e",
  storageBucket: "invoice-hub-1765e.firebasestorage.app", // Using the one provided by user
  messagingSenderId: "986012587191",
  appId: "1:986012587191:web:78b800673eba561686e932"
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const db = getFirestore(app);
const auth = getAuth(app); 

export { db, auth };
