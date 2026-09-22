import type { Metadata } from 'next';
import { getResults } from '@/lib/football-data/service';
import { ResultsView } from './results-view';

export const metadata: Metadata = {
  title: 'Results · Match Centre',
  description: 'Completed football matches grouped by matchday — navigate days and filter by competition.',
};

export default async function ResultsPage() {
  const { matches, meta } = await getResults();

  return <ResultsView matches={matches} meta={meta} />;
}