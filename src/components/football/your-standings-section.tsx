'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronRight, RefreshCw, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/football/empty-state';
import { SectionHeader } from '@/components/football/section-header';
import { useUser, useFirebase } from '@/firebase';
import { getStandingsAction, type StandingsActionResult } from '@/app/actions';
import {
  getFavoriteTeam,
  getFirestoreErrorMessage,
  type FavoriteTeam,
} from '@/lib/favorites/favorite-team';
import { cn } from '@/lib/utils';
import type { Standing } from '@/lib/types';

function YourStandingsSkeleton() {
  return (
    <section className="page-shell mt-10 sm:mt-16" aria-busy="true">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-8 w-56" />
        </div>
      </div>
      <Skeleton className="mt-6 h-56 w-full rounded-xl" />
    </section>
  );
}

function FormChips({ form }: { form: Standing['form'] }) {
  return (
    <div className="flex gap-1">
      {form.length ? (
        form.map((result, index) => (
          <span
            key={`${result}-${index}`}
            className={cn(
              'grid h-5 w-5 place-items-center rounded text-[10px] font-bold',
              result === 'W' && 'bg-success/20 text-success',
              result === 'D' && 'bg-muted text-muted-foreground',
              result === 'L' && 'bg-destructive/20 text-destructive'
            )}
            aria-label={`${result} ${index + 1}`}
          >
            {result}
          </span>
        ))
      ) : (
        <span className="text-xs text-muted-foreground">No recent form</span>
      )}
    </div>
  );
}

export function YourStandingsSection() {
  const firebase = useFirebase();
  const firestore = firebase.firestore ?? null;
  const { data: user, isLoading: authLoading } = useUser();

  const [favorite, setFavorite] = useState<FavoriteTeam | null>(null);
  const [reading, setReading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [standings, setStandings] = useState<StandingsActionResult | null>(null);
  const [standingsLoading, setStandingsLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!user || !firestore) {
      setFavorite(null);
      setReading(false);
      return;
    }
    setReading(true);
    setError(null);
    getFavoriteTeam(firestore, user.uid)
      .then((team) => setFavorite(team))
      .catch((loadError) => setError(getFirestoreErrorMessage(loadError)))
      .finally(() => setReading(false));
  }, [firestore, user]);

  const loadStandings = useCallback(async () => {
    setStandingsLoading(true);
    try {
      setStandings(await getStandingsAction());
    } catch {
      setStandings({
        standings: [],
        meta: null,
        error: 'Unable to load the live table right now. Please try again later.',
      });
    } finally {
      setStandingsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (favorite && !standings) {
      loadStandings();
    }
  }, [favorite, standings, loadStandings]);

  if (authLoading || reading) {
    return <YourStandingsSkeleton />;
  }

  if (!user) {
    return (
      <section className="page-shell mt-10 sm:mt-16">
        <SectionHeader eyebrow="Personalized" title="Your league position" />
        <EmptyState
          title="Sign in to see your league position"
          description="Log in and pick your favorite club to see where it sits in the live Premier League table."
          icon={<Trophy className="h-5 w-5" aria-hidden="true" />}
          action={
            <Button asChild>
              <Link href="/login">
                Log in <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          }
        />
      </section>
    );
  }

  if (error) {
    return (
      <section className="page-shell mt-10 sm:mt-16">
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

  if (!favorite) {
    return (
      <section className="page-shell mt-10 sm:mt-16">
        <SectionHeader eyebrow="Personalized" title="Your league position" />
        <EmptyState
          title="Choose your team"
          description="Pick your favorite club to see its live league position, form and points on this page."
          icon={<Trophy className="h-5 w-5" aria-hidden="true" />}
          action={
            <Button asChild>
              <Link href="/profile">
                Choose your team <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          }
        />
      </section>
    );
  }

  const teamName = favorite.name;
  const row = standings?.standings.find((standingRow) => standingRow.team.name === teamName) ?? null;
  const standingsError = standings?.error ?? null;
  const hasStandings = Boolean(standings?.standings.length);
  const meta = standings?.meta ?? null;
  const competition = meta?.competition ?? 'Premier League';

  return (
    <section className="page-shell mt-10 sm:mt-16">
      <SectionHeader
        eyebrow="Personalized"
        title="Your league position"
        description={`Where ${teamName} sit in the live ${competition} table.`}
        href="/standings"
        action="Full table"
      />

      <div className="card-surface overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border/60 bg-card/60 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            {favorite.crest ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={favorite.crest}
                alt={teamName}
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 object-contain"
              />
            ) : (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                <Trophy className="h-5 w-5" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0">
              <p className="eyebrow">Watching</p>
              <h3 className="text-card-title truncate text-xl">{teamName}</h3>
            </div>
          </div>

          <button
            type="button"
            onClick={loadStandings}
            disabled={standingsLoading}
            aria-label="Refresh league position"
            className="flex shrink-0 items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <RefreshCw
              className={cn('h-3 w-3', standingsLoading && 'animate-spin')}
              aria-hidden="true"
            />
            {standingsLoading ? 'Updating...' : 'Refresh'}
          </button>
        </div>

        <div className="border-t border-border/60 bg-card/40 p-5 sm:p-6">
          {standingsLoading && !standings ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Skeleton className="h-24 rounded-lg sm:col-span-3" />
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
            </div>
          ) : standingsError && !hasStandings ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-card/40 p-5">
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs leading-5 text-destructive"
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {standingsError}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={loadStandings}
                disabled={standingsLoading}
              >
                <RefreshCw
                  className={cn('h-3.5 w-3.5', standingsLoading && 'animate-spin')}
                  aria-hidden="true"
                />
                Try again
              </Button>
            </div>
          ) : hasStandings && row ? (
            <>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Position
                  </p>
                  <p className="font-headline text-4xl font-bold tabular-nums tracking-tight sm:text-5xl">
                    {row.rank}
                  </p>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Played
                  </span>
                  <span className="text-card-title text-2xl font-bold tabular-nums">{row.played}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Points
                  </span>
                  <span className="text-card-title text-2xl font-bold tabular-nums">{row.points}</span>
                </div>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                {[
                  { label: 'Won', value: String(row.win) },
                  { label: 'Drawn', value: String(row.draw) },
                  { label: 'Lost', value: String(row.loss) },
                  { label: 'Goal difference', value: row.gd > 0 ? `+${row.gd}` : String(row.gd) },
                  { label: 'League position', value: String(row.rank) },
                  { label: 'Points', value: String(row.points) },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-border/70 bg-background px-4 py-3">
                    <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                    <dd className="mt-0.5 text-card-title text-lg tabular-nums">{stat.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                <span className="text-xs text-muted-foreground">Recent form</span>
                <FormChips form={row.form} />
              </div>

              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Live table from {meta?.provider ?? 'football-data.org'} ({competition},{' '}
                {meta?.season ?? ''}). Updated {new Date(meta?.lastUpdated ?? '').toLocaleTimeString('en')}.
              </p>
            </>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm leading-6 text-muted-foreground">
                {teamName} is not in the current {competition} table.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadStandings}
                disabled={standingsLoading}
              >
                <RefreshCw
                  className={cn('h-3.5 w-3.5', standingsLoading && 'animate-spin')}
                  aria-hidden="true"
                />
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}