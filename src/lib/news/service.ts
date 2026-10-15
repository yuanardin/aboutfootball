import 'server-only';

import type { NewsArticle } from '@/lib/types';
import { dedupeArticlesById } from './dedupe';

const NEWS_API_BASE_URL = 'https://newsapi.org/v2';
// Football/soccer focused query, biased toward the top five European leagues.
const NEWS_QUERY =
  'football OR soccer OR "premier league" OR "la liga" OR "serie a" OR "bundesliga" OR "ligue 1" OR "champions league" OR "europa league"';
const NEWS_CACHE_TTL_MS = 10 * 60 * 1000;
const NEWS_CACHE_KEY = 'news:live:feed';
const NEWS_PAGE_SIZE = 50;
const NEWS_DISPLAY_LIMIT = 12;
const NEWS_REQUEST_TIMEOUT_MS = 12_000;

export type NewsSourceStatus = 'live' | 'unavailable';

export type NewsArticlesResult = {
  articles: NewsArticle[];
  source: NewsSourceStatus;
  provider: string;
  lastUpdated: string;
  error: string | null;
};

type CacheEntry = { value: NewsArticlesResult; expiresAt: number };

const cache = new Map<string, CacheEntry>();
// Concurrent renders (e.g. fast Home ↔ News navigation while a fetch is still
// running) share one upstream read instead of each firing the sequential
// fallback queries — same in-flight dedupe pattern as the club-news cache.
const newsInFlight = new Map<string, Promise<NewsArticlesResult>>();

export type NewsFailureKind = 'config' | 'http' | 'network' | 'timeout';

export class NewsProviderError extends Error {
  constructor(
    public readonly status: number | null,
    public readonly kind: NewsFailureKind,
    message: string
  ) {
    super(message);
    this.name = 'NewsProviderError';
  }
}

export function newsApiConfigured(): boolean {
  return Boolean(process.env.NEWS_API_KEY);
}

function newsApiKey(): string {
  const key = process.env.NEWS_API_KEY;
  if (!key) {
    throw new NewsProviderError(null, 'config', 'NEWS_API_KEY is not set on the server');
  }
  return key;
}

type NewsApiPayload = { articles?: Record<string, unknown>[] };

async function newsApiRequest(endpoint: string): Promise<NewsApiPayload> {
  const key = newsApiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NEWS_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      headers: {
        'X-Api-Key': key,
        Accept: 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new NewsProviderError(
        response.status,
        'http',
        `NewsAPI returned ${response.status} ${response.statusText}`
      );
    }

    return (await response.json()) as NewsApiPayload;
  } catch (error) {
    if (error instanceof NewsProviderError) {
      throw error;
    }
    if (controller.signal.aborted || (error as Error)?.name === 'AbortError') {
      throw new NewsProviderError(
        null,
        'timeout',
        `NewsAPI request timed out after ${NEWS_REQUEST_TIMEOUT_MS}ms`
      );
    }
    throw new NewsProviderError(
      null,
      'network',
      `NewsAPI request failed: ${(error as Error).message}`
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function newsErrorMessage(error: unknown, scope = 'news'): string {
  if (error instanceof NewsProviderError) {
    if (error.kind === 'config') {
      return 'The news provider is not configured on the server.';
    }
    if (error.kind === 'timeout') {
      return `The live ${scope} request timed out. Please try again shortly.`;
    }
    if (error.kind === 'network') {
      return `Could not reach the live ${scope} provider right now. Please try again shortly.`;
    }
    if (error.status === 401 || error.status === 403) {
      return 'The live news provider rejected the configured API key. Please try again later.';
    }
    if (error.status === 429) {
      return 'The live news provider rate limit was reached. Please try again shortly.';
    }
    return `The live ${scope} provider returned an error (${error.status ?? 'unknown'}). Please try again shortly.`;
  }
  return `Could not reach the live ${scope} provider right now. Please try again shortly.`;
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
    source: 'unavailable',
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
    excerpt: description || content || title,
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
  const queries = [
    NEWS_QUERY,
    'football OR soccer',
    'premier league OR la liga OR serie a OR bundesliga OR ligue 1',
    'football news',
  ];

  let lastError: unknown = null;
  let providerResponded = false;

  for (const query of queries) {
    const endpoint = `${NEWS_API_BASE_URL}/everything?q=${encodeURIComponent(
      query
    )}&language=en&sortBy=publishedAt&pageSize=${NEWS_PAGE_SIZE}`;

    try {
      const payload = await newsApiRequest(endpoint);
      providerResponded = true;

      const articles = dedupeArticlesById(
        sortFeedArticles(
          (payload.articles ?? [])
            .map(mapLiveArticle)
            .filter((article): article is NewsArticle => Boolean(article))
            .filter(isFootballRelevant)
        )
      ).slice(0, NEWS_DISPLAY_LIMIT);

      if (articles.length) {
        return {
          articles,
          source: 'live',
          provider: 'NewsAPI',
          lastUpdated: new Date().toISOString(),
          error: null,
        };
      }
    } catch (error) {
      lastError = error;
    }
  }

  return unavailableResult(
    providerResponded
      ? 'The live news provider responded but returned no football-related stories right now.'
      : newsErrorMessage(lastError)
  );
}

async function loadNewsFeed(): Promise<NewsArticlesResult> {
  let result: NewsArticlesResult;
  try {
    result = await fetchNewsFeed();
  } catch (error) {
    console.error('[news] live fetch failed, showing unavailable state', error);
    return unavailableResult(newsErrorMessage(error));
  }

  if (result.error) {
    return result;
  }

  cache.set(NEWS_CACHE_KEY, { value: result, expiresAt: Date.now() + NEWS_CACHE_TTL_MS });
  return result;
}

async function getCachedNewsFeed(): Promise<NewsArticlesResult> {
  const now = Date.now();
  const existing = cache.get(NEWS_CACHE_KEY);

  if (existing && existing.expiresAt > now) {
    return existing.value;
  }

  const inFlight = newsInFlight.get(NEWS_CACHE_KEY);
  if (inFlight) {
    return inFlight;
  }

  const pending = loadNewsFeed();
  newsInFlight.set(NEWS_CACHE_KEY, pending);
  try {
    return await pending;
  } finally {
    newsInFlight.delete(NEWS_CACHE_KEY);
  }
}

export async function getNewsArticles(): Promise<NewsArticlesResult> {
  if (!newsApiConfigured()) {
    return unavailableResult('The news provider is not configured on the server.');
  }

  return getCachedNewsFeed();
}

export async function getNewsArticleById(id: string): Promise<NewsArticle | null> {
  const { articles } = await getNewsArticles();
  return articles.find((article) => article.id === id) ?? null;
}

export type TeamNewsResult = {
  articles: NewsArticle[];
  club: string;
  provider: string;
  lastUpdated: string;
  error: string | null;
};

export type NewsRankingPreferences = {
  topics?: string[];
  leagues?: string[];
};

const TEAM_NEWS_PAGE_SIZE = 20;
const TEAM_NEWS_DISPLAY_LIMIT = 6;
const TEAM_NEWS_CACHE_TTL_MS = 10 * 60 * 1000;

// Lightweight keyword hints used to re-rank personalized club news by the user's chosen
// topics. They only ever re-order articles that the live provider already returned — no
// invented stories, no filtering out of honest results.
const TOPIC_KEYWORDS: Record<string, string[]> = {
  matchday: [
    'matchday',
    'kick-off',
    'kick off',
    'line-up',
    'lineup',
    'team news',
    'starting xi',
    'team sheet',
    'preview',
    'predicted',
  ],
  transfers: [
    'transfer',
    'signing',
    'signs',
    'new deal',
    'agreement',
    'bid',
    'fee',
    'rumour',
    'rumor',
    'wanted',
  ],
  injuries: [
    'injury',
    'injured',
    'ruled out',
    'sidelined',
    'fitness',
    'hamstring',
    'recovery',
    'return to training',
  ],
  analysis: ['analysis', 'tactical', 'statistics', 'stats', 'expected goals', 'deep dive', 'form guide', 'verdict'],
  offpitch: ['manager', 'sacked', 'banned', 'fined', 'contract', 'extension', 'chairman', 'owner', 'statement'],
};

function affinityScore(article: NewsArticle, preferences?: NewsRankingPreferences): number {
  if (!preferences) return 0;

  const text = searchableText(article.title, article.excerpt);
  let score = 0;

  for (const topic of preferences.topics ?? []) {
    for (const term of TOPIC_KEYWORDS[topic] ?? []) {
      if (text.includes(term)) {
        score += 1;
        break;
      }
    }
  }

  for (const league of preferences.leagues ?? []) {
    if (text.includes(league.toLowerCase())) score += 2;
  }

  return score;
}

// Re-ranks real club-news results by the user's preferences (topics first, then chosen
// leagues); ties fall back to newest first. Applied per request so the cache stays neutral.
function rankArticles(
  articles: NewsArticle[],
  preferences?: NewsRankingPreferences
): NewsArticle[] {
  if (!preferences) return articles;

  const hasRanking = Boolean(preferences.topics?.length) || Boolean(preferences.leagues?.length);
  if (!hasRanking) return articles;

  return [...articles].sort((a, b) => {
    const diff = affinityScore(b, preferences) - affinityScore(a, preferences);
    return diff !== 0 ? diff : sortByPublishedAt(a, b);
  });
}

type TeamNewsCacheEntry = { value: TeamNewsResult; expiresAt: number };
const teamNewsCache = new Map<string, TeamNewsCacheEntry>();
const teamNewsInFlight = new Map<string, Promise<TeamNewsResult>>();

// Truthful mapper for club queries: only real headline/URL/date/source/image from the API.
// Excerpt is the provider's own description — never replaced with invented copy.
function mapClubArticle(article: Record<string, unknown>): NewsArticle | null {
  const title = typeof article.title === 'string' ? article.title.trim() : '';
  const url = typeof article.url === 'string' ? article.url.trim() : '';

  if (!title || !url) return null;

  const publishedAt =
    typeof article.publishedAt === 'string' ? article.publishedAt : new Date().toISOString();
  const description = typeof article.description === 'string' ? article.description.trim() : '';
  const content = typeof article.content === 'string' ? article.content.trim() : '';
  const rawSource = article.source as { name?: unknown } | null | undefined;
  const source = typeof rawSource?.name === 'string' && rawSource.name ? rawSource.name : 'Live source';
  const imageUrl = normalizeImageUrl(
    typeof article.urlToImage === 'string' ? article.urlToImage : undefined
  );

  const excerptFields = [description, content].filter(Boolean);
  const excerpt = excerptFields.length
    ? excerptFields[0]
    : title;

  return {
    id: deterministicId(title, url, publishedAt),
    title,
    excerpt,
    source,
    date: normalizeDate(publishedAt),
    imageId: `news-${(content.length || title.length) % 6 + 1}`,
    imageUrl,
    category: 'Football',
    readTime: readTimeFromText(content || description),
    articleUrl: url,
    publishedAt,
  };
}

// The club query already phrased the team name into the NewsAPI search, but to keep the section
// honest we only keep articles that actually mention the club in their visible title/description.
function mentionsClub(article: NewsArticle, terms: string[]): boolean {
  const text = searchableText(article.title, article.excerpt);
  return terms.some((term) => text.includes(term));
}

// Same non-soccer noise guards as the main feed (NFL/gridiron, other sports), but without the
// strict league-marker gate so clubs like Wolves or Fulham pass when a story is clearly about them.
function isClubArticleRelevant(article: NewsArticle): boolean {
  const text = searchableText(article.title, article.excerpt);
  if (hasAnyTerm(text, NON_SOCCER_HINTS)) return false;
  if (hasAnyTerm(text, OTHER_SPORT_HINTS)) return false;
  const source = article.source.toLowerCase();
  return !BLOCKED_SOURCES.some((name) => source.includes(name));
}

async function fetchClubNews(clubName: string, aliases: string[]): Promise<TeamNewsResult> {
  const lowerClub = clubName.trim().toLowerCase();
  const distinctAliases = aliases
    .map((alias) => alias.trim())
    .filter(Boolean)
    .filter((alias) => alias.toLowerCase() !== lowerClub);

  const queries = [
    `"${clubName}"`,
    `"${clubName}" football`,
    ...(distinctAliases.length
      ? [`${distinctAliases.map((alias) => `"${alias}"`).join(' OR ')}`]
      : []),
  ];

  let lastError: unknown = null;
  let providerResponded = false;

  for (const query of queries) {
    const endpoint = `${NEWS_API_BASE_URL}/everything?q=${encodeURIComponent(
      query
    )}&language=en&sortBy=publishedAt&pageSize=${TEAM_NEWS_PAGE_SIZE}`;

    try {
      const payload = await newsApiRequest(endpoint);
      providerResponded = true;

      const terms = [clubName, ...aliases].map((term) => term.toLowerCase()).filter(Boolean);

      const articles = dedupeArticlesById(
        [...(payload.articles ?? [])]
          .map(mapClubArticle)
          .filter((article): article is NewsArticle => Boolean(article))
          .filter(isClubArticleRelevant)
          .filter((article) => mentionsClub(article, terms))
          .sort(sortByPublishedAt)
      ).slice(0, TEAM_NEWS_DISPLAY_LIMIT);

      if (articles.length) {
        return {
          articles,
          club: clubName,
          provider: 'NewsAPI',
          lastUpdated: new Date().toISOString(),
          error: null,
        };
      }
    } catch (error) {
      lastError = error;
    }
  }

  return {
    articles: [],
    club: clubName,
    provider: 'NewsAPI',
    lastUpdated: new Date().toISOString(),
    error: providerResponded
      ? null
      : newsErrorMessage(lastError, 'team news'),
  };
}

async function loadClubNews(clubName: string, aliases: string[]): Promise<TeamNewsResult> {
  const key = clubName.toLowerCase();
  const existing = teamNewsCache.get(key);

  try {
    const value = await fetchClubNews(clubName, aliases);
    if (value.error) {
      return value;
    }
    teamNewsCache.set(key, { value, expiresAt: Date.now() + TEAM_NEWS_CACHE_TTL_MS });
    return value;
  } catch (error) {
    console.error(`[news] club "${clubName}" fetch failed`, error);
    if (existing) {
      return {
        ...existing.value,
        error: 'Live updates paused — showing last known news for this club.',
      };
    }
    return {
      articles: [],
      club: clubName,
      provider: 'NewsAPI',
      lastUpdated: new Date().toISOString(),
      error: newsErrorMessage(error, 'team news'),
    };
  }
}

export async function getNewsForTeam(
  clubName: string,
  aliases: string[],
  preferences?: NewsRankingPreferences
): Promise<TeamNewsResult> {
  const key = clubName.toLowerCase();

  if (!newsApiConfigured()) {
    return {
      articles: [],
      club: clubName,
      provider: 'NewsAPI',
      lastUpdated: new Date().toISOString(),
      error: 'The news provider is not configured on the server.',
    };
  }

  const existing = teamNewsCache.get(key);
  if (existing && existing.expiresAt > Date.now()) {
    return { ...existing.value, articles: rankArticles(existing.value.articles, preferences) };
  }

  const inFlight = teamNewsInFlight.get(key);
  if (inFlight) {
    const pending = await inFlight;
    return { ...pending, articles: rankArticles(pending.articles, preferences) };
  }

  const pending = loadClubNews(clubName, aliases);
  teamNewsInFlight.set(key, pending);
  try {
    const result = await pending;
    return { ...result, articles: rankArticles(result.articles, preferences) };
  } finally {
    teamNewsInFlight.delete(key);
  }
}