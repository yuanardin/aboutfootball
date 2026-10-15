'use client';

import { createContext, useContext } from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

export type FirebaseContextValue = {
  app?: FirebaseApp;
  auth?: Auth;
  firestore?: Firestore;
  enabled: boolean;
};

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export type FirebaseProviderProps = FirebaseContextValue & {
  children: React.ReactNode;
};

export function FirebaseProvider(props: FirebaseProviderProps) {
  const { children, ...rest } = props;
  const contextValue = rest;
  return (
    <FirebaseContext.Provider value={contextValue}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}

export function useFirebaseApp() {
  const { app } = useFirebase();
  if (!app) {
    throw new Error('Firebase app is not available');
  }
  return app;
}

export function useAuth() {
  const { auth } = useFirebase();
  return auth ?? null;
}

export function useIsAuthEnabled() {
  return useFirebase().enabled;
}

export function useFirestore() {
  const { firestore } = useFirebase();
  if (!firestore) {
    throw new Error('Firebase firestore is not available');
  }
  return firestore;
}
