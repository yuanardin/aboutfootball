// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps, FirebaseOptions } from 'firebase/app';
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
const firebaseConfig: FirebaseOptions = {
  apiKey: sanitizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: sanitizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: sanitizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: sanitizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: sanitizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: sanitizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  measurementId: sanitizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID),
};

// Initialize Firebase
function initializeFirebase() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export { initializeFirebase, firebaseConfig, sanitizeFirebaseEnvValue };
