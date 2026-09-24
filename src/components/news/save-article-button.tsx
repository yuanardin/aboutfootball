'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Loader2 } from 'lucide-react';
import { useUser, useFirebase } from '@/firebase';
import type { NewsArticle } from '@/lib/types';
import {
  getSavedArticles,
  getFirestoreErrorMessage,
  saveArticle,
  unsaveArticle,
  type SavedArticle,
} from '@/lib/favorites/saved-articles';
import { cn } from '@/lib/utils';

type SaveArticleButtonProps = {
  article: NewsArticle;
  className?: string;
};

export function SaveArticleButton({ article, className }: SaveArticleButtonProps) {
  const router = useRouter();
  const firebase = useFirebase();
  const firestore = firebase.firestore ?? null;
  const { data: user, isLoading: authLoading } = useUser();

  const [saved, setSaved] = useState(false);
  const [reading, setReading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stored, setStored] = useState<SavedArticle[]>([]);

  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resync = useCallback(async () => {
    if (!firestore || !user) {
      setSaved(false);
      setStored([]);
      setReading(false);
      return;
    }
    setReading(true);
    try {
      const articles = await getSavedArticles(firestore, user.uid);
      setStored(articles);
      setSaved(articles.some((item) => item.id === article.id));
    } catch {
      setSaved(false);
    } finally {
      setReading(false);
    }
  }, [article.id, firestore, user]);

  useEffect(() => {
    resync();
  }, [resync]);

  useEffect(() => {
    if (!error) return;
    errorTimer.current = setTimeout(() => setError(null), 3500);
    return () => {
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
  }, [error]);

  const handleToggle = async () => {
    if (busy) return;

    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (!firestore) {
      setError('Saved articles are unavailable right now.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (saved) {
        const existing = stored.find((item) => item.id === article.id);
        if (existing) {
          await unsaveArticle(firestore, user.uid, existing);
          setStored((items) => items.filter((item) => item.id !== article.id));
          setSaved(false);
        } else {
          await resync();
        }
      } else {
        const savedArticle = await saveArticle(firestore, user.uid, article);
        setStored((items) => [...items, savedArticle]);
        setSaved(true);
      }
    } catch (loadError) {
      setError(getFirestoreErrorMessage(loadError));
      await resync();
    } finally {
      setBusy(false);
    }
  };

  const label = authLoading || reading ? 'Loading saved status' : saved ? 'Remove from saved' : 'Save article';

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void handleToggle();
      }}
      disabled={busy || authLoading || reading}
      aria-label={label}
      aria-pressed={saved}
      aria-live="polite"
      title={error ?? label}
      className={cn(
        'group/bookmark pointer-events-auto absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full border bg-background/90 shadow-card backdrop-blur transition',
        'hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
        saved ? 'border-primary/40 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
        className
      )}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Bookmark
          className={cn('h-4 w-4', saved && 'fill-current')}
          aria-hidden="true"
        />
      )}
    </button>
  );
}