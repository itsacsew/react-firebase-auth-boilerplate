// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {getAuth} from "firebase/auth"
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDFFfVS8xUBiMwK5mt_-c10qS072VZLoS4",
  authDomain: "login-188a5.firebaseapp.com",
  projectId: "login-188a5",
  storageBucket: "login-188a5.firebasestorage.app",
  messagingSenderId: "760693045901",
  appId: "1:760693045901:web:e7239104d9e45a052700c4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app)

export {app, auth};