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
import { type FirebaseStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyBW6D_---619utCBXW6vYQ9RvAE4_SKuuo",
  authDomain: "evotingsystempro-788f7.firebaseapp.com",
  projectId: "evotingsystempro-788f7",
  storageBucket: "evotingsystempro-788f7.firebasestorage.app",
  messagingSenderId: "570014654568",
  appId: "1:570014654568:web:592be2f4430b308a785bdd",
  measurementId: "G-CQ5LWR36TX",
};

let auth: Auth;
let db: Firestore;
let rtdb: Database;
let functions: ReturnType<typeof getFunctions>;
let storage: FirebaseStorage;                    // ← typed instance, not the function

try {
  const app = initializeApp(firebaseConfig);

  db = getFirestore(app);
  rtdb = getDatabase(app);
  functions = getFunctions(app);
  storage = getStorage(app);                   // ← instantiated here alongside db

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
  // Auth
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

  // Firestore
  db,
  collection,
  getDocs,

  // Realtime DB
  rtdb,

  // Cloud Functions
  functions,

  // Storage — export the instance, not the raw functions
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
};
