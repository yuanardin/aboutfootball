'use client';

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '../provider';

export function useUser() {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setInitialized(true);
      return;
    }

    const currentUser = auth.currentUser ?? null;
    setUser(currentUser);
    setInitialized(false);

    const unsubscribe = onAuthStateChanged(auth, (next) => {
      setUser(next);
      setInitialized(true);
    });

    return () => unsubscribe();
  }, [auth]);

  const isLoading = Boolean(auth) && !initialized;
  const isAuthenticated = Boolean(auth) && initialized && Boolean(user);
  const isUnauthenticated = Boolean(auth) && initialized && !user;

  return {
    data: user,
    isLoading,
    isAuthenticated,
    isUnauthenticated,
    isReady: initialized,
  };
}