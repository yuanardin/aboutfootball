import { getResults, getStandings } from '@/lib/football-data/service';
import { getNewsArticles } from '@/lib/news/service';
import { HomeClient } from './home-client';

export default async function Home() {
  const [{ matches, meta: resultsMeta }, { standings, meta: standingsMeta }, news] =
    await Promise.all([getResults(), getStandings(), getNewsArticles()]);

  return (
    <HomeClient
      matches={matches}
      standings={standings}
      resultsMeta={resultsMeta}
      standingsMeta={standingsMeta}
      articles={news.articles}
      newsProvider={news.provider}
      newsUpdated={news.lastUpdated}
      newsError={news.error}
    />
  );
}