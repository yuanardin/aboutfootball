'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, Clock3, Newspaper, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NewsCard } from '@/components/news/news-card';
import { SaveArticleButton } from '@/components/news/save-article-button';
import { EmptyState } from '@/components/football/empty-state';
import type { NewsArticle } from '@/lib/types';
import { composeNewsGrid } from '@/lib/news/compose';
import { cn, getImageById } from '@/lib/utils';

type NewsExplorerProps = {
  articles: NewsArticle[];
  source: 'live' | 'unavailable';
  provider: string;
  lastUpdated: string;
  error?: string | null;
};

function formatLastUpdated(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);
}

function FeaturedStory({ article }: { article: NewsArticle }) {
  const image = article.imageUrl ? { imageUrl: article.imageUrl, description: article.title } : getImageById(article.imageId);
  const category = article.category ?? 'Football';
  const readTime = article.readTime ?? '4 min read';

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-card transition duration-200 hover:border-primary/40 hover:shadow-lift md:grid md:grid-cols-[1.18fr_1fr]">
      {article.articleUrl && (
        <Link
          href={article.articleUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          aria-label={article.title}
        />
      )}
      <div className="relative aspect-[16/10] overflow-hidden bg-secondary md:aspect-auto md:min-h-full">
        {image ? (
          <Image
            src={image.imageUrl}
            alt={image.description}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 55vw"
            className="object-cover transition duration-500 group-hover:scale-[1.04]"
            data-ai-hint={article.title}
          />
        ) : (
          <div className="absolute inset-0 bg-secondary" />
        )}
        <SaveArticleButton article={article} />
      </div>
      <div className="flex flex-col p-6 sm:p-8">
        <div className="mb-3 flex items-center gap-2">
          <span className="chip !h-6 !text-[11px]">{category}</span>
          <span className="h-1 w-1 rounded-full bg-border" aria-hidden="true" />
          <span className="text-xs font-medium text-muted-foreground">{article.source}</span>
        </div>
        <h2 className="font-headline text-2xl font-bold leading-[1.15] tracking-tight sm:text-3xl">
          {article.title}
        </h2>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{article.excerpt}</p>
        <div className="mt-6 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {article.date} · {readTime}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-primary transition group-hover:gap-2">
            Read story <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </div>
    </article>
  );
}

export function NewsExplorer({ articles, source, provider, lastUpdated, error }: NewsExplorerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const feedUnavailable = source === 'unavailable' || Boolean(error) || articles.length === 0;

  // Defensive last gate: gridArticles is derived from a deduplicated list so a
  // duplicate id can never reach the `key={article.id}` map below, no matter
  // what the server payload contained.
  const { categories, isFiltering, filteredArticles, featuredArticle, gridArticles } = useMemo(
    () => composeNewsGrid(articles, { searchTerm, activeCategory }),
    [activeCategory, articles, searchTerm]
  );

  const clearFilters = () => {
    setSearchTerm('');
    setActiveCategory('All');
  };

  return (
    <div className="page-shell pb-20 pt-10 sm:pt-14">
      <header className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <section className="max-w-2xl">
          <p className="eyebrow mb-3">The latest</p>
          <h1 className="text-page-title">Football News</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Transfer talk, matchday coverage and analysis — filter by topic or search the newsroom.
          </p>
        </section>
        <div className="flex flex-col items-start gap-2 sm:mb-1">
          <span className="chip w-fit shrink-0">
            <span
              className={feedUnavailable ? 'mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-warning' : 'mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success'}
              aria-hidden="true"
            />
            {feedUnavailable ? 'Live data unavailable' : 'Live news'}
          </span>
          <span className="text-xs text-muted-foreground">Updated {formatLastUpdated(lastUpdated)}</span>
        </div>
      </header>

      {feedUnavailable ? (
        <section
          role="alert"
          aria-label="News unavailable"
          className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-muted-foreground">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="text-card-title mt-4 font-headline text-xl font-bold">News unavailable right now</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            The live football news feed is not available right now{error ? ` (${error})` : ''}. Check
            back shortly — we only show real, up-to-the-minute football stories here.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/news">Refresh feed</Link>
          </Button>
        </section>
      ) : (
        <>

      <section aria-label="News filters" className="mt-8 sm:mt-10">
        <div className="relative max-w-xl">
          <Search
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="news-search"
            type="search"
            placeholder="Search the newsroom..."
            className="input-surface h-12 rounded-lg pl-12 pr-12 text-base"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-label="Search football news"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div
          className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
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
      </section>

      {searchTerm && (
        <p className="mt-3 text-xs text-muted-foreground" role="status">
          {filteredArticles.length} {filteredArticles.length === 1 ? 'story' : 'stories'} match &quot;{searchTerm}
          &quot;
        </p>
      )}

      {filteredArticles.length === 0 ? (
        <EmptyState
          icon={<Newspaper className="h-5 w-5" aria-hidden="true" />}
          title="No stories found"
          description="Nothing matches your current search or category. Try a different keyword or filter."
          action={
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="mt-10 space-y-14">
          {!isFiltering && featuredArticle && <FeaturedStory article={featuredArticle} />}

          <section>
            <p className="eyebrow mb-2.5">
              {isFiltering ? 'Filtered coverage' : 'More headlines'}
            </p>
            <h2 className="text-section-title">
              {isFiltering ? 'Matching stories' : 'From the newsroom'}
            </h2>
            {gridArticles.length ? (
              <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {gridArticles.map((article) => (
                  <NewsCard key={article.id} article={article} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Newspaper className="h-5 w-5" aria-hidden="true" />}
                title="No stories found"
                description="Nothing matches your current search or category. Try a different keyword or filter."
                action={
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            )}
          </section>

          <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>Live news from {provider} — updated {formatLastUpdated(lastUpdated)}.</span>
          </p>
        </div>
      )}
        </>
      )}
    </div>
  );
}