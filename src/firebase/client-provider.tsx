'use client';

import {
  FirebaseProvider,
  type FirebaseProviderProps,
} from './provider';
import { initializeFirebase } from '.';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { useMemo } from 'react';

export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {

  const firebaseProps = useMemo(() => {
    const app = initializeFirebase();
    const auth = getAuth(app);
    const firestore = getFirestore(app);
    return { app, auth, firestore };
  }, []);

  return <FirebaseProvider {...firebaseProps}>{children}</FirebaseProvider>;
}
