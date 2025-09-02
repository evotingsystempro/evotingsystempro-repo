import { getFirestore, collection,getDocs, } from 'firebase/firestore'
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FirebaseApp, initializeApp, } from "firebase/app";
import { Firestore } from 'firebase/firestore';
import { getFunctions } from "firebase/functions";
import {
  createUserWithEmailAndPassword, onAuthStateChanged,
  sendPasswordResetEmail,
  initializeAuth,
  confirmPasswordReset,
  signInWithPhoneNumber,getReactNativePersistence,
  sendEmailVerification, sendSignInLinkToEmail,
  signInWithEmailAndPassword, Auth, signOut, validatePassword, GoogleAuthProvider, signInWithCredential,updateProfile
} from 'firebase/auth';

let app: FirebaseApp;
let auth: any;
let db: Firestore;

const firebaseConfig = {
  apiKey: process.env.API_KEY,
  authDomain: process.env.AUTH_DOMAIN,
  projectId: process.env.PROJECT_ID,
  storageBucket: process.env.STORAGE_BUCKET,
  messagingSenderId: process.env.MESSAGING_SENDER_ID,
  appId: process.env.APP_ID,
  measurementId: process.env.MEASUREMENT_ID
};

let functions: any;
try {
  app = initializeApp(firebaseConfig)
db = getFirestore(app)
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
  functions = getFunctions(app);
} catch (error) { functions = null;
}
export {
  auth, GoogleAuthProvider, signInWithCredential,
  sendEmailVerification, sendSignInLinkToEmail, validatePassword,
  signOut, confirmPasswordReset, onAuthStateChanged,createUserWithEmailAndPassword, sendPasswordResetEmail,
  signInWithPhoneNumber, signInWithEmailAndPassword,collection,updateProfile,getDocs, db,functions, 
}

