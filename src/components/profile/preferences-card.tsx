'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, Check, Loader2, Save, ShieldHalf, SlidersHorizontal } from 'lucide-react';
import type { User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getFavoriteTeam, getFirestoreErrorMessage, type FavoriteTeam } from '@/lib/favorites/favorite-team';
import {
  getPreferences,
  LEAGUE_OPTIONS,
  NEWS_SCOPE_OPTIONS,
  savePreferences,
  TOPIC_OPTIONS,
  type NewsScope,
  type UserPreferences,
} from '@/lib/favorites/preferences';

function Chip({
  active,
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'min-h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-secondary/40 text-muted-foreground hover:border-primary/60 hover:text-foreground'
      )}
    >
      {label}
    </button>
  );
}

export function PreferencesCard({ user }: { user: User }) {
  const firebase = useFirebase();
  const firestore = firebase.firestore ?? null;
  const { toast } = useToast();

  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [favorite, setFavorite] = useState<FavoriteTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);

  const [scope, setScope] = useState<NewsScope>('club');
  const [leagues, setLeagues] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [matchAlerts, setMatchAlerts] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    if (!firestore) {
      setLoading(false);
      setLoadError('Preferences are unavailable right now.');
      return;
    }
    setLoading(true);
    setLoadError(null);
    setTeamError(null);
    Promise.all([getPreferences(firestore, user.uid), getFavoriteTeam(firestore, user.uid)])
      .then(([prefs, team]) => {
        setPreferences(prefs);
        setFavorite(team);
        setScope(prefs.newsScope);
        setLeagues(prefs.leagues);
        setTopics(prefs.topics);
        setMatchAlerts(prefs.matchAlerts);
      })
      .catch((error) => setLoadError(getFirestoreErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [firestore, user.uid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!savedNote) return;
    noteTimer.current = setTimeout(() => setSavedNote(false), 3000);
    return () => {
      if (noteTimer.current) clearTimeout(noteTimer.current);
    };
  }, [savedNote]);

  const dirty = useMemo(
    () =>
      preferences !== null &&
      (scope !== preferences.newsScope ||
        leagues.join('|') !== preferences.leagues.join('|') ||
        topics.join('|') !== preferences.topics.join('|') ||
        matchAlerts !== preferences.matchAlerts),
    [leagues, matchAlerts, preferences, scope, topics]
  );

  const toggleLeague = (league: string) => {
    setLeagues((items) =>
      items.includes(league) ? items.filter((item) => item !== league) : [...items, league]
    );
    setSaveError(null);
    setSavedNote(false);
  };

  const toggleTopic = (id: string) => {
    setTopics((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id]
    );
    setSaveError(null);
    setSavedNote(false);
  };

  const handleSave = async () => {
    if (!firestore || saving) return;
    setSaving(true);
    setSaveError(null);
    setSavedNote(false);
    try {
      const saved = await savePreferences(firestore, user.uid, {
        newsScope: scope,
        leagues,
        topics,
        matchAlerts,
      });
      setPreferences(saved);
      setSavedNote(true);
      toast({ title: 'Preferences saved', description: 'News for You now uses your settings.' });
    } catch (error) {
      const message = getFirestoreErrorMessage(error);
      setSaveError(message);
      toast({ variant: 'destructive', title: 'Unable to save preferences', description: message });
    } finally {
      setSaving(false);
    }
  };

  const scopeOption = NEWS_SCOPE_OPTIONS.find((option) => option.id === scope);

  return (
    <Card className="card-surface mt-6">
      <CardHeader className="border-b border-border/60 px-6 py-5 sm:px-8">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-card-title text-lg">Preferences</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              How News for You ranks your football stories — stored privately on your profile.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 sm:p-8">
        {loading ? (
          <div className="space-y-6" aria-busy="true">
            <div>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-3 h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-4 w-32" />
              <div className="mt-3 flex gap-2">
                <Skeleton className="h-9 w-24 rounded-full" />
                <Skeleton className="h-9 w-24 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4">
            <p className="text-sm leading-6 text-destructive" role="alert">
              {loadError}
            </p>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            {/* Favorite team reference — the team itself is managed in the card above. */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/40 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                {favorite?.crest ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={favorite.crest}
                    alt={favorite.name}
                    width={32}
                    height={32}
                    className="h-8 w-8 shrink-0 object-contain"
                  />
                ) : (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                    <ShieldHalf className="h-4 w-4" aria-hidden="true" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-label text-[11px]">Favorite team</p>
                  <p className="truncate text-sm font-medium">
                    {favorite ? favorite.name : 'No team picked yet'}
                  </p>
                </div>
              </div>
              {teamError ? (
                <p className="text-xs text-destructive" role="status">
                  {teamError}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {favorite ? 'Managed in the favorite team card above.' : 'Pick one in the favorite team card above.'}
                </p>
              )}
            </div>

            {/* Match alerts */}
            <div className="mt-6 flex items-start justify-between gap-4 rounded-lg border border-border/70 bg-card/40 px-4 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <BellRing className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Match alerts</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    Keep the bell in the header up to date with your favorite team&apos;s matches.
                  </p>
                </div>
              </div>
              <Switch
                checked={matchAlerts}
                onCheckedChange={(checked) => {
                  setMatchAlerts(checked);
                  setSaveError(null);
                  setSavedNote(false);
                }}
                disabled={saving}
                aria-label="Toggle match alerts"
              />
            </div>

            {/* Scope */}
            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">News priority</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {NEWS_SCOPE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={scope === option.id}
                    onClick={() => {
                      setScope(option.id);
                      setSaveError(null);
                      setSavedNote(false);
                    }}
                    disabled={saving}
                    className={cn(
                      'rounded-lg border px-4 py-3 text-left transition',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                      scope === option.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card/40 hover:border-primary/40'
                    )}
                  >
                    <span
                      className={cn(
                        'flex items-center justify-between text-sm font-semibold',
                        scope === option.id ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {option.label}
                      {scope === option.id && <Check className="h-4 w-4" aria-hidden="true" />}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Leagues */}
            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Preferred competitions</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Rank stories from these football competitions higher in News for You.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {LEAGUE_OPTIONS.map((league) => (
                  <Chip
                    key={league}
                    label={league}
                    active={leagues.includes(league)}
                    onClick={() => toggleLeague(league)}
                    disabled={saving}
                  />
                ))}
              </div>
            </div>

            {/* Topics */}
            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Content you care about</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Surface stories about these kinds of football news first.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {TOPIC_OPTIONS.map((topic) => (
                  <Chip
                    key={topic.id}
                    label={topic.label}
                    active={topics.includes(topic.id)}
                    onClick={() => toggleTopic(topic.id)}
                    disabled={saving}
                  />
                ))}
              </div>
            </div>

            {(saveError || savedNote) && (
              <p
                role="status"
                className={cn(
                  'mt-5 rounded-lg border px-3 py-2.5 text-sm leading-6',
                  saveError
                    ? 'border-destructive/30 bg-destructive/5 text-destructive'
                    : 'border-success/40 bg-success/10 text-success'
                )}
              >
                {saveError ?? 'Preferences saved. News for You will use them on your next visit.'}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !dirty}
                className="w-full sm:w-auto"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="size-4" aria-hidden="true" />
                    {dirty ? 'Save preferences' : 'Saved'}
                  </>
                )}
              </Button>
              {scopeOption && (
                <p className="text-xs leading-5 text-muted-foreground">
                  Current: {scopeOption.label}
                  {preferences?.updatedAt
                    ? ` · last updated ${new Date(preferences.updatedAt).toLocaleDateString('en', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}`
                    : ''}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}