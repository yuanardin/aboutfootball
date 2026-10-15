// Id-based dedupe for live news article lists.
//
// Client-safe: pure list operation, no network/cache/server-only imports, so it
// is unit-testable with node:test and reusable anywhere.
//
// Why this exists: the live provider occasionally returns the same story twice
// inside one response (identical title + URL). Article ids are deterministic
// over title + URL, so both copies share one id and React reports
// "Encountered two children with the same key". Dropping later copies by id
// keeps the first (most relevant post-sort) occurrence and never removes
// distinct stories — distinct stories always differ in URL or title, hence id.
export function dedupeArticlesById<T extends { id: string }>(articles: readonly T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const article of articles) {
    if (seen.has(article.id)) continue;
    seen.add(article.id);
    unique.push(article);
  }
  return unique;
}
