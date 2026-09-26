'use client';

import { FirebaseProvider } from './provider';
import { initializeFirebase } from './index';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { useEffect, useMemo } from 'react';
import { sanitizeFirebaseEnvValue } from './config';

const REQUIRED_KEYS: readonly string[] = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
] as const;

const KEY_PRESENCE: Record<string, boolean> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: Boolean(
    sanitizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY)
  ),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: Boolean(
    sanitizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN)
  ),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: Boolean(
    sanitizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
  ),
  NEXT_PUBLIC_FIREBASE_APP_ID: Boolean(
    sanitizeFirebaseEnvValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID)
  ),
};

function firebaseConfigured() {
  return REQUIRED_KEYS.every((key) => KEY_PRESENCE[key]);
}

export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const firebaseProps = useMemo(() => {
    if (!firebaseConfigured()) {
      return { enabled: false as const };
    }

    const app = initializeFirebase();
    const auth = getAuth(app);

    return {
      enabled: true as const,
      app,
      auth,
      firestore: getFirestore(app),
    };
  }, []);

  useEffect(() => {
    if (!firebaseProps.enabled || !firebaseProps.auth) {
      return;
    }

    let isMounted = true;

    setPersistence(firebaseProps.auth, browserLocalPersistence)
      .catch(() => {
        // Keep the default auth persistence if the browser rejects the request.
      })
      .finally(() => {
        if (!isMounted) return;
      });

    return () => {
      isMounted = false;
    };
  }, [firebaseProps.auth, firebaseProps.enabled]);

  return <FirebaseProvider {...firebaseProps}>{children}</FirebaseProvider>;
}
