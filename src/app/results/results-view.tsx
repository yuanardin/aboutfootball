'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, Info, Radio, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MatchCard } from '@/components/football/match-card';
import { EmptyState } from '@/components/football/empty-state';
import { SectionHeader } from '@/components/football/section-header';
import { CompetitionSelector } from '@/components/football/competition-selector';
import { cn } from '@/lib/utils';
import type { MatchResult } from '@/lib/types';
import type { FootballDataMeta } from '@/lib/football-data/types';
import {
  ALL_COMPETITIONS,
  competitionLabel,
  type CompetitionCode,
  type CompetitionSelection,
} from '@/lib/football-data/competitions';

const longDate = new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long' });
const shortDate = new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short' });

function roundLabel(match: MatchResult): string | null {
  if (match.matchday) return `Matchday ${match.matchday}`;
  if (match.stage && match.stage !== 'REGULAR_SEASON') {
    return match.stage.replace(/_/g, ' ').toLowerCase();
  }
  return null;
}

export function ResultsView({
  matches,
  meta,
  selection,
  failedCompetitions = [],
  staleCompetitions = [],
}: {
  matches: MatchResult[];
  meta: FootballDataMeta;
  selection: CompetitionSelection;
  failedCompetitions?: CompetitionCode[];
  staleCompetitions?: CompetitionCode[];
}) {
  const resultDates = useMemo(
    () =>
      Array.from(
        new Map(
          matches
            .filter((match) => !Number.isNaN(Date.parse(match.matchDate)))
            .map((match) => [Date.parse(match.matchDate), match.matchDate])
        ).entries()
      )
        .sort((a, b) => a[0] - b[0])
        .map(([, date]) => date),
    [matches]
  );

  const lastIndex = resultDates.length - 1;
  const [dateIndex, setDateIndex] = useState(lastIndex);

  // Switching competition replaces the match list, so the stored cursor is clamped during
  // render rather than in an effect. Clamping after render would briefly leave the cursor
  // outside the new range, and formatting that missing date throws an Invalid time value.
  const activeIndex = Math.min(Math.max(dateIndex, 0), Math.max(lastIndex, 0));
  const selectedDate = resultDates[activeIndex];

  const visibleMatches = useMemo(
    () => matches.filter((match) => match.matchDate === selectedDate),
    [matches, selectedDate]
  );

  const dayLabel = useMemo(() => {
    if (!selectedDate) return 'No matchdays';
    return activeIndex === lastIndex ? 'Latest available' : shortDate.format(new Date(selectedDate));
  }, [activeIndex, lastIndex, selectedDate]);

  const isLive = meta.source === 'live';
  const scopeLabel =
    selection === ALL_COMPETITIONS ? 'All competitions' : competitionLabel(selection);
  const selectionUnavailable = !isLive;

  const groups = useMemo(() => {
    const map = new Map<string, MatchResult[]>();
    for (const match of visibleMatches) {
      const key = match.matchDate;
      const list = map.get(key);
      if (list) list.push(match);
      else map.set(key, [match]);
    }
    return Array.from(map.entries());
  }, [visibleMatches]);

  return (
    <div className="page-shell min-w-0 py-10 sm:py-14">
      <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <section className="max-w-2xl min-w-0">
          <p className="eyebrow mb-3">Match centre</p>
          <h1 className="text-page-title max-w-full [text-wrap:balance]">Results, without the noise.</h1>
          <p className="mt-4 max-w-full text-base leading-7 text-muted-foreground [overflow-wrap:anywhere]">
            Live completed matches from football-data.org — navigate days and switch competition
            across the top five European leagues and the Champions League.
          </p>
        </section>
        <span className="chip max-w-full w-fit shrink-0 break-words sm:mb-1">
          {isLive ? (
            <>
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
              {staleCompetitions.length ? 'Paused' : 'Live'} · {meta.competition}
              {meta.season !== 'Unavailable' ? ` · ${meta.season}` : ''}
            </>
          ) : (
            'Live data unavailable'
          )}
        </span>
      </header>

      <section aria-label="Matchday navigation" className="mt-8 sm:mt-10">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card/60 p-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDateIndex((value) => Math.max(0, value - 1))}
            disabled={!resultDates.length || activeIndex === 0}
            aria-label="Previous matchday"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <div className="min-w-0 flex-1 px-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              {scopeLabel}
            </p>
            <p className="truncate font-headline text-sm font-bold">{resultDates.length ? dayLabel : 'No matchdays'}</p>
            <p className="text-xs text-muted-foreground">
              {visibleMatches.length} {visibleMatches.length === 1 ? 'match' : 'matches'} shown
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDateIndex((value) => Math.min(lastIndex, value + 1))}
            disabled={!resultDates.length || activeIndex === lastIndex}
            aria-label="Next matchday"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-3">
          <CompetitionSelector value={selection} label="Filter by competition" />
        </div>

        {staleCompetitions.length > 0 && (
          <p
            role="status"
            className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/[0.06] px-4 py-2.5 text-xs leading-5 text-muted-foreground"
          >
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
            <span>
              Live updates paused for {staleCompetitions.map(competitionLabel).join(', ')} — the
              provider is rate limiting requests, so these results are the last data it returned.
            </span>
          </p>
        )}

        {failedCompetitions.length > 0 && (
          <p
            role="status"
            className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-card/60 px-4 py-2.5 text-xs leading-5 text-muted-foreground"
          >
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span>
              Unavailable right now: {failedCompetitions.map(competitionLabel).join(', ')}. The
              matches below are all real provider results.
            </span>
          </p>
        )}
      </section>

      <div className="mt-8 space-y-10">
        {selectionUnavailable ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center"
          >
            <TriangleAlert className="h-6 w-6 text-destructive" aria-hidden="true" />
            <h2 className="text-card-title text-base">{scopeLabel} results unavailable</h2>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              {meta.error ??
                'The football data provider did not return results for this competition.'}{' '}
              ScoreCast only ever shows matches the provider actually returned.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href="/results?competition=ALL">View all competitions</Link>
            </Button>
          </div>
        ) : visibleMatches.length ? (
          groups.map(([date, group]) => (
            <section key={date}>
              <SectionHeader
                eyebrow="Matchday"
                title={longDate.format(new Date(date))}
                description={`${group.length} ${group.length === 1 ? 'match' : 'matches'} completed on this day.`}
              />
              <div className="space-y-3">
                {group.map((match) => (
                  <div key={match.id} className="min-w-0">
                    {roundLabel(match) && selection === ALL_COMPETITIONS && (
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {match.competitionName ?? match.league} · {roundLabel(match)}
                      </p>
                    )}
                    <MatchCard match={match} />
                  </div>
                ))}
              </div>
            </section>
          ))
        ) : (
          <EmptyState
            icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
            title="No results for this selection"
            description={
              isLive
                ? `There are no completed matches for ${scopeLabel} on the latest matchday yet. Check back after the weekend.`
                : 'There are no completed matches on the latest matchday yet — live results will appear once the provider is reachable.'
            }
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" onClick={() => setDateIndex(lastIndex)}>
                  Show latest matchday
                </Button>
                {selection !== ALL_COMPETITIONS && (
                  <Button asChild variant="ghost">
                    <Link href="/results?competition=ALL">All competitions</Link>
                  </Button>
                )}
              </div>
            }
          />
        )}

        <p className={cn('flex items-start gap-2 text-sm leading-6 text-muted-foreground')}>
          <Radio className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            {isLive
              ? `${matches.length} completed matches across ${resultDates.length} ${
                  resultDates.length === 1 ? 'matchday' : 'matchdays'
                } from ${meta.provider} (${meta.competition}${
                  meta.season !== 'Unavailable' ? `, ${meta.season}` : ''
                }). Updated ${new Date(meta.lastUpdated).toLocaleTimeString('en', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'UTC',
                })} UTC.`
              : 'Live data unavailable — completed matches were not loaded from the provider. Please try again shortly.'}
          </span>
        </p>
      </div>
    </div>
  );
}
