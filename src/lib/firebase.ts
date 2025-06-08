
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// import { getAuth } from "firebase/auth"; // Prepare for Firebase Auth

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA7X0lfZbW6LoPZixfRHsxx1AdmtImM4MA",
  authDomain: "invoice-hub-80f7e.firebaseapp.com",
  projectId: "invoice-hub-80f7e",
  storageBucket: "invoice-hub-80f7e.appspot.com",
  messagingSenderId: "1047418322494",
  appId: "1:1047418322494:web:245928258e77c5ddf15b6f"
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const db = getFirestore(app);
// const auth = getAuth(app); // Prepare for Firebase Auth

export { db /*, auth */ };
