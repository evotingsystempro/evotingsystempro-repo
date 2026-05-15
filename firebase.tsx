// firebase.tsx
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getFunctions } from "firebase/functions";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  sendSignInLinkToEmail,
  confirmPasswordReset,
  signInWithPhoneNumber,
  validatePassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
  type Auth,
} from "firebase/auth";
import { type Firestore } from "firebase/firestore";
import { type Database } from "firebase/database";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyDZgvLDIo-5YNbI-1f9dWVni7MIEO3fGAA",
  authDomain: "smartpeoplehub.firebaseapp.com",
  projectId: "smartpeoplehub",
  storageBucket: "smartpeoplehub.firebasestorage.app",
  messagingSenderId: "376826674474",
  appId: "1:376826674474:web:875900bf60c0559c5fb253",
  measurementId: "G-G717XGE1WH"
};

let auth: Auth;
let db: Firestore;
let rtdb: Database;
let functions: ReturnType<typeof getFunctions>;

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  rtdb = getDatabase(app);
  functions = getFunctions(app);

  // Web uses localStorage automatically via getAuth.
  // Native uses AsyncStorage via initializeAuth.
  if (Platform.OS === "web") {
    auth = getAuth(app);
  } else {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
} catch (error) {
  console.error("Firebase init error:", error);
}

export {
  // Auth instance & methods
  auth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  sendSignInLinkToEmail,
  confirmPasswordReset,
  signInWithPhoneNumber,
  validatePassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
  // Firestore instance & methods
  db,
  collection,
  getDocs,
  // Realtime Database instance
  rtdb,
  // Other services
  functions,
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
};