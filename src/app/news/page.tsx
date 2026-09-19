import type { Metadata } from 'next';
import { NewsExplorer } from './news-explorer';

export const metadata: Metadata = {
  title: 'Football News',
  description: 'Transfer talk, matchday coverage and analysis from across the football world.',
};

export default function NewsPage() {
  return <NewsExplorer />;
}