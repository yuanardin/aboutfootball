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

// Static `process.env.NEXT_PUBLIC_FIREBASE_*` references are required here.
// Next.js only inlines statically-analyzable `process.env.NEXT_PUBLIC_*` access
// into client bundles; a dynamic `process.env[key]` lookup is left as a runtime
// read of the browser `process.env` polyfill (always empty), which made this
// check return false and /login show "Authentication not configured".
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
    // Graceful degradation: if Firebase config is missing (e.g. local dev without
    // .env), the rest of the app still renders; auth simply stays disabled.
    if (!firebaseConfigured()) {
      return { enabled: false as const };
    }

    const app = initializeFirebase();
    return {
      enabled: true as const,
      app,
      auth: getAuth(app),
      firestore: getFirestore(app),
    };
  }, []);

  // Keep the session across reloads and browser restarts. `browserLocalPersistence`
  // is the SDK default, but setting it explicitly guarantees signed-in users are not
  // unexpectedly logged out on the next visit.
  useEffect(() => {
    if (firebaseProps.enabled && firebaseProps.auth) {
      setPersistence(firebaseProps.auth, browserLocalPersistence).catch(() => {
        // Persistence is best-effort; auth keeps working in the browser's default
        // storage mode even if switching persistence fails.
      });
    }
  }, [firebaseProps]);

  return <FirebaseProvider {...firebaseProps}>{children}</FirebaseProvider>;
}
