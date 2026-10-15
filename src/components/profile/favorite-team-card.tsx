'use client';

import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { Loader2, RefreshCw, ShieldHalf, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TeamPicker } from './team-picker';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { getTeamMatchesAction } from '@/app/actions';
import type { TeamMatchDto, TeamMatchesResult } from '@/lib/football-data/service';
import {
  getFavoriteTeam,
  getFirestoreErrorMessage,
  removeFavoriteTeam,
  saveFavoriteTeam,
  type FavoriteTeam,
} from '@/lib/favorites/favorite-team';
import { cn } from '@/lib/utils';

function TeamCrest({ crest, name, className }: { crest?: string | null; name: string; className?: string }) {
  if (!crest) {
    return (
      <span
        className={cn(
          'grid shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground',
          className
        )}
      >
        <ShieldHalf className="h-5 w-5" aria-hidden="true" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={crest} alt={name} width={64} height={64} className={cn('shrink-0 object-contain', className)} />;
}

function formatSavedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Saved recently';
  return `Saved ${new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)}`;
}

function formatKickoff(utcDate: string): string {
  const date = new Date(utcDate);
  if (Number.isNaN(date.getTime())) return 'Date TBC';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function isLiveMatchStatus(status: TeamMatchDto['status']): boolean {
  return status === 'IN_PLAY' || status === 'PAUSED';
}

function isFinishedMatchStatus(status: TeamMatchDto['status']): boolean {
  return status === 'FINISHED' || status === 'AWARDED';
}

function FixtureRow({ label, match }: { label: string; match: TeamMatchDto | null }) {
  if (!match) return null;

  const live = isLiveMatchStatus(match.status);
  const finished = isFinishedMatchStatus(match.status);
  const homeScore = match.homeTeam.score ?? '-';
  const awayScore = match.awayTeam.score ?? '-';

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 px-3.5 py-2.5">
      <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate text-right text-sm font-medium">
        {match.homeTeam.name}{' '}
        <span className="px-1 text-xs text-muted-foreground">vs</span>{' '}
        {match.awayTeam.name}
      </span>
      <span
        className={cn(
          'shrink-0 text-xs font-bold tabular-nums',
          live ? 'text-destructive' : finished ? 'text-muted-foreground' : 'text-foreground'
        )}
      >
        {live ? (
          <>
            {homeScore}–{awayScore}
            <span className="ml-1.5 inline-flex items-center gap-1 rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] tracking-[0.08em]">
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive" />
              </span>
              LIVE
            </span>
          </>
        ) : finished ? (
          <>{homeScore}–{awayScore} FT</>
        ) : (
          formatKickoff(match.utcDate)
        )}
      </span>
    </li>
  );
}

export function FavoriteTeamCard({ user }: { user: User }) {
  const firebase = useFirebase();
  const firestore = firebase.firestore ?? null;
  const { toast } = useToast();

  const [favorite, setFavorite] = useState<FavoriteTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [teamMatches, setTeamMatches] = useState<TeamMatchesResult | null>(null);
  const [matchesLoading, setMatchesLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!firestore) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    getFavoriteTeam(firestore, user.uid)
      .then((team) => setFavorite(team))
      .catch((error) => setLoadError(getFirestoreErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [firestore, user.uid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadMatches = useCallback(async (teamId: number) => {
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
    if (favorite) {
      loadMatches(favorite.id);
    }
  }, [favorite, loadMatches]);

  const handleSelect = async (team: {
    id: number;
    name: string;
    shortName: string;
    crest: string | null;
    competitionCode: Exclude<FavoriteTeam['competitionCode'], null>;
  }) => {
    if (!firestore || saving) return;
    setSaving(true);
    try {
      const saved = await saveFavoriteTeam(firestore, user.uid, {
        id: team.id,
        name: team.shortName ?? team.name,
        crest: team.crest,
        competitionCode: team.competitionCode,
      });
      setFavorite(saved);
      setPickerOpen(false);
      toast({ title: 'Team saved', description: `${team.shortName ?? team.name} is now your favorite team.` });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Unable to save your team',
        description: getFirestoreErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!firestore || removing) return;
    setRemoving(true);
    try {
      await removeFavoriteTeam(firestore, user.uid);
      setFavorite(null);
      setTeamMatches(null);
      toast({ description: 'Your favorite team has been removed.' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Unable to remove your team',
        description: getFirestoreErrorMessage(error),
      });
    } finally {
      setRemoving(false);
    }
  };

  const busy = saving || removing;
  const matchesError = teamMatches?.error ?? null;
  const hasMatches = Boolean(teamMatches?.live || teamMatches?.upcoming || teamMatches?.previous);

  return (
    <>
      <Card className="card-surface mt-6">
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-card-title text-lg">Favorite team</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Follow your club with a personalized homepage.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 flex items-center gap-4">
              <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
          ) : loadError ? (
            <div className="mt-6 flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4">
              <p className="text-sm leading-6 text-destructive" role="alert">
                {loadError}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={refresh}>
                Try again
              </Button>
            </div>
          ) : favorite ? (
            <div className="mt-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <TeamCrest
                    crest={favorite.crest}
                    name={favorite.name}
                    className="h-16 w-16 rounded-full ring-1 ring-border"
                  />
                  <div className="min-w-0">
                    <p className="eyebrow">Your team</p>
                    <p className="text-card-title mt-1 truncate text-xl">{favorite.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatSavedDate(favorite.updatedAt)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => setPickerOpen(true)} disabled={busy}>
                    Change team
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleRemove}
                    disabled={busy}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    {removing ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="size-4" aria-hidden="true" />
                    )}
                    Remove
                  </Button>
                </div>
              </div>

              <div className="mt-6 border-t border-border/60 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-label">Realtime results</h3>
                  <button
                    type="button"
                    onClick={() => loadMatches(favorite.id)}
                    disabled={matchesLoading}
                    aria-label="Refresh favorite team results"
                    className="flex items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <RefreshCw
                      className={cn('h-3 w-3', matchesLoading && 'animate-spin')}
                      aria-hidden="true"
                    />
                    {matchesLoading ? 'Updating...' : 'Refresh'}
                  </button>
                </div>

                {matchesLoading && !teamMatches ? (
                  <div className="mt-3 space-y-2" role="status" aria-label="Loading matches">
                    <Skeleton className="h-10 w-full rounded-lg" />
                    <Skeleton className="h-10 w-full rounded-lg" />
                  </div>
                ) : matchesError && !hasMatches ? (
                  <div className="mt-3 flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                    <p className="text-sm leading-6 text-destructive" role="alert">
                      {matchesError}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => loadMatches(favorite.id)}
                      disabled={matchesLoading}
                    >
                      Try again
                    </Button>
                  </div>
                ) : hasMatches ? (
                  <div className="mt-3">
                    {matchesError && (
                      <p className="mb-2 text-xs leading-5 text-warning-foreground" role="status">
                        {matchesError}
                      </p>
                    )}
                    <ul className="space-y-2">
                      {teamMatches?.live ? <FixtureRow label="Live" match={teamMatches.live} /> : null}
                      <FixtureRow label="Next" match={teamMatches?.upcoming ?? null} />
                      <FixtureRow label="Last" match={teamMatches?.previous ?? null} />
                    </ul>
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    No upcoming or recent matches found for {favorite.name} right now.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <div
                className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/40 px-6 py-9 text-center"
                role="region"
                aria-label="No favorite team chosen"
              >
                <span className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-muted-foreground">
                  <Star className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-card-title mt-3 text-base">Choose your team</h3>
                <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">
                  Pick your favorite club and ScoreCast will show its results, league position and
                  news on the homepage.
                </p>
                <Button type="button" className="mt-5" onClick={() => setPickerOpen(true)}>
                  Choose your team
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <TeamPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleSelect}
        saving={saving}
      />
    </>
  );
}