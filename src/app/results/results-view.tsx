'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MatchCard } from '@/components/football/match-card';
import { EmptyState } from '@/components/football/empty-state';
import { SectionHeader } from '@/components/football/section-header';
import { cn } from '@/lib/utils';
import type { MatchResult } from '@/lib/types';
import type { FootballDataMeta } from '@/lib/football-data/types';

const longDate = new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long' });
const shortDate = new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short' });

export function ResultsView({
  matches,
  meta,
}: {
  matches: MatchResult[];
  meta: FootballDataMeta;
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

  const todayIndex = resultDates.length - 1;
  const [dateIndex, setDateIndex] = useState(todayIndex);
  const [competition, setCompetition] = useState('All competitions');
  const selectedDate = resultDates[dateIndex];

  const competitions = [
    'All competitions',
    ...Array.from(new Set(matches.map((match) => match.league))),
  ];

  const visibleMatches = useMemo(
    () =>
      matches.filter(
        (match) =>
          match.matchDate === selectedDate &&
          (competition === 'All competitions' || match.league === competition)
      ),
    [competition, matches, selectedDate]
  );

  const dayLabel = useMemo(
    () =>
      dateIndex === todayIndex
        ? 'Latest available'
        : shortDate.format(new Date(selectedDate)),
    [dateIndex, selectedDate, todayIndex]
  );

  const resetFilters = () => {
    setDateIndex(todayIndex);
    setCompetition('All competitions');
  };

  const isLive = meta.source === 'live';

  return (
    <div className="page-shell py-10 sm:py-14">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <section className="max-w-2xl">
          <p className="eyebrow mb-3">Match centre</p>
          <h1 className="text-page-title">Results, without the noise.</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Completed matches grouped by matchday — navigate days and filter by competition.
          </p>
        </section>
        <span className="chip w-fit shrink-0 sm:mb-1">
          {isLive ? (
            <>
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
              Live · {meta.competition} · {meta.season}
            </>
          ) : (
            'Demo records · Jul 2024'
          )}
        </span>
      </header>

      <section aria-label="Matchday navigation" className="mt-8 sm:mt-10">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card/60 p-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDateIndex((value) => value - 1)}
            disabled={dateIndex === 0}
            aria-label="Previous matchday"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <div className="min-w-0 flex-1 px-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              Match results
            </p>
            <p className="truncate font-headline text-sm font-bold">{dayLabel}</p>
            <p className="text-xs text-muted-foreground">
              {visibleMatches.length} {visibleMatches.length === 1 ? 'match' : 'matches'} shown
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDateIndex((value) => value + 1)}
            disabled={dateIndex === todayIndex}
            aria-label="Next matchday"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>

        {competitions.length > 1 && (
          <div
            role="group"
            aria-label="Filter by competition"
            className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
          >
            {competitions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCompetition(item)}
                aria-pressed={competition === item}
                className={cn(
                  'min-h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  competition === item
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-secondary/40 text-muted-foreground hover:border-primary/60 hover:text-foreground'
                )}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 space-y-10">
        {visibleMatches.length ? (
          Object.entries(
            visibleMatches.reduce<Record<string, MatchResult[]>>((result, match) => {
              (result[match.matchDate] ??= []).push(match);
              return result;
            }, {})
          ).map(([date, group]) => (
            <section key={date}>
              <SectionHeader
                eyebrow="Matchday"
                title={longDate.format(new Date(date))}
                description={`${group.length} ${group.length === 1 ? 'match' : 'matches'} completed on this day.`}
              />
              <div className="space-y-3">
                {group.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <EmptyState
            icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
            title="No results for this selection"
            description={
              dateIndex === todayIndex
                ? isLive
                  ? 'There are no completed matches in this competition on the latest matchday yet. Check back after the weekend.'
                  : 'There are no matches in this competition on the latest matchday yet. Results will appear when a football-data source is connected.'
                : 'No completed matches on this matchday for the selected competition. Try another day or competition.'
            }
            action={
              <Button variant="outline" onClick={resetFilters}>
                Show latest matchday
              </Button>
            }
          />
        )}

        <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
          <Radio className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            {isLive
              ? `${matches.length} completed matches across ${resultDates.length} ${
                  resultDates.length === 1 ? 'matchday' : 'matchdays'
                } from ${meta.provider} (${meta.competition}, ${meta.season}). Updated ${new Date(
                  meta.lastUpdated
                ).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}.`
              : `Demo dataset — ${matches.length} completed matches across ${
                  resultDates.length
                } ${resultDates.length === 1 ? 'matchday' : 'matchdays'}. Live scores will appear once a football-data provider is connected.`}
          </span>
        </p>
      </div>
    </div>
  );
}