// auth.js
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updatePassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile, // ADD THIS IMPORT
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

// Function to get user role from Firestore
const getUserRole = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      return userDoc.data().role;
    }
    return 'user'; // default role
  } catch (error) {
    console.error("Error getting user role:", error);
    return 'user';
  }
};

// Function to store user data in localStorage
const storeUserInLocalStorage = async (user) => {
  const role = await getUserRole(user.uid);
  const userData = {
    uid: user.uid,
    email: user.email,
    role: role,
    loginTime: new Date().toISOString()
  };
  localStorage.setItem('currentUser', JSON.stringify(userData));
  return userData;
};

// auth.js - I-update ni nga function
export const doCreateUserWithEmailAndPassword = async (email, password, role = 'user') => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    await setDoc(doc(db, "users", userCredential.user.uid), {
      email: email,
      role: role,
      createdAt: new Date()
    });

    // TANGGALON NI NGA LINE BOSS - DILI NA MAG AUTO STORE SA LOCALSTORAGE
    // await storeUserInLocalStorage(userCredential.user);
    
    return userCredential;
  } catch (error) {
    throw error;
  }
};

export const doCreateUserWithRole = async (email, password, role,  fullName) => {
  return doCreateUserWithEmailAndPassword(email, password, role);
};

export const doSignInWithEmailAndPassword = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  
  // Store user data in localStorage after successful login
  await storeUserInLocalStorage(userCredential.user);
  
  return userCredential;
};

export const doSignInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  // Add user to firestore with default role
  await setDoc(doc(db, "users", user.uid), {
    email: user.email,
    role: 'user',
    createdAt: new Date()
  }, { merge: true });

  // Store user data in localStorage
  await storeUserInLocalStorage(user);
  
  return result;
};

export const doSignOut = () => {
  // Clear user data from localStorage on logout
  localStorage.removeItem('currentUser');
  return auth.signOut();
};

export const doPasswordReset = (email) => {
  return sendPasswordResetEmail(auth, email);
};

export const doPasswordChange = (password) => {
  return updatePassword(auth.currentUser, password);
};

export const doSendEmailVerification = () => {
  return sendEmailVerification(auth.currentUser, {
    url: `${window.location.origin}/home`,
  });
};

// Function to get current user from localStorage
export const getCurrentUserFromStorage = () => {
  try {
    const userData = localStorage.getItem('currentUser');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting user from localStorage:', error);
    return null;
  }
};