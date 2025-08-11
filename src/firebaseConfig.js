// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// This is the correct and final version
const firebaseConfig = {
  apiKey: "AIzaSyD4jRE_1Tl9TL69pdli7ELu1iPFPJaYhsI",
  authDomain: "theatre-pantry.firebaseapp.com",
  projectId: "theatre-pantry",
  storageBucket: "theatre-pantry.firebasestorage.app",
  messagingSenderId: "728609056714",
  appId: "1:728609056714:web:09d629439c4c06c0819133",
  measurementId: "G-3KCDG2YX2M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);