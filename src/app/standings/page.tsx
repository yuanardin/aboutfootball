import type { Metadata } from 'next';
import { Info, Radio } from 'lucide-react';
import { getStandings } from '@/lib/football-data/service';
import { SectionHeader } from '@/components/football/section-header';
import { StandingsTable } from '@/components/football/standings-table';
import { footballDataConfigured } from '@/lib/football-data/service';

export const metadata: Metadata = {
  title: 'League Table · Premier League',
  description: 'Premier League standings with goal difference and recent form.',
};

export default async function StandingsPage() {
  const [{ standings, meta }, configured] = await Promise.all([
    getStandings(),
    Promise.resolve(footballDataConfigured()),
  ]);

  const isLive = meta.source === 'live';

  return (
    <div className="page-shell py-10 sm:py-14">
      <section className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow mb-3">League table</p>
          <h1 className="text-page-title">{meta.competition}</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            {isLive
              ? `${meta.competition} ${meta.season} — positions, goal difference and the last five match results for every club, at a glance.`
              : 'Final standings for the 2023/24 season — positions, goal difference and the last five match results for every club, at a glance.'}
          </p>
        </div>
        <span className="chip w-fit shrink-0 sm:mb-1">
          {isLive ? (
            <>
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
              Live · {meta.season}
            </>
          ) : (
            'Demo records · 2023/24'
          )}
        </span>
      </section>

      <section className="mt-10">
        <SectionHeader
          eyebrow={isLive ? `Live table · ${meta.season}${meta.matchday ? ` · MD ${meta.matchday}` : ''}` : 'Final standings'}
          title="All clubs"
          description="Sorted by points, then goal difference. Hover a row to scan a club quickly."
        />
        <StandingsTable
          standings={standings}
          title={meta.competition}
          subtitle={isLive ? `${meta.season} · ${meta.matchday ? `matchday ${meta.matchday}` : 'live table'}` : '2023/24 · final table'}
        />

        <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
          {isLive ? <Radio className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
          <span>
            {isLive
              ? `Live table from ${meta.provider} (${meta.competition}, ${meta.season}). Updated ${new Date(
                  meta.lastUpdated
                ).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}.`
              : 'Demo dataset — Premier League 2023/24 final standings for illustration. Live league tables will appear once a football-data provider is connected.'}
          </span>
        </p>
      </section>

      {!configured && (
        <p className="mt-6 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>Set FOOTBALL_DATA_API_KEY in your environment to enable live data.</span>
        </p>
      )}
    </div>
  );
}