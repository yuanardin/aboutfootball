'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Clock3, Newspaper, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NewsCard } from '@/components/news/news-card';
import { EmptyState } from '@/components/football/empty-state';
import { newsArticles } from '@/lib/data';
import type { NewsArticle } from '@/lib/types';
import { getImageById, cn } from '@/lib/utils';

const featuredArticle = newsArticles[0];

const categories = [
  'All',
  ...Array.from(new Set(newsArticles.map((a) => a.category).filter((c): c is string => Boolean(c)))),
];

function FeaturedStory({ article }: { article: NewsArticle }) {
  const image = getImageById(article.imageId);
  const category = article.category ?? 'Football';
  const readTime = article.readTime ?? '4 min read';

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-card transition duration-200 hover:border-primary/40 hover:shadow-lift md:grid md:grid-cols-[1.18fr_1fr]">
      <Link
        href={`/articles/${article.id}`}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        aria-label={article.title}
      />
      <div className="relative aspect-[16/10] overflow-hidden bg-secondary md:aspect-auto md:min-h-full">
        {image ? (
          <Image
            src={image.imageUrl}
            alt={image.description}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 55vw"
            className="object-cover transition duration-500 group-hover:scale-[1.04]"
            data-ai-hint={image.imageHint}
          />
        ) : (
          <div className="absolute inset-0 bg-secondary" />
        )}
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

export function NewsExplorer() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const isFiltering = searchTerm.trim() !== '' || activeCategory !== 'All';

  const articles = useMemo(
    () =>
      newsArticles.filter((article) => {
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch =
          !term ||
          [article.title, article.excerpt, article.source, article.category].some((value) =>
            value?.toLowerCase().includes(term)
          );
        return matchesSearch && (activeCategory === 'All' || article.category === activeCategory);
      }),
    [activeCategory, searchTerm]
  );

  const clearFilters = () => {
    setSearchTerm('');
    setActiveCategory('All');
  };

  const gridArticles = isFiltering ? articles : articles.filter((a) => a.id !== featuredArticle.id);

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
        <span className="chip w-fit shrink-0 sm:mb-1">Demo records · Jul 2024</span>
      </header>

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
          {articles.length} {articles.length === 1 ? 'story' : 'stories'} match &quot;{searchTerm}
          &quot;
        </p>
      )}

      {isFiltering && !articles.length ? (
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
          {!isFiltering && <FeaturedStory article={featuredArticle} />}

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
            <span>
              Demo dataset — {newsArticles.length} preview stories dated July 2024 with placeholder
              imagery. A live news source will keep headlines, dates and images up to date.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}