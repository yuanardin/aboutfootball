import type { NewsArticle } from '@/lib/types';
import { dedupeArticlesById } from './dedupe';

export type NewsGridSelection = {
  /** Full deduplicated feed, first occurrence wins, provider order preserved. */
  uniqueArticles: NewsArticle[];
  categories: string[];
  isFiltering: boolean;
  filteredArticles: NewsArticle[];
  featuredArticle: NewsArticle | undefined;
  /** Final render list — guaranteed unique ids, featured excluded when shown. */
  gridArticles: NewsArticle[];
};

export type NewsGridFilters = {
  searchTerm: string;
  activeCategory: string;
};

// Final composition boundary for every news list UI (/news explorer, home
// feed, News for You all read the same cleaned feed). The service layer
// dedupes by id, but this is the last gate immediately before rendering: even
// if a duplicate id ever reaches the client (stale payload, double fetch
// resolving into one render), the grid can never contain it twice, so React
// can never report a duplicate key while `key={article.id}` stays stable.
export function composeNewsGrid(
  articles: readonly NewsArticle[],
  filters: NewsGridFilters
): NewsGridSelection {
  const uniqueArticles = dedupeArticlesById(articles);

  const categories = [
    'All',
    ...Array.from(
      new Set(
        uniqueArticles
          .map((article) => article.category)
          .filter((value): value is string => Boolean(value))
      )
    ),
  ];

  const isFiltering =
    filters.searchTerm.trim() !== '' || filters.activeCategory !== 'All';

  const filteredArticles = uniqueArticles.filter((article) => {
    const term = filters.searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      [article.title, article.excerpt, article.source, article.category].some((value) =>
        value?.toLowerCase().includes(term)
      );
    return (
      matchesSearch &&
      (filters.activeCategory === 'All' || article.category === filters.activeCategory)
    );
  });

  // The featured slot only exists outside filtering (the UI hides the hero
  // while a search/category filter is active), so it stays undefined while
  // filtering — the first match remains visible in the grid instead of being
  // claimed by a hidden hero. The grid always excludes the featured story, so
  // featured + grid can never share an id in any state.
  const featuredArticle = isFiltering ? undefined : (filteredArticles[0] ?? uniqueArticles[0]);
  const gridArticles = filteredArticles.filter(
    (article) => article.id !== featuredArticle?.id
  );

  return {
    uniqueArticles,
    categories,
    isFiltering,
    filteredArticles,
    featuredArticle,
    gridArticles,
  };
}
