import Link from 'next/link';
import { ArrowUpRight, Clock3, Newspaper } from 'lucide-react';
import type { NewsArticle } from '@/lib/types';
import { cn, getImageById } from '@/lib/utils';
import { SaveArticleButton } from './save-article-button';
import { NewsImage } from './news-image';

type NewsCardProps = { article: NewsArticle; featured?: boolean; priority?: boolean };

export function NewsCard({ article, featured = false, priority = false }: NewsCardProps) {
  const fallbackImage = getImageById(article.imageId);
  const image = article.imageUrl ? { imageUrl: article.imageUrl, description: article.title } : fallbackImage;
  const category = article.category ?? 'Football';
  const readTime = article.readTime ?? '4 min read';

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border bg-card shadow-card transition duration-200',
        'hover:border-primary/40 hover:shadow-lift',
        featured && 'md:grid md:grid-cols-[1.18fr_1fr]'
      )}
    >
      {article.articleUrl && (
        <Link
          href={article.articleUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          aria-label={article.title}
        />
      )}
      <div
        className={cn(
          'relative overflow-hidden bg-secondary',
          featured ? 'aspect-[16/10] md:aspect-auto md:min-h-full' : 'aspect-[16/9]'
        )}
      >
        {image ? (
          <NewsImage
            src={image.imageUrl}
            alt={image.description}
            eager={priority}
            sizes={featured ? '(max-width: 768px) 100vw, 60vw' : '(max-width: 768px) 100vw, 33vw'}
            className="transition duration-500 group-hover:scale-[1.04]"
            hint={'imageHint' in image ? image.imageHint : article.title}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-secondary via-secondary to-muted" aria-hidden="true">
            <span className="grid h-11 w-11 place-items-center rounded-full border border-border bg-background/60 text-muted-foreground">
              <Newspaper className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
        )}
        <SaveArticleButton article={article} className="z-20" />
      </div>
      <div className={cn('flex flex-col', featured ? 'p-6 sm:p-8' : 'p-5')}>
        <div className="mb-3 flex items-center gap-2">
          <span className="chip h-6 text-[11px]">{category}</span>
          <span className="h-1 w-1 rounded-full bg-border" aria-hidden="true" />
          <span className="text-xs font-medium text-muted-foreground">{article.source}</span>
        </div>
        <h3
          className={cn(
            'text-card-title leading-snug',
            featured ? 'text-2xl sm:text-[2rem] sm:leading-[1.15]' : 'line-clamp-2 text-lg leading-6'
          )}
        >
          {article.title}
        </h3>
        <p
          className={cn(
            'mt-3 text-sm leading-6 text-muted-foreground',
            featured ? 'line-clamp-3' : 'line-clamp-2'
          )}
        >
          {article.excerpt}
        </p>
        <div className="mt-5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {article.date} · {readTime}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-primary">
            Read story <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </article>
  );
}