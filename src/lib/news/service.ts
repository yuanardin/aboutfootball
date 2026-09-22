import 'server-only';

import type { NewsArticle } from '@/lib/types';

const NEWS_API_BASE_URL = 'https://newsapi.org/v2';
// Football/soccer focused query, biased toward the top five European leagues.
const NEWS_QUERY =
  'football OR soccer OR "premier league" OR "la liga" OR "serie a" OR "bundesliga" OR "ligue 1" OR "champions league" OR "europa league"';
const NEWS_CACHE_TTL_MS = 10 * 60 * 1000;
const NEWS_CACHE_KEY = 'news:live:feed';
const NEWS_PAGE_SIZE = 50;
const NEWS_DISPLAY_LIMIT = 12;

export type NewsSourceStatus = 'live';

export type NewsArticlesResult = {
  articles: NewsArticle[];
  source: NewsSourceStatus;
  provider: string;
  lastUpdated: string;
  error: string | null;
};

type CacheEntry = { value: NewsArticlesResult; expiresAt: number };

const cache = new Map<string, CacheEntry>();

export class NewsProviderError extends Error {
  constructor(
    public readonly status: number | null,
    message: string
  ) {
    super(message);
    this.name = 'NewsProviderError';
  }
}

export function newsApiConfigured(): boolean {
  return Boolean(process.env.NEWS_API_KEY);
}

function normalizeDate(input?: string): string {
  if (!input) return 'Recently';

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'Recently';

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function readTimeFromText(text?: string): string {
  const count = text ? text.split(/\s+/).filter(Boolean).length : 180;
  const minutes = Math.max(2, Math.ceil(count / 180));
  return `${minutes} min read`;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'story'
  );
}

function stableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36).slice(0, 8);
}

function deterministicId(title: string, url: string, publishedAt?: string): string {
  const base = slugify(title);
  const seed = url || `${title}-${publishedAt ?? ''}`;
  return `${base}-${stableHash(seed)}`;
}

// Terms that signal American football, gridiron, fantasy drafts etc. — not association
// football. Articles matching any of these are dropped so the feed stays football/soccer
// relevant even when NewsAPI matches on the shared "football" keyword.
const NON_SOCCER_HINTS = [
  'nfl',
  'super bowl',
  'american football',
  'college football',
  'ncaa football',
  'national football league',
  'gridiron',
  'nfl draft',
  'pac-12',
  'sec football',
  'big ten',
  'quarterback',
  'running back',
  'linebacker',
  'defensive tackle',
  'offensive lineman',
  'touchdown',
  'field goal',
  'interception',
  'franchise tag',
  'fantasy football',
  'nflpa',
  'pro bowl',
] as const;

// Other non-soccer sports that regularly clutter a "football" keyword search.
const OTHER_SPORT_HINTS = [
  'cricket',
  'tennis',
  'golf',
  'hockey',
  'nba',
  'nhl',
  'mlb',
  'baseball',
  'basketball',
  'rugby',
  'australian rules',
  'afl ',
  'gaelic football',
  'boxing',
  'mma',
  'ufc',
  'formula 1',
  'f1 ',
  'grand prix',
  'nascar',
  'darts',
  'snooker',
  'olympic',
  'paralympic',
] as const;

// Strong soccer signals used to keep an article. The feed must contain at least one of
// these in the title/description to be considered football/soccer related.
const SOCCER_MARKERS = [
  'premier league',
  'la liga',
  'laliga',
  'serie a',
  'seriea',
  'bundesliga',
  'ligue 1',
  'champions league',
  'europa league',
  'europa conference league',
  'uefa',
  'fa cup',
  'copa del rey',
  'coppa italia',
  'dfb pokal',
  'coupe de france',
  'world cup',
  'european championship',
  'euro 2024',
  'euro 2025',
  'manchester city',
  'man united',
  'manchester united',
  'liverpool',
  'arsenal',
  'chelsea',
  'tottenham',
  'newcastle',
  'aston villa',
  'west ham',
  'brighton',
  'everton',
  'nottingham forest',
  'crystal palace',
  'real madrid',
  'barcelona',
  'atletico madrid',
  'sevilla',
  'valencia',
  'athletic bilbao',
  'real sociedad',
  'villarreal',
  'bayern munich',
  'bayern',
  'dortmund',
  'bayer leverkusen',
  'rb leipzig',
  'eintracht frankfurt',
  'borussia',
  'stuttgart',
  'inter milan',
  'ac milan',
  'juventus',
  'napoli',
  'as roma',
  'ss roma',
  'lazio',
  'atalanta',
  'fiorentina',
  'paris saint-germain',
  'psg',
  'monaco',
  'marseille',
  'lyon',
  'lille',
  'nice',
  'olympique',
  'goalkeeper',
  'striker',
  'midfielder',
  'winger',
  'hat-trick',
  'red card',
  'yellow card',
  'clean sheet',
  'own goal',
  'penalty',
  'derby',
  'matchday',
  'transfer window',
  'scored',
  'assist',
  'football club',
  'soccer club',
] as const;

// The top five European leagues (plus UEFA club competitions) — articles mentioning these
// are surfaced first so the feed reads like a top-league news roundup.
const TOP_LEAGUE_MARKERS = [
  'premier league',
  'la liga',
  'laliga',
  'serie a',
  'seriea',
  'bundesliga',
  'ligue 1',
  'champions league',
  'europa league',
] as const;

// Sources to exclude from the feed entirely (matched case-insensitively against the
// article source name).
const BLOCKED_SOURCES = ['the times of india'] as const;

function normalizeImageUrl(input?: string): string | undefined {
  if (!input) return undefined;

  let url = input.trim();
  if (url.startsWith('//')) url = `https:${url}`;
  if (url.startsWith('http://')) url = url.replace(/^http:\/\//, 'https://');

  return /^https:\/\/.+/.test(url) ? url : undefined;
}

function searchableText(title: string, description?: string): string {
  return `${title} ${description ?? ''}`.toLowerCase();
}

function hasAnyTerm(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function isFootballRelevant(article: NewsArticle): boolean {
  const text = searchableText(article.title, article.excerpt);
  if (hasAnyTerm(text, NON_SOCCER_HINTS)) return false;
  if (hasAnyTerm(text, OTHER_SPORT_HINTS)) return false;
  if (!hasAnyTerm(text, SOCCER_MARKERS)) return false;

  const source = article.source.toLowerCase();
  return !BLOCKED_SOURCES.some((name) => source.includes(name));
}

function sortByPublishedAt(a: NewsArticle, b: NewsArticle): number {
  const parse = (value?: string) => {
    const time = value ? Date.parse(value) : Number.NaN;
    return Number.isNaN(time) ? 0 : time;
  };
  return parse(b.publishedAt) - parse(a.publishedAt);
}

// Top-five-league (and UEFA) stories first, then most recently published.
function sortFeedArticles(articles: NewsArticle[]): NewsArticle[] {
  const priority = (article: NewsArticle) => {
    const text = searchableText(article.title, article.excerpt);
    return hasAnyTerm(text, TOP_LEAGUE_MARKERS) ? 1 : 0;
  };

  return [...articles].sort((a, b) => {
    const priorityDiff = priority(b) - priority(a);
    if (priorityDiff !== 0) return priorityDiff;
    return sortByPublishedAt(a, b);
  });
}

function unavailableResult(message: string): NewsArticlesResult {
  return {
    articles: [],
    source: 'live',
    provider: 'NewsAPI',
    lastUpdated: new Date().toISOString(),
    error: message,
  };
}

function mapLiveArticle(article: Record<string, unknown>): NewsArticle | null {
  const title = typeof article.title === 'string' ? article.title.trim() : '';
  const url = typeof article.url === 'string' ? article.url.trim() : '';

  if (!title || !url) return null;

  const publishedAt =
    typeof article.publishedAt === 'string' ? article.publishedAt : new Date().toISOString();
  const description =
    typeof article.description === 'string' ? article.description : '';
  const content = typeof article.content === 'string' ? article.content : '';
  const rawSource = article.source as { name?: unknown } | null | undefined;
  const source = typeof rawSource?.name === 'string' && rawSource.name ? rawSource.name : 'Live source';
  const imageUrl = normalizeImageUrl(
    typeof article.urlToImage === 'string' ? article.urlToImage : undefined
  );

  const story: NewsArticle = {
    id: deterministicId(title, url, publishedAt),
    title,
    excerpt: description || content || 'Latest football coverage from a live source.',
    source,
    date: normalizeDate(publishedAt),
    imageId: `news-${(content.length || title.length) % 6 + 1}`,
    imageUrl,
    category: 'Football',
    readTime: readTimeFromText(content || description),
    articleUrl: url,
    publishedAt,
  };

  return story;
}

async function fetchNewsFeed(): Promise<NewsArticlesResult> {
  const endpoint = `${NEWS_API_BASE_URL}/everything?q=${encodeURIComponent(
    NEWS_QUERY
  )}&language=en&sortBy=publishedAt&pageSize=${NEWS_PAGE_SIZE}`;

  const response = await fetch(endpoint, {
    headers: {
      'X-Api-Key': process.env.NEWS_API_KEY || '',
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new NewsProviderError(
      response.status,
      `NewsAPI returned ${response.status} ${response.statusText}`
    );
  }

  const payload = (await response.json()) as { articles?: Record<string, unknown>[] };
  const articles = sortFeedArticles(
    (payload.articles ?? [])
      .map(mapLiveArticle)
      .filter((article): article is NewsArticle => Boolean(article))
      .filter(isFootballRelevant)
  ).slice(0, NEWS_DISPLAY_LIMIT);

  if (!articles.length) {
    throw new NewsProviderError(null, 'NewsAPI returned no football-related articles.');
  }

  return {
    articles,
    source: 'live',
    provider: 'NewsAPI',
    lastUpdated: new Date().toISOString(),
    error: null,
  };
}

async function getCachedNewsFeed(): Promise<NewsArticlesResult> {
  const now = Date.now();
  const existing = cache.get(NEWS_CACHE_KEY);

  if (existing && existing.expiresAt > now) {
    return existing.value;
  }

  let result: NewsArticlesResult;
  try {
    result = await fetchNewsFeed();
  } catch (error) {
    const message =
      error instanceof NewsProviderError ? error.message : (error as Error).message;
    console.error('[news] live fetch failed, showing unavailable state', error);
    return unavailableResult(message);
  }

  cache.set(NEWS_CACHE_KEY, { value: result, expiresAt: now + NEWS_CACHE_TTL_MS });
  return result;
}

export async function getNewsArticles(): Promise<NewsArticlesResult> {
  if (!newsApiConfigured()) {
    return unavailableResult('NEWS_API_KEY is not configured on the server.');
  }

  return getCachedNewsFeed();
}

export async function getNewsArticleById(id: string): Promise<NewsArticle | null> {
  const { articles } = await getNewsArticles();
  return articles.find((article) => article.id === id) ?? null;
}