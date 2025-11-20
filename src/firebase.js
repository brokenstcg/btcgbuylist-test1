import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBLCmI6hiUSd_oFgb6M-60wZq9sB05WSKA",
  authDomain: "brokentcg.firebaseapp.com",
  projectId: "brokentcg",
  storageBucket: "brokentcg.firebasestorage.app",
  messagingSenderId: "136179587488",
  appId: "1:136179587488:web:feb9762e74fe1d641fecc5",
  measurementId: "G-E99EZWX1NB"
};

// Initialize Firebase only if config exists to prevent crashes during initial setup
let app;
let auth;
let db;

try {
    if (firebaseConfig.apiKey) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    } else {
        console.warn("Firebase configuration missing. Check your .env file.");
    }
} catch (error) {
    console.error("Firebase Initialization Error:", error);
}


export { auth, db };
