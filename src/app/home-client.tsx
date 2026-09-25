'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, Radio, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/football/empty-state';
import { ErrorState } from '@/components/football/error-state';
import { SectionHeader } from '@/components/football/section-header';
import { MatchCard } from '@/components/football/match-card';
import { StandingsTable } from '@/components/football/standings-table';
import { YourTeamSection } from '@/components/football/your-team-section';
import { YourStandingsSection } from '@/components/football/your-standings-section';
import { NewsForYouSection } from '@/components/news/news-for-you-section';
import { NewsCard } from '@/components/news/news-card';
import { HeroStory } from '@/components/news/hero-story';
import { cn } from '@/lib/utils';
import type { MatchResult, NewsArticle, Standing } from '@/lib/types';
import type { FootballDataMeta } from '@/lib/football-data/types';

function formatUpdated(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'just now';
  return date.toLocaleTimeString('en', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

export function HomeClient({
  matches,
  standings,
  resultsMeta,
  standingsMeta,
  resultsError,
  standingsError,
  articles,
  newsProvider,
  newsUpdated,
  newsError,
}: {
  matches: MatchResult[];
  standings: Standing[];
  resultsMeta: FootballDataMeta | null;
  standingsMeta: FootballDataMeta | null;
  resultsError: string | null;
  standingsError: string | null;
  articles: NewsArticle[];
  newsProvider: string;
  newsUpdated: string;
  newsError: string | null;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const router = useRouter();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.getElementById('global-search')?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const heroStory = articles[0];
  const categories = [
    'All',
    ...Array.from(new Set(articles.map((a) => a.category).filter((c): c is string => Boolean(c)))),
  ];

  const newsUnavailable = Boolean(newsError) || articles.length === 0;

  const articlesList = useMemo(
    () =>
      articles.filter((article) => {
        if (article.id === heroStory?.id) return false;
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          !term ||
          [article.title, article.excerpt, article.source, article.category].some((value) =>
            value?.toLowerCase().includes(term)
          );
        return matchesSearch && (activeCategory === 'All' || article.category === activeCategory);
      }),
    [activeCategory, articles, heroStory, searchTerm]
  );

  const clearFilters = () => {
    setSearchTerm('');
    setActiveCategory('All');
  };

  const resultsLive = resultsMeta?.source === 'live';
  const standingsLive = standingsMeta?.source === 'live';
  const latestStandingSeason = standingsLive ? standingsMeta.season : 'Unavailable';

  return (
    <div className="pb-20">
      {/* Hero */}
      <section className="page-shell pt-10 sm:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <span className="chip !h-8 !px-3 !text-xs !font-semibold !text-primary !border-primary/30 !bg-primary/10">
              Matchday HQ
            </span>
            <h1 className="text-display mt-5">
              The beautiful game, <span className="text-primary">at a glance.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Results, standings, breaking news and AI-powered takeaways — your single matchday
              headquarters for the football world.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="#latest-news">Latest news</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/summarizer">
                  <Bot className="h-4 w-4" aria-hidden="true" /> AI Summarizer
                </Link>
              </Button>
            </div>
          </div>
          {heroStory && <HeroStory article={heroStory} />}
        </div>

        {/* Search + category filter */}
        <div className="mx-auto mt-10 max-w-3xl sm:mt-12">
          <div>
            <div className="relative">
              <Search
                className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="global-search"
                type="search"
                placeholder="Search teams, players, news..."
                className="input-surface h-12 rounded-lg pl-12 pr-24 text-base"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                aria-label="Search football news"
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <span className="absolute right-4 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
                  Ctrl K
                </span>
              )}
            </div>
            {searchTerm && (
              <p className="mt-2 text-xs text-muted-foreground" role="status">
                {articlesList.length} {articlesList.length === 1 ? 'story' : 'stories'} match &quot;{searchTerm}
                &quot;
              </p>
            )}
          </div>
          <div
            className="mt-3 -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:justify-center sm:px-0"
            aria-label="Filter news by category"
          >
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                aria-pressed={activeCategory === category}
                className={cn(
                  'min-h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  activeCategory === category
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-secondary/40 text-muted-foreground hover:border-primary/60 hover:text-foreground'
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      <YourTeamSection
        matches={matches}
        competition={standingsMeta?.competition ?? resultsMeta?.competition ?? ''}
      />

      <YourStandingsSection />

      <NewsForYouSection />

      {/* Match centre */}
      <div className="page-shell mt-10 space-y-14 sm:mt-12 sm:space-y-16">
        <section className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="min-w-0">
            <SectionHeader
              eyebrow="Final whistle"
              title="Latest results"
              description={
                resultsError
                  ? 'The live results feed could not be reached right now.'
                  : resultsLive && resultsMeta
                    ? `${resultsMeta.competition} ${resultsMeta.season} — final scores from the latest available matchday.`
                    : 'Live results unavailable right now — please try again shortly.'
              }
              href="/results"
              action="All results"
            />
            {resultsError ? (
              <ErrorState
                title="Results unavailable"
                description={resultsError}
                onRetry={() => router.refresh()}
              />
            ) : (
              <div className="space-y-2.5">
                {matches.slice(0, 3).map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            )}
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Radio className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                {resultsError
                  ? 'Live scores will return automatically once the provider is reachable again.'
                  : resultsLive && resultsMeta
                    ? `Live results from ${resultsMeta.provider} (${resultsMeta.competition}, ${resultsMeta.season}).`
                    : 'Live data unavailable right now — the football provider is not returning current scores.'}
              </span>
            </p>
          </div>
          {standingsError ? (
            <div className="min-w-0">
              <SectionHeader eyebrow="League table" title="Standings" href="/standings" action="Full table" />
              <ErrorState
                title="Standings unavailable"
                description={standingsError}
                onRetry={() => router.refresh()}
              />
            </div>
          ) : (
            standings.length > 0 && (
              <div className="min-w-0">
                <SectionHeader eyebrow="League table" title={standingsMeta?.competition ?? ''} href="/standings" action="Full table" />
                <StandingsTable
                  standings={standings}
                  compact
                  title={standingsMeta?.competition ?? ''}
                  subtitle={latestStandingSeason}
                />
              </div>
            )
          )}
        </section>

        {/* Latest news */}
        <section id="latest-news" className="scroll-mt-24">
          <SectionHeader
            eyebrow="Latest coverage"
            title="Latest news"
            description={
              newsUnavailable
                ? 'Live football headlines will appear here once the news feed is reachable.'
                : searchTerm || activeCategory !== 'All'
                  ? 'Filtered by your current search and category.'
                  : `Fresh football stories from ${newsProvider}.`
            }
          />
          {newsUnavailable ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
              <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-secondary text-muted-foreground">
                <Radio className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="text-card-title text-base">News feed unavailable</h3>
              <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">
                The live football news provider could not be reached
                {newsError ? ` (${newsError})` : ''}. Check back shortly — we only feature real,
                up-to-the-minute football stories.
              </p>
            </div>
          ) : articlesList.length ? (
            <>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {articlesList.map((article) => (
                  <NewsCard key={article.id} article={article} />
                ))}
              </div>
              <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
                <Radio className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>Live news from {newsProvider} — updated {formatUpdated(newsUpdated)}.</span>
              </p>
            </>
          ) : (
            <EmptyState
              title="No news found"
              description="Nothing matches your current search or category. Try a different filter."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          )}
        </section>

        {/* AI banner */}
        <section className="overflow-hidden rounded-2xl border border-primary/25 bg-primary/[0.06] px-6 py-9 sm:px-10 sm:py-11">
          <div className="grid items-center gap-7 md:grid-cols-[1fr_auto]">
            <div>
              <p className="eyebrow mb-2">ScoreCast AI</p>
              <h2 className="text-section-title sm:text-3xl">Get the point, faster.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Turn long football articles into concise, useful takeaways with the AI news
                summarizer.
              </p>
            </div>
            <Button asChild size="lg">
              <Link href="/summarizer">
                Try AI Summarizer <Bot className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}