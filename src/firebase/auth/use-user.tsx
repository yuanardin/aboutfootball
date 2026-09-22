'use client';

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '../provider';

/**
 * Tracks the current Firebase user across auth state changes.
 *
 * The user is intentionally seeded as `null` (never from `auth.currentUser`).
 * `auth.currentUser` is populated from persisted storage, which is not available
 * during server rendering — reading it in the initial state would make the header
 * render a logged-in avatar on the client that the server/HTML never rendered,
 * producing a hydration mismatch. Seeding `null` keeps first paint identical on
 * server and client; `onAuthStateChanged` fills the real user right after mount.
 */
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

    const unsubscribe = onAuthStateChanged(auth, (next) => {
      setUser(next);
      setInitialized(true);
    });

    return () => unsubscribe();
  }, [auth]);

  return { data: user, isLoading: Boolean(auth) && !initialized };
}