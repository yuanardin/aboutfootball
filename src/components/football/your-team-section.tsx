'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronRight, RefreshCw, ShieldHalf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/football/empty-state';
import { SectionHeader } from '@/components/football/section-header';
import { MatchCard } from '@/components/football/match-card';
import { useUser, useFirebase } from '@/firebase';
import { getTeamMatchesAction } from '@/app/actions';
import { toMatchDetailPath } from '@/lib/football-data/match-links';
import type { FootballDataMatchStatus } from '@/lib/football-data/types';
import type { TeamMatchesResult } from '@/lib/football-data/service';
import {
  getFavoriteTeam,
  getFirestoreErrorMessage,
  type FavoriteTeam,
} from '@/lib/favorites/favorite-team';
import { cn } from '@/lib/utils';
import type { MatchResult } from '@/lib/types';

const LIVE_POLLING_MS = 60_000;

type TeamMatchDto = NonNullable<TeamMatchesResult['upcoming']>;

type YourTeamSectionProps = {
  matches: MatchResult[];
  competition: string;
};

function YourTeamSkeleton() {
  return (
    <section className="page-shell mt-10 sm:mt-16" aria-busy="true">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-8 w-48" />
        </div>
      </div>
      <Skeleton className="mt-6 h-56 w-full rounded-xl" />
    </section>
  );
}

function isLiveStatus(status: FootballDataMatchStatus): boolean {
  return status === 'IN_PLAY' || status === 'PAUSED';
}

function isFinishedStatus(status: FootballDataMatchStatus): boolean {
  return status === 'FINISHED' || status === 'AWARDED';
}

function formatKickoff(utcDate: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(utcDate));
}

function MatchStatusBadge({ status }: { status: FootballDataMatchStatus }) {
  if (isLiveStatus(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-destructive/15 px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] text-destructive">
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
        LIVE
      </span>
    );
  }
  if (isFinishedStatus(status)) {
    return (
      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] text-muted-foreground">
        FT
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] text-muted-foreground">
      Scheduled
    </span>
  );
}

function TeamCrest({ crest, alt, size = 24 }: { crest: string | null; alt: string; size?: number }) {
  if (!crest) {
    return (
      <span className="grid shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
        <ShieldHalf className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={crest}
      alt={alt}
      width={size}
      height={size}
      className="h-6 w-6 shrink-0 object-contain"
    />
  );
}

function FixtureCard({
  label,
  match,
  teamName,
}: {
  label: string;
  match: TeamMatchDto | null;
  teamName: string;
}) {
  if (!match) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-card/40 p-5">
        <p className="text-label">{label}</p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          No {label.toLowerCase()} found for {teamName}.
        </p>
      </div>
    );
  }

  const showScore = isLiveStatus(match.status) || isFinishedStatus(match.status);
  const homeScore = match.homeTeam.score ?? '-';
  const awayScore = match.awayTeam.score ?? '-';
  const detailHref = toMatchDetailPath(match.id);

  return (
    <div className="rounded-lg border border-border/70 bg-card/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-label">{label}</p>
        <MatchStatusBadge status={match.status} />
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex min-w-0 items-center justify-end gap-2 text-right">
          <span className="truncate text-sm font-medium">{match.homeTeam.name}</span>
          <TeamCrest crest={match.homeTeam.crest} alt={match.homeTeam.name} />
        </div>
        <div className="flex min-w-16 items-center justify-center text-center">
          {showScore ? (
            <p className="font-headline text-lg font-bold tabular-nums tracking-tight">
              <span>{homeScore}</span>
              <span className="px-1.5 text-muted-foreground/70" aria-hidden="true">
                –
              </span>
              <span>{awayScore}</span>
            </p>
          ) : (
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">vs</p>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <TeamCrest crest={match.awayTeam.crest} alt={match.awayTeam.name} />
          <span className="truncate text-sm font-medium">{match.awayTeam.name}</span>
        </div>
      </div>

      <p className="mt-3.5 truncate text-xs text-muted-foreground">
        {formatKickoff(match.utcDate)}
        {match.competition ? ` · ${match.competition}` : ''}
        {match.matchday ? ` · Matchday ${match.matchday}` : ''}
      </p>

      {detailHref && (
        <Link
          href={detailHref}
          aria-label={`View ${match.homeTeam.name} vs ${match.awayTeam.name} match details`}
          className="mt-3 inline-flex items-center gap-1 rounded-md text-sm font-semibold text-primary transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View match details
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function LiveMatchBanner({ match }: { match: TeamMatchDto }) {
  const homeScore = match.homeTeam.score ?? '-';
  const awayScore = match.awayTeam.score ?? '-';
  const detailHref = toMatchDetailPath(match.id);

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5" role="status">
      <div className="flex flex-wrap items-center gap-3">
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
        </span>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-destructive">
          Live · {match.competition}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex min-w-0 items-center justify-end gap-2 text-right">
          <span className="truncate text-sm font-semibold">{match.homeTeam.name}</span>
          <TeamCrest crest={match.homeTeam.crest} alt={match.homeTeam.name} size={32} />
        </div>
        <div className="flex min-w-16 items-center justify-center text-center">
          <p className="font-headline text-xl font-bold tabular-nums tracking-tight">
            <span>{homeScore}</span>
            <span className="px-1.5 text-muted-foreground/70" aria-hidden="true">
              –
            </span>
            <span>{awayScore}</span>
          </p>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <TeamCrest crest={match.awayTeam.crest} alt={match.awayTeam.name} size={32} />
          <span className="truncate text-sm font-semibold">{match.awayTeam.name}</span>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Kicked off {formatKickoff(match.utcDate)}
        {match.matchday ? ` · Matchday ${match.matchday}` : ''} · score updates automatically
      </p>

      {detailHref && (
        <Link
          href={detailHref}
          aria-label={`View live ${match.homeTeam.name} vs ${match.awayTeam.name} match details`}
          className="mt-3 inline-flex items-center gap-1 rounded-md text-sm font-semibold text-primary transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View live match details
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export function YourTeamSection({ matches, competition }: YourTeamSectionProps) {
  const firebase = useFirebase();
  const firestore = firebase.firestore ?? null;
  const { data: user, isLoading: authLoading } = useUser();

  const [favorite, setFavorite] = useState<FavoriteTeam | null>(null);
  const [reading, setReading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [teamMatches, setTeamMatches] = useState<TeamMatchesResult | null>(null);
  const [matchesLoading, setMatchesLoading] = useState(false);

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

  const loadTeamMatches = useCallback(async (teamId: number) => {
    setMatchesLoading(true);
    try {
      setTeamMatches(await getTeamMatchesAction(teamId));
    } catch {
      setTeamMatches({
        upcoming: null,
        previous: null,
        live: null,
        error: 'Unable to load this team’s matches right now. Please try again later.',
        stale: false,
      });
    } finally {
      setMatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (favorite) {
      loadTeamMatches(favorite.id);
    }
  }, [favorite, loadTeamMatches]);

  useEffect(() => {
    if (!favorite || !teamMatches?.live) {
      return;
    }
    const timer = setInterval(() => {
      loadTeamMatches(favorite.id);
    }, LIVE_POLLING_MS);
    return () => clearInterval(timer);
  }, [favorite, teamMatches?.live, loadTeamMatches]);

  const handleRefreshMatches = useCallback(() => {
    if (favorite) {
      loadTeamMatches(favorite.id);
    }
  }, [favorite, loadTeamMatches]);

  if (authLoading || reading) {
    return <YourTeamSkeleton />;
  }

  if (!user) {
    return (
      <section className="page-shell mt-10 sm:mt-16">
        <SectionHeader eyebrow="Personalized" title="Your team" />
        <EmptyState
          title="Sign in to personalize your results"
          description="Log in and pick your favorite club to see its live results, next kickoff and league position right here."
          icon={<ShieldHalf className="h-5 w-5" aria-hidden="true" />}
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
        <SectionHeader eyebrow="Personalized" title="Your team" />
        <EmptyState
          title="Choose your team"
          description="Pick your favorite club to see its results, league position and news on this page."
          icon={<ShieldHalf className="h-5 w-5" aria-hidden="true" />}
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
  const recentMatches = matches
    .filter((match) => match.homeTeam.name === teamName || match.awayTeam.name === teamName)
    .slice(0, 3);

  const hasMatches = Boolean(
    teamMatches?.upcoming || teamMatches?.previous || teamMatches?.live
  );
  const matchesError = teamMatches?.error ?? null;
  const isStale = Boolean(teamMatches?.stale);

  return (
    <section className="page-shell mt-10 sm:mt-16">
      <SectionHeader
        eyebrow="Personalized"
        title="Your team"
        description={`Live updates for ${teamName} in the ${competition}.`}
        href="/profile"
        action="Change team"
      />

      <div className="card-surface overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border/60 bg-card/60 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            {favorite.crest ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={favorite.crest}
                alt={teamName}
                width={56}
                height={56}
                className="h-14 w-14 shrink-0 object-contain"
              />
            ) : (
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                <ShieldHalf className="h-6 w-6" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0">
              <p className="eyebrow">Your team</p>
              <h3 className="text-card-title truncate text-2xl">{teamName}</h3>
            </div>
          </div>
        </div>

        <div className="border-t border-border/60 bg-card/40 p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h4 className="text-label">Next &amp; last match</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Live fixtures for {teamName} — next kickoff, latest result and in-play score
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshMatches}
              disabled={matchesLoading}
              aria-label="Refresh matches"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', matchesLoading && 'animate-spin')}
                aria-hidden="true"
              />
              Refresh
            </Button>
          </div>

          {matchesError && (
            <div
              role="status"
              className={cn(
                'mt-4 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs leading-5',
                isStale
                  ? 'border-warning/40 bg-warning/10 text-warning-foreground'
                  : 'border-destructive/30 bg-destructive/5 text-destructive'
              )}
            >
              <AlertTriangle
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  isStale ? 'text-warning' : 'text-destructive'
                )}
                aria-hidden="true"
              />
              {matchesError}
            </div>
          )}

          {matchesLoading && !teamMatches ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
            </div>
          ) : matchesError && !isStale && !hasMatches ? (
            <div className="mt-4 rounded-lg border border-dashed border-border/70 bg-card/40 p-5">
              <p className="text-sm leading-6 text-muted-foreground">
                We could not load {teamName}’s fixtures right now. No scores or kickoff times are
                shown to avoid inaccuracies.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={handleRefreshMatches}
                disabled={matchesLoading}
              >
                <RefreshCw
                  className={cn('h-3.5 w-3.5', matchesLoading && 'animate-spin')}
                  aria-hidden="true"
                />
                Try again
              </Button>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {teamMatches?.live && (
                <div className="sm:col-span-2">
                  <LiveMatchBanner match={teamMatches.live} />
                </div>
              )}
              <FixtureCard
                label="Next match"
                match={teamMatches?.upcoming ?? null}
                teamName={teamName}
              />
              <FixtureCard
                label="Last match"
                match={teamMatches?.previous ?? null}
                teamName={teamName}
              />
            </div>
          )}
        </div>

        <div className="border-t border-border/60 bg-background p-5">
          <h4 className="text-label mb-3">Recent matches</h4>
          {recentMatches.length ? (
            <div className="space-y-2.5">
              {recentMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              No recent {competition} results for {teamName} in the current feed.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}