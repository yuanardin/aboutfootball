'use client';

import { useEffect, useState } from 'react';
import { ShieldHalf } from 'lucide-react';
import { useFirebase, useUser } from '@/firebase';
import { getFavoriteTeam } from '@/lib/favorites/favorite-team';

// "Your Team" marker for the match detail scoreboard. Reads the existing
// users/{uid}.favoriteTeam document and nothing else — the Firestore schema
// is unchanged. Renders nothing until the favorite is known, and nothing at
// all when this team is not the user's favorite (or the user is signed out).
export function YourTeamBadge({ teamId }: { teamId: number | null }) {
  const firebase = useFirebase();
  const firestore = firebase.firestore ?? null;
  const { data: user } = useUser();
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    if (!user || !firestore || !teamId) {
      setIsFavorite(false);
      return;
    }
    let cancelled = false;
    getFavoriteTeam(firestore, user.uid)
      .then((team) => {
        if (!cancelled) setIsFavorite(team?.id === teamId);
      })
      .catch(() => {
        if (!cancelled) setIsFavorite(false);
      });
    return () => {
      cancelled = true;
    };
  }, [firestore, user, teamId]);

  if (!isFavorite) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-primary">
      <ShieldHalf className="h-3 w-3" aria-hidden="true" />
      Your Team
    </span>
  );
}
