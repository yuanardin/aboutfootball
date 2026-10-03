import Link from 'next/link';
import { ArrowUpRight, Clock3, Newspaper } from 'lucide-react';
import type { NewsArticle } from '@/lib/types';
import { getImageById } from '@/lib/utils';
import { SaveArticleButton } from './save-article-button';
import { NewsImage } from './news-image';

export function HeroStory({ article }: { article: NewsArticle }) {
  const fallbackImage = getImageById(article.imageId);
  const image = article.imageUrl
    ? { imageUrl: article.imageUrl, description: article.title }
    : fallbackImage;
  const category = article.category ?? 'Football';

  return (
    <article className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-lift">
      {article.articleUrl && (
        <Link
          href={article.articleUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute inset-0 z-20 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={article.title}
        />
      )}
      <div className="relative aspect-[4/3] sm:aspect-[16/10] lg:aspect-auto lg:h-[430px]">
        {image ? (
          <NewsImage
            src={image.imageUrl}
            alt={image.description}
            eager
            sizes="(max-width: 1024px) 100vw, 55vw"
            className="transition duration-700 group-hover:scale-[1.04]"
            hint={'imageHint' in image ? image.imageHint : article.title}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-secondary via-secondary to-muted" aria-hidden="true">
            <span className="grid h-11 w-11 place-items-center rounded-full border border-border bg-background/60 text-muted-foreground">
              <Newspaper className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
        )}
        <SaveArticleButton article={article} className="z-30" />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10"
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 bottom-0 z-10 p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-6 items-center rounded-full bg-primary px-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-primary-foreground">
              {category}
            </span>
            <span className="text-xs font-medium text-white/70">{article.source}</span>
          </div>
          <h2 className="mt-3 font-headline text-2xl font-bold leading-[1.15] tracking-tight text-white sm:text-3xl">
            {article.title}
          </h2>
          <p className="mt-2 line-clamp-2 max-w-lg text-sm leading-6 text-white/75">{article.excerpt}</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-white/60">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              {article.date} · {article.readTime ?? '4 min read'}
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
              Read story <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}