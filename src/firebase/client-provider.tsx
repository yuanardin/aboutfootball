'use client';

import { FirebaseProvider } from './provider';
import { initializeFirebase, isFirebaseConfigured } from './config';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { useEffect, useMemo } from 'react';

export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const firebaseProps = useMemo(() => {
    if (!isFirebaseConfigured) {
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
