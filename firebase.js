
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// Replace this configuration with the one from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyD1RaqX8W_2fkqczFt44wWw4iH2LRiS6Io",
  authDomain: "cyberwira-a1409.firebaseapp.com",
  projectId: "cyberwira-a1409",
  storageBucket: "cyberwira-a1409.firebasestorage.app",
  messagingSenderId: "1073048944011",
  appId: "1:1073048944011:web:e74519dd27648ea6eb438e"
};

// Initialise Firebase
const app = initializeApp(firebaseConfig);

// Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("CyberWira Firebase connected!");
