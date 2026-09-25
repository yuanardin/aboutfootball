import { footballDataErrorMessage, getResults, getStandings } from '@/lib/football-data/service';
import { getNewsArticles } from '@/lib/news/service';
import type { NewsArticlesResult } from '@/lib/news/service';
import { HomeClient } from './home-client';

export default async function Home() {
  const [results, standings, news] = await Promise.allSettled([
    getResults(),
    getStandings(),
    getNewsArticles(),
  ]);

  const resultsPayload = results.status === 'fulfilled' ? results.value : null;
  const standingsPayload = standings.status === 'fulfilled' ? standings.value : null;

  const resultsError =
    results.status === 'rejected' ? footballDataErrorMessage(results.reason, 'results') : null;
  const standingsError =
    standings.status === 'rejected'
      ? footballDataErrorMessage(standings.reason, 'standings')
      : null;

  const fallbackNews: NewsArticlesResult = {
    articles: [],
    source: 'live',
    provider: '',
    lastUpdated: '',
    error: 'The live news provider could not be reached right now.',
  };
  const newsPayload = news.status === 'fulfilled' ? news.value : fallbackNews;

  return (
    <HomeClient
      matches={resultsPayload?.matches ?? []}
      standings={standingsPayload?.standings ?? []}
      resultsMeta={resultsPayload?.meta ?? null}
      standingsMeta={standingsPayload?.meta ?? null}
      resultsError={resultsError}
      standingsError={standingsError}
      articles={newsPayload.articles}
      newsProvider={newsPayload.provider}
      newsUpdated={newsPayload.lastUpdated}
      newsError={newsPayload.error}
    />
  );
}