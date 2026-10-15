import type { Metadata } from 'next';
import { getAllResults, getResults } from '@/lib/football-data/service';
import {
  ALL_COMPETITIONS,
  isCompetitionSelection,
  type CompetitionCode,
} from '@/lib/football-data/competitions';
import { ResultsView } from './results-view';

export const metadata: Metadata = {
  title: 'Results · Match Centre',
  description:
    'Live completed matches from football-data.org, filterable across the Premier League, La Liga, Serie A, Bundesliga, Ligue 1 and the UEFA Champions League.',
};

type ResultsPageProps = {
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

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  const selection = parseSelection(await searchParams);

  if (selection === ALL_COMPETITIONS) {
    const overview = await getAllResults();
    return (
      <ResultsView
        matches={overview.matches}
        meta={overview.meta}
        selection={selection}
        failedCompetitions={overview.failed}
        staleCompetitions={overview.stale}
      />
    );
  }

  const { matches, meta } = await getResults(selection);
  return (
    <ResultsView
      matches={matches}
      meta={meta}
      selection={selection}
      staleCompetitions={meta.stale ? [selection] : []}
    />
  );
}
