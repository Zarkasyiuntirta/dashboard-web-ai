import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCssgZ0oVdDo1CIecaRz2IVjq87jD9kZyQ",
  authDomain: "dashboardai-70b75.firebaseapp.com",
  projectId: "dashboardai-70b75",
  storageBucket: "dashboardai-70b75.firebasestorage.app",
  messagingSenderId: "869027364699",
  appId: "1:869027364699:web:8840eec44fbfe0277d647e",
  measurementId: "G-SKVJRERBC3"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export { doc, setDoc, getDoc };