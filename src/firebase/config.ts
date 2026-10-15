// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps, FirebaseOptions } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

function sanitizeFirebaseEnvValue(value?: string): string {
  return (value ?? '')
    .trim()
    .replace(/,$/, '')
    .replace(/^['"]|['"]$/g, '');
}

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
//
// NOTE: every value MUST be read through a static `process.env.NEXT_PUBLIC_*`
// reference. Next.js inlines exactly those references into the client bundle
// at build time; a dynamic lookup such as `process.env[key]` survives into
// the browser bundle, where it always resolves to `undefined` — falsely
// reporting every key as missing even when the variables are set.
const firebaseConfig: FirebaseOptions = {
  apiKey: sanitizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: sanitizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: sanitizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: sanitizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: sanitizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: sanitizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  measurementId: sanitizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID),
};

// Validates the exact sanitized values the app initializes Firebase with, so
// the check can never disagree with the configuration actually in use.
const requiredEnvEntries = [
  ['NEXT_PUBLIC_FIREBASE_API_KEY', firebaseConfig.apiKey],
  ['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
  ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
  ['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', firebaseConfig.storageBucket],
  ['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', firebaseConfig.messagingSenderId],
  ['NEXT_PUBLIC_FIREBASE_APP_ID', firebaseConfig.appId],
] as const;

export function getMissingFirebaseEnvKeys(): string[] {
  return requiredEnvEntries.filter(([, value]) => !value).map(([key]) => key);
}

const missingEnvKeys = getMissingFirebaseEnvKeys();

if (missingEnvKeys.length) {
  console.warn(
    'Firebase environment check: missing keys ->',
    missingEnvKeys
  );
} else {
  console.log('Firebase environment check: missing keys -> none');
}

export const isFirebaseConfigured = missingEnvKeys.length === 0;

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

export { initializeFirebase, firebaseConfig, sanitizeFirebaseEnvValue };
