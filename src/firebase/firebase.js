// firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // Add this import

const firebaseConfig = {
  apiKey: "AIzaSyCgahvn6-wGA8Ln67teYJs21FMX_U6kgkg",
  authDomain: "login-6ec56.firebaseapp.com",
  databaseURL: "https://login-6ec56-default-rtdb.firebaseio.com",
  projectId: "login-6ec56",
  storageBucket: "login-6ec56.firebasestorage.app",
  messagingSenderId: "968098455875",
  appId: "1:968098455875:web:edd32cb17059fadadb8ff6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Initialize Firestore

export { app, auth, db }; // Export db