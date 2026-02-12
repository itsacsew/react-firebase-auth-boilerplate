// utils/roleHelpers.js
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

export const getUserRole = async (userId) => {
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

export const isAdminUser = async (currentUser) => {
  if (!currentUser || !currentUser.uid) return false;
  
  try {
    const role = await getUserRole(currentUser.uid);
    return role === 'admin';
  } catch (error) {
    console.error("Error checking admin role:", error);
    return false;
  }
};