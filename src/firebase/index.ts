import { getApps, getApp, initializeApp } from 'firebase/app';
import { firebaseConfig, isFirebaseConfigured } from './config';
import { useUser } from './auth/use-user';

function initializeFirebase() {
  if (!isFirebaseConfigured) {
    console.warn(
      'Firebase is not configured yet. Copy .env.example to .env.local and fill in your Firebase values.'
    );
  }

  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export { initializeFirebase, useUser, isFirebaseConfigured };
export { firebaseConfig } from './config';
export * from './provider';
