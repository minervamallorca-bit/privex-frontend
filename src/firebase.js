import { initializeApp } from "firebase/app"; 
import { getFirestore } from "firebase/firestore"; 
import { getStorage } from "firebase/storage";  

// ⚠️ PASTE YOUR REAL KEYS BELOW (The ones from the website) ⚠️ 
const firebaseConfig = { 
  apiKey: "AIzaSyDiIAkf3ZeyfrqD8ARGawuI6m_mmsi4kyo", 
  authDomain: "privex-network.firebaseapp.com", 
  projectId: "privex-network", 
  storageBucket: "privex-network.firebasestorage.app", 
  messagingSenderId: "311680973325", 
  appId: "1:311680973325:web:5991fe5165109546c9f344", 
  measurementId: "G-WF649T2JM3" 
}; 

// ⚠️ END OF KEYS ⚠️ 

const app = initializeApp(firebaseConfig); 
export const db = getFirestore(app); 
export const storage = getStorage(app); 