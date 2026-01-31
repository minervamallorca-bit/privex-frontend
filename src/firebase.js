import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// REPLACE THIS SECTION WITH YOUR REAL KEYS FROM GOOGLE
const firebaseConfig = {
 apiKey: "AIzaSyDiIAkf3ZeyfrqD8ARGawuI6m_mmsi4kyo",
  authDomain: "privex-....firebaseapp.com",
  projectId: "privex-network",
  storageBucket: "privex-....appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Database (Firestore)
export const db = getFirestore(app);