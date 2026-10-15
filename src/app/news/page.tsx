import type { Metadata } from 'next';
import { getNewsArticles } from '@/lib/news/service';
import { NewsExplorer } from './news-explorer';

export const metadata: Metadata = {
  title: 'Football News',
  description: 'Transfer talk, matchday coverage and analysis from across the football world.',
};

export default async function NewsPage() {
  const { articles, source, provider, lastUpdated, error } = await getNewsArticles();

  return (
    <NewsExplorer
      articles={articles}
      source={source}
      provider={provider}
      lastUpdated={lastUpdated}
      error={error}
    />
  );
}