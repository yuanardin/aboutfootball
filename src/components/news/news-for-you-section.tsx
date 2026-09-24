'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronRight, Newspaper, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/football/empty-state';
import { SectionHeader } from '@/components/football/section-header';
import { NewsCard } from '@/components/news/news-card';
import { useUser, useFirebase } from '@/firebase';
import { getNewsForTeamAction } from '@/app/actions';
import type { TeamNewsResult } from '@/lib/news/service';
import {
  getFavoriteTeam,
  getFirestoreErrorMessage,
  type FavoriteTeam,
} from '@/lib/favorites/favorite-team';
import {
  getPreferences,
  TOPIC_OPTIONS,
  type UserPreferences,
} from '@/lib/favorites/preferences';
import { cn } from '@/lib/utils';

function formatUpdated(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'just now';
  return date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}

export function NewsForYouSection() {
  const firebase = useFirebase();
  const firestore = firebase.firestore ?? null;
  const { data: user, isLoading: authLoading } = useUser();

  const [favorite, setFavorite] = useState<FavoriteTeam | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [reading, setReading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [teamNews, setTeamNews] = useState<TeamNewsResult | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!user || !firestore) {
      setFavorite(null);
      setPreferences(null);
      setReading(false);
      return;
    }
    setReading(true);
    setError(null);
    Promise.all([getFavoriteTeam(firestore, user.uid), getPreferences(firestore, user.uid)])
      .then(([team, prefs]) => {
        setFavorite(team);
        setPreferences(prefs);
      })
      .catch((loadError) => setError(getFirestoreErrorMessage(loadError)))
      .finally(() => setReading(false));
  }, [firestore, user]);

  const loadNews = useCallback(
    async (favoriteTeam: FavoriteTeam) => {
      setNewsLoading(true);
      try {
        setTeamNews(
          await getNewsForTeamAction(
            favoriteTeam.name,
            [favoriteTeam.name],
            preferences
              ? { topics: preferences.topics, leagues: preferences.leagues }
              : undefined
          )
        );
      } catch {
        setTeamNews({
          articles: [],
          club: favoriteTeam.name,
          provider: 'NewsAPI',
          lastUpdated: new Date().toISOString(),
          error: 'Unable to load personalized news right now. Please try again later.',
        });
      } finally {
        setNewsLoading(false);
      }
    },
    [preferences]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (favorite) {
      loadNews(favorite);
    }
  }, [favorite, loadNews]);

  const handleRefresh = useCallback(() => {
    if (favorite) {
      loadNews(favorite);
    }
  }, [favorite, loadNews]);

  if (authLoading || reading) {
    return (
      <section className="page-shell mt-10 sm:mt-16" aria-busy="true">
        <div className="flex items-end justify-between gap-4">
          <div>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-8 w-48" />
          </div>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </section>
    );
  }

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <section className="page-shell mt-10 sm:mt-16">
        <SectionHeader eyebrow="Personalized" title="News for You" />
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground" role="alert">
            {error}
          </p>
          <Button variant="outline" className="mt-4" onClick={refresh}>
            Try again
          </Button>
        </div>
      </section>
    );
  }

  // The section is only rendered for users who are signed in AND have chosen a
  // favorite team — no favorite, no personalization, no section.
  if (!favorite) {
    return null;
  }

  const club = favorite.name;
  const articles = teamNews?.articles ?? [];
  const newsError = teamNews?.error ?? null;
  const showStale = Boolean(teamNews && newsError && articles.length);
  const hardError = Boolean(newsError && !articles.length);

  const activeTopics = preferences?.topics ?? [];
  const activeLeagues = preferences?.leagues ?? [];
  const preferencesApplied = Boolean(activeTopics.length || activeLeagues.length);
  const preferencesLabel = [
    ...activeTopics.map((id) => TOPIC_OPTIONS.find((option) => option.id === id)?.label).filter(Boolean),
    ...activeLeagues,
  ].join(', ');

  return (
    <section className="page-shell mt-10 sm:mt-16">
      <SectionHeader
        eyebrow="Personalized"
        title="News for You"
        description={
          preferencesApplied
            ? `Real headlines about ${club}, ranked by your preferences (${preferencesLabel}).`
            : `Fresh football headlines about ${club}, newest first.`
        }
      />

      {teamNews && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={newsLoading}
            aria-label="Refresh personalized news"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', newsLoading && 'animate-spin')}
              aria-hidden="true"
            />
            Updated {formatUpdated(teamNews.lastUpdated)}
          </Button>
          {preferencesApplied && (
            <p className="text-xs leading-5 text-muted-foreground">
              Ranked by your preferences — change them on your profile.
            </p>
          )}
        </div>
      )}

      {showStale && (
        <div
          role="status"
          className="mb-4 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs leading-5 text-warning-foreground"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
          {newsError}
        </div>
      )}

      {newsLoading && !teamNews ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : hardError ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-secondary text-muted-foreground">
            <Newspaper className="h-5 w-5" aria-hidden="true" />
          </span>
          <h3 className="text-card-title text-base">Couldn&apos;t load personalized news</h3>
          <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground" role="alert">
            We only feature real, up-to-the-minute football stories. The news provider could not be
            reached right now ({newsError}). Check back shortly.
          </p>
          <Button variant="outline" className="mt-5" onClick={handleRefresh} disabled={newsLoading}>
            Try again
          </Button>
        </div>
      ) : articles.length ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Live personalized coverage for {club} from {teamNews?.provider ?? 'NewsAPI'} — updated{' '}
            {teamNews ? formatUpdated(teamNews.lastUpdated) : 'just now'}.
          </p>
        </>
      ) : (
        <EmptyState
          title="No recent news for your team"
          description={`We could not find recent coverage about ${club}. Head over to the full football feed to keep up with everything.`}
          icon={<Newspaper className="h-5 w-5" aria-hidden="true" />}
          action={
            <Button asChild>
              <Link href="/news">
                All football news <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          }
        />
      )}
    </section>
  );
}