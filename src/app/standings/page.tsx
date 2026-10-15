import type { Metadata } from 'next';
import Link from 'next/link';
import { Info, Radio, TriangleAlert } from 'lucide-react';
import { getAllStandings, getStandings, footballDataConfigured } from '@/lib/football-data/service';
import {
  ALL_COMPETITIONS,
  DEFAULT_COMPETITION,
  competitionLabel,
  competitionTitle,
  isCompetitionSelection,
  type CompetitionCode,
} from '@/lib/football-data/competitions';
import { Button } from '@/components/ui/button';
import { CompetitionSelector } from '@/components/football/competition-selector';
import { SectionHeader } from '@/components/football/section-header';
import { StandingsTable } from '@/components/football/standings-table';
import { cn } from '@/lib/utils';
export const metadata: Metadata = {
  title: 'League Tables · Premier League, La Liga, Serie A, Bundesliga, Ligue 1 & Champions League',
  description:
    'Live league tables from football-data.org with goal difference and recent form, for the top five European leagues and the UEFA Champions League.',
};

type StandingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parseSelection(
  params: Record<string, string | string[] | undefined>
): typeof ALL_COMPETITIONS | CompetitionCode {
  const raw = Array.isArray(params.competition) ? params.competition[0] : params.competition;
  if (!raw) return ALL_COMPETITIONS;
  const value = raw.toUpperCase();
  return isCompetitionSelection(value) ? value : ALL_COMPETITIONS;
}

function updatedLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'just now';
  return `${date.toLocaleTimeString('en', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })} UTC`;
}

function roundLabel(matchday: number | null): string | null {
  return matchday ? `matchday ${matchday}` : null;
}

export default async function StandingsPage({ searchParams }: StandingsPageProps) {
  const selection = parseSelection(await searchParams);
  const configured = footballDataConfigured();

  if (selection === ALL_COMPETITIONS) {
    const overview = await getAllStandings();
    const liveEntries = overview.entries.filter((entry) => entry.payload.meta.source === 'live');
    const isLive = overview.meta.source === 'live';
    const failed = overview.entries.filter((entry) => entry.payload.meta.source !== 'live');
    const staleEntries = overview.entries.filter((entry) => entry.payload.meta.stale);

    return (
      <div className="page-shell min-w-0 py-10 sm:py-14">
        <section className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <p className="eyebrow mb-3">League tables</p>
            <h1 className="text-page-title">Every competition, one page.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              {isLive
                ? 'Live tables from football-data.org for the top five European leagues and the UEFA Champions League. Pick a single competition to focus on one table.'
                : 'Live standings could not be reached right now — tables appear here as soon as the provider responds.'}
            </p>
          </div>
          <span className="chip w-fit shrink-0 sm:mb-1">
            {isLive ? (
              <>
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                Live · {liveEntries.length} of {overview.entries.length} competitions
              </>
            ) : (
              'Live data unavailable'
            )}
          </span>
        </section>

        <div className="mt-8 sm:mt-10">
          <CompetitionSelector value={selection} label="Select a competition" />
        </div>

        <div className="mt-10">
          {liveEntries.length ? (
            liveEntries.map((entry, index) => (
              <div key={entry.code} className={cn('min-w-0', index > 0 && 'mt-12')}>
                <SectionHeader
                  eyebrow={entry.payload.meta.season}
                  title={entry.payload.meta.competition}
                  description={[roundLabel(entry.payload.meta.matchday), entry.payload.meta.stage]
                    .filter(Boolean)
                    .join(' · ')}
                  href={`/standings?competition=${entry.code}`}
                  action="Open table"
                />
                {entry.payload.groups.map((group) => (
                  <div key={group.key} className="mt-4 first:mt-0">
                    <StandingsTable
                      standings={group.standings}
                      title={entry.payload.meta.competition}
                      subtitle={[entry.payload.meta.season, roundLabel(entry.payload.meta.matchday)]
                        .filter(Boolean)
                        .join(' · ')}
                      groupLabel={entry.payload.groups.length > 1 ? group.label : null}
                    />
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div
              role="alert"
              className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center"
            >
              <TriangleAlert className="h-6 w-6 text-destructive" aria-hidden="true" />
              <h2 className="text-card-title text-base">No live tables could be loaded</h2>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                {overview.meta.error ??
                  'The football data provider did not return standings for any competition.'}
              </p>
            </div>
          )}

          {staleEntries.length > 0 && (
            <div
              role="status"
              className="mt-8 rounded-xl border border-warning/30 bg-warning/[0.06] px-5 py-4 text-sm leading-6 text-muted-foreground"
            >
              <p className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                <span>
                  Live updates paused for {staleEntries.map((entry) => entry.label).join(', ')} —
                  the provider is rate limiting requests, so these tables show the last data it
                  returned. No values are estimated or filled in.
                </span>
              </p>
            </div>
          )}

          {failed.length > 0 && (
            <div
              role="status"
              className="mt-8 rounded-xl border border-border bg-card/60 px-5 py-4 text-sm leading-6 text-muted-foreground"
            >
              <p className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  Not available right now:{' '}
                  {failed.map((entry) => entry.label).join(', ')}. Everything else above is live data
                  from the provider — no placeholder tables are shown.
                </span>
              </p>
            </div>
          )}

          <p className="mt-6 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
            <Radio className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              {isLive
                ? `Live tables from football-data.org. Updated ${updatedLabel(overview.meta.lastUpdated)}.`
                : 'Live data unavailable — the provider has no current standings to display right now.'}
            </span>
          </p>
        </div>

        {!configured && (
          <p className="mt-6 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            Live football data is disabled. Set LIVE_FOOTBALL_DATA_ENABLED=true and
            FOOTBALL_DATA_API_KEY in your environment to enable it.
          </span>
        </p>
        )}
      </div>
    );
  }

  const code = selection;
  const { groups, meta } = await getStandings(code);
  const isLive = meta.source === 'live';
  const heading = isLive ? meta.competition : competitionTitle(code);
  const round = roundLabel(meta.matchday);

  return (
    <div className="page-shell min-w-0 py-10 sm:py-14">
      <section className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="eyebrow mb-3">League table</p>
          <h1 className="text-page-title">{heading}</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            {isLive
              ? `${heading} ${meta.season} — positions, goal difference and the last five match results for every club, at a glance.`
              : 'Live standings could not be reached right now — the league table will appear here once the provider is reachable.'}
          </p>
        </div>
        <span className="chip w-fit shrink-0 sm:mb-1">
          {isLive ? (
            <>
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
              {meta.stale ? 'Paused' : 'Live'} · {meta.season}
            </>
          ) : (
            'Live data unavailable'
          )}
        </span>
      </section>

      <div className="mt-8 sm:mt-10">
        <CompetitionSelector value={code} label="Select a competition" />
      </div>

      {meta.stale && (
        <p
          role="status"
          className="mt-6 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/[0.06] px-5 py-4 text-sm leading-6 text-muted-foreground"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <span>
            Live updates paused — the provider is rate limiting requests, so this table shows the
            last data it returned. No values are estimated or filled in.
          </span>
        </p>
      )}

      <section className="mt-10">
        <SectionHeader
          eyebrow={
            isLive
              ? `Live table · ${[meta.season, round].filter(Boolean).join(' · ')}`
              : 'Live table unavailable'
          }
          title={isLive ? 'All clubs' : competitionLabel(code)}
          description={
            isLive
              ? `Sorted by points, then goal difference. ${
                  meta.stage && meta.stage !== 'REGULAR_SEASON'
                    ? `Reporting stage ${meta.stage.replace(/_/g, ' ').toLowerCase()}.`
                    : 'Hover a row to scan a club quickly.'
                }`
              : 'The provider has not returned a table for this competition yet.'
          }
        />

        {isLive && groups.length ? (
          groups.map((group) => (
            <div key={group.key} className="mt-4 first:mt-0">
              <StandingsTable
                standings={group.standings}
                title={meta.competition}
                subtitle={[meta.season, round].filter(Boolean).join(' · ')}
                groupLabel={groups.length > 1 ? group.label : null}
              />
            </div>
          ))
        ) : (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center"
          >
            <TriangleAlert className="h-6 w-6 text-destructive" aria-hidden="true" />
            <h3 className="text-card-title text-base">{competitionLabel(code)} table unavailable</h3>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              {meta.error ?? 'The football data provider did not return a table for this competition.'}{' '}
              We never show placeholder standings.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/standings?competition=ALL">View all competitions</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/standings?competition=${DEFAULT_COMPETITION}`}>Premier League</Link>
              </Button>
            </div>
          </div>
        )}

        <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
          {isLive ? (
            <Radio className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          ) : (
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          )}
          <span>
            {isLive
              ? `Live table from ${meta.provider} (${meta.competition}, ${meta.season}${
                  round ? `, ${round}` : ''
                }). Updated ${updatedLabel(meta.lastUpdated)}${
                  meta.stale ? ' — updates paused since then.' : '.'
                }`
              : 'Live data unavailable — the provider has no current standings to display right now.'}
          </span>
        </p>
      </section>

      {!configured && (
        <p className="mt-6 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            Live football data is disabled. Set LIVE_FOOTBALL_DATA_ENABLED=true and
            FOOTBALL_DATA_API_KEY in your environment to enable it.
          </span>
        </p>
      )}
    </div>
  );
}
