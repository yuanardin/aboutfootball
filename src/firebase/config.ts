// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps, FirebaseOptions } from "firebase/app";

const requiredEnvKeys = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
] as const;

const missingEnvKeys = requiredEnvKeys.filter(
  (key) => !process.env[key] || process.env[key]?.trim() === ''
);

export const isFirebaseConfigured = missingEnvKeys.length === 0;

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? undefined,
};

// Initialize Firebase
function initializeFirebase() {
  if (!isFirebaseConfigured) {
    const keyList = missingEnvKeys.join(', ');
    throw new Error(
      `Missing Firebase environment variables: ${keyList}. Please create a .env.local file using .env.example.`
    );
  }

  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export { initializeFirebase, firebaseConfig };
