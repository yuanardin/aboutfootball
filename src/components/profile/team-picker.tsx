'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, ShieldHalf, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getClubList, type ClubListResult } from '@/app/actions';
import type { ClubOption } from '@/app/actions';

type TeamPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (team: ClubOption) => void;
  saving: boolean;
};

export function TeamPicker({ open, onOpenChange, onSelect, saving }: TeamPickerProps) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<ClubListResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      setResult(await getClubList());
    } catch {
      setFailed(true);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setQuery('');
      if (!result && !loading) {
        void load();
      }
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!result?.teams) return [];
    const term = query.trim().toLowerCase();
    if (!term) return result.teams;
    return result.teams.filter((team) =>
      [team.name, team.shortName, team.tla].some((value) => value?.toLowerCase().includes(term))
    );
  }, [query, result]);

  const unavailable = result?.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose your team</DialogTitle>
          <DialogDescription>
            Pick the club you support to personalize ScoreCast. You can change it anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search clubs..."
            className="input-surface h-10 rounded-lg pl-10 pr-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search football clubs"
            disabled={loading || Boolean(unavailable)}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear club search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="max-h-80 overflow-y-auto rounded-lg border border-border bg-background/40 pr-1">
          {loading ? (
            <div className="space-y-2 p-3" aria-label="Loading clubs" role="status">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-11 w-full rounded-md" />
              ))}
            </div>
          ) : failed ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                The club list could not be loaded. Check your connection and try again.
              </p>
              <Button type="button" variant="outline" className="mt-4" onClick={() => void load()}>
                Try again
              </Button>
            </div>
          ) : unavailable ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm leading-6 text-muted-foreground" role="alert">
                {unavailable}
              </p>
              <Button type="button" variant="outline" className="mt-4" onClick={() => void load()}>
                Try again
              </Button>
            </div>
          ) : filtered.length ? (
            <ul className="divide-y divide-border/60">
              {filtered.map((team) => (
                <li key={team.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(team)}
                    disabled={saving}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    {team.crest ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={team.crest}
                        alt=""
                        width={28}
                        height={28}
                        className="h-7 w-7 shrink-0 object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                        <ShieldHalf className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{team.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{team.competitionCode}</span>
                    {team.tla && (
                      <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                        {team.tla}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No clubs match &quot;{query}&quot;.
            </p>
          )}
        </div>

        {saving && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
            Saving your team...
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}