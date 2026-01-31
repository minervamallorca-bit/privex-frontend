import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // NEW LINE

// YOUR KEYS (KEEP YOUR EXISTING KEYS HERE)
const firebaseConfig = {
  // ⚠️ PASTE YOUR PREVIOUS KEYS HERE AGAIN ⚠️
  apiKey: "YOUR_API_KEY_HERE", 
  authDomain: "privex-network.firebaseapp.com",
  projectId: "privex-network",
  storageBucket: "privex-network.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app); // NEW EXPORT