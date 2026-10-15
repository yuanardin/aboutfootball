'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, Flag, RefreshCw, Settings, Tv } from 'lucide-react';
import Link from 'next/link';
import { getTeamMatchesAction } from '@/app/actions';
import { matchDetailPath } from '@/lib/football-data/match-links';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { getFirestoreErrorMessage, getFavoriteTeam, type FavoriteTeam } from '@/lib/favorites/favorite-team';
import { getPreferences, type UserPreferences } from '@/lib/favorites/preferences';
import {
  appendNotification,
  buildMatchAlertDrafts,
  countUnread,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  timeAgo,
  type MatchAlertNotification,
} from '@/lib/notifications/service';
import { cn } from '@/lib/utils';

// Polls only while the panel is open; the server-side team-matches cache (3 min live
// TTL + in-flight dedupe) means concurrent polls share one upstream football-data.org
// call, keeping the free-tier quota safe.
const SYNC_INTERVAL_MS = 90_000;
const SYNC_TIMEOUT_MS = 20_000;

function AlertIcon({ type, status }: { type: 'match_started' | 'match_score' | 'match_finished'; status: string }) {
  if (type === 'match_score') return <Tv className="h-4 w-4" aria-hidden="true" />;
  if (type === 'match_finished') return <Flag className="h-4 w-4" aria-hidden="true" />;
  if (status === 'PAUSED') return <Flag className="h-4 w-4" aria-hidden="true" />;
  return <Bell className="h-4 w-4" aria-hidden="true" />;
}

export function NotificationCenter() {
  const firebase = useFirebase();
  const firestore = firebase.firestore ?? null;
  const { data: user } = useUser();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MatchAlertNotification[]>([]);
  const [favorite, setFavorite] = useState<FavoriteTeam | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const sync = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!firestore || !user || syncingRef.current) return;
      syncingRef.current = true;
      try {
        const [notifications, team, prefs] = await Promise.all([
          fetchNotifications(firestore, user.uid),
          getFavoriteTeam(firestore, user.uid),
          getPreferences(firestore, user.uid),
        ]);
        setFavorite(team);
        setPreferences(prefs);
        setItems(notifications);
        setLoadError(null);

        const alertsEnabled = prefs.matchAlerts !== false;
        if (!team || !alertsEnabled || team.id <= 0) {
          setLiveError(null);
          return;
        }

        const matches = await Promise.race([
          getTeamMatchesAction(team.id),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), SYNC_TIMEOUT_MS)),
        ]);

        if (matches === null) {
          setLiveError('Live updates are taking longer than expected — showing saved alerts only.');
          return;
        }
        if (matches.error && !matches.stale) {
          setLiveError('Live match updates are paused — showing saved alerts only.');
          return;
        }
        setLiveError(null);

        const drafts = buildMatchAlertDrafts(matches, team.name, notifications);
        if (drafts.length) {
          const appended: MatchAlertNotification[] = [];
          for (const draft of drafts) {
            appended.push(await appendNotification(firestore, user.uid, draft));
          }
          setItems((current) => [...appended, ...current]);
        }
      } catch (error) {
        if (silent) return;
        setLoadError(getFirestoreErrorMessage(error));
      } finally {
        syncingRef.current = false;
      }
    },
    [firestore, user]
  );

  useEffect(() => {
    setLoading(true);
    void sync().finally(() => setLoading(false));
  }, [sync]);

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => void sync({ silent: true }), SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [open, sync]);

  const unread = useMemo(() => countUnread(items), [items]);

  const handleItemClick = (item: MatchAlertNotification) => {
    if (item.readAt !== null || !firestore || !user) return;
    setItems((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry))
    );
    void markNotificationRead(firestore, user.uid, item.id).catch((error) => {
      setItems((current) => current.map((entry) => (entry.id === item.id ? item : entry)));
      toast({ variant: 'destructive', description: getFirestoreErrorMessage(error) });
    });
  };

  const handleMarkAll = () => {
    const unreadItems = items.filter((item) => item.readAt === null);
    if (!unreadItems.length || !firestore || !user) return;
    setItems((current) =>
      current.map((item) => (item.readAt === null ? { ...item, readAt: new Date().toISOString() } : item))
    );
    void markAllNotificationsRead(firestore, user.uid, unreadItems).catch((error) => {
      setItems((current) =>
        current.map((item) => unreadItems.find((entry) => entry.id === item.id) ?? item)
      );
      toast({ variant: 'destructive', description: getFirestoreErrorMessage(error) });
    });
  };

  const handleRetryLive = () => {
    setLiveError(null);
    void sync();
  };

  const alertsEnabled = preferences?.matchAlerts !== false;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
          className="relative rounded-full"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,26rem)] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="text-card-title text-base">Notifications</p>
            {unread > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {unread} new
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAll}
            disabled={unread === 0}
            className="h-7 gap-1.5 text-xs"
          >
            <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Mark all read
          </Button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="space-y-3 p-4" aria-busy="true">
              {[0, 1, 2].map((key) => (
                <div key={key} className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-start gap-3 p-5">
              <p className="text-sm leading-6 text-destructive" role="alert">
                {loadError}
              </p>
              <Button variant="outline" size="sm" onClick={() => void sync()}>
                Try again
              </Button>
            </div>
          ) : (
            <div className="p-2">
              {liveError && (
                <div className="m-2 flex items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5">
                  <p className="text-xs leading-5 text-foreground">{liveError}</p>
                  <Button variant="ghost" size="sm" onClick={handleRetryLive} className="h-7 shrink-0 gap-1.5 text-xs">
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Refresh
                  </Button>
                </div>
              )}

              {!alertsEnabled && (
                <div className="m-2 flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/50 px-3 py-2.5">
                  <p className="text-xs leading-5 text-muted-foreground">
                    Match alerts are turned off. Enable them in Preferences to keep up with {favorite?.name ?? 'your team'}.
                  </p>
                  <Button asChild variant="ghost" size="sm" className="h-7 shrink-0 gap-1.5 text-xs">
                    <Link href="/profile">
                      <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                      Preferences
                    </Link>
                  </Button>
                </div>
              )}

              {alertsEnabled && !favorite && (
                <div className="m-2 flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/50 px-3 py-2.5">
                  <p className="text-xs leading-5 text-muted-foreground">
                    Pick your favorite team to get updates here when they play.
                  </p>
                  <Button asChild variant="ghost" size="sm" className="h-7 shrink-0 gap-1.5 text-xs">
                    <Link href="/profile">
                      <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                      Choose team
                    </Link>
                  </Button>
                </div>
              )}

              {!loadError && items.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <p className="text-sm font-medium text-foreground">No match alerts yet</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Alerts for kick off, score changes and full time will appear here.
                  </p>
                </div>
              )}

              {items.length > 0 && (
                <ul className="divide-y divide-border/60" aria-label="Match notifications">
                  {items.slice(0, 20).map((item) => {
                    const unreadItem = item.readAt === null;
                    return (
                      <li key={item.id}>
                        <Link
                          href={matchDetailPath(item.matchId)}
                          onClick={() => handleItemClick(item)}
                          aria-label={`${item.title} — view match details`}
                          className={cn(
                            'flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-secondary/70',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                          )}
                        >
                          <span
                            className={cn(
                              'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                              item.type === 'match_score'
                                ? 'bg-primary/10 text-primary'
                                : item.type === 'match_finished'
                                  ? 'bg-secondary text-muted-foreground'
                                  : 'bg-success/10 text-success'
                            )}
                          >
                            <AlertIcon type={item.type} status={item.status} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                'block truncate text-sm',
                                unreadItem ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'
                              )}
                            >
                              {item.title}
                            </span>
                            <span className="mt-0.5 block truncate text-xs leading-5 text-muted-foreground">
                              {item.message}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-muted-foreground/70">
                              {timeAgo(item.createdAt)}
                              {item.competition ? ` · ${item.competition}` : ''}
                            </span>
                          </span>
                          {unreadItem && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5">
          <p className="text-[11px] text-muted-foreground">
            {favorite ? `Alerts for ${favorite.name}` : 'Personalized alerts'}
          </p>
          <Button asChild variant="link" size="sm" className="h-auto gap-1 p-0 text-xs">
            <Link href="/profile">Manage team</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}