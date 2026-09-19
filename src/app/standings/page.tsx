import type { Metadata } from 'next';
import { Info } from 'lucide-react';
import { leagueStandings } from '@/lib/data';
import { SectionHeader } from '@/components/football/section-header';
import { StandingsTable } from '@/components/football/standings-table';

export const metadata: Metadata = {
  title: 'League Table · Premier League',
  description: 'Premier League 2023/24 final standings with goal difference and recent form.',
};

export default function StandingsPage() {
  return (
    <div className="page-shell py-10 sm:py-14">
      <section className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow mb-3">League table</p>
          <h1 className="text-page-title">Premier League</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            Final standings for the 2023/24 season — positions, goal difference and the last five
            match results for every club, at a glance.
          </p>
        </div>
        <span className="chip w-fit shrink-0 sm:mb-1">Demo records · 2023/24</span>
      </section>

      <section className="mt-10">
        <SectionHeader
          eyebrow="Final standings"
          title="All clubs"
          description="Sorted by points, then goal difference. Hover a row to scan a club quickly."
        />
        <StandingsTable
          standings={leagueStandings}
          title="Premier League"
          subtitle="2023/24 · final table"
        />

        <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            Demo dataset — Premier League 2023/24 final standings for illustration. Live league
            tables will appear once a football-data provider is connected.
          </span>
        </p>
      </section>
    </div>
  );
}
