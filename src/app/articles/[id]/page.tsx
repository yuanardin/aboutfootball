'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Bot, Clock3, ExternalLink, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NewsCard } from '@/components/news/news-card';
import { newsArticles } from '@/lib/data';
import { getImageById } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const article = newsArticles.find((item) => item.id === id);

  if (!article) {
    return (
      <div className="page-shell py-20 text-center">
        <h1 className="text-page-title">Article not found</h1>
        <p className="mt-3 text-muted-foreground">This story is unavailable.</p>
        <Button asChild className="mt-6">
          <Link href="/news">Back to news</Link>
        </Button>
      </div>
    );
  }

  const image = getImageById(article.imageId);
  const related = newsArticles.filter((item) => item.id !== article.id).slice(0, 3);
  const category = article.category ?? 'Football';

  const shareArticle = async () => {
    const shareData = { title: article.title, text: article.excerpt, url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast({ description: 'Article link copied to clipboard.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Could not share', description: 'Please try again.' });
    }
  };

  return (
    <div className="page-shell py-8 sm:py-12">
      <nav aria-label="Breadcrumb">
        <Link
          href="/news"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to news
        </Link>
      </nav>

      <article className="mx-auto mt-8 max-w-4xl">
        <div className="max-w-3xl">
          <p className="eyebrow">
            {category} · {article.source}
          </p>
          <h1 className="mt-4 text-display sm:text-5xl">{article.title}</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">{article.excerpt}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              {article.date} · {article.readTime ?? '4 min read'}
            </span>
            <button
              type="button"
              onClick={shareArticle}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 py-2 transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Share article"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Share
            </button>
          </div>
        </div>

        {image && (
          <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-xl border border-border md:aspect-[21/9]">
            <Image
              src={image.imageUrl}
              alt={image.description}
              fill
              priority
              sizes="(min-width: 768px) 896px, 100vw"
              className="object-cover"
            />
          </div>
        )}

        <div className="mx-auto mt-10 max-w-[760px]">
          <div className="card-surface border-primary/30 bg-primary/[0.06] p-5 sm:p-6">
            <div className="flex gap-3.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-headline font-bold">AI summary</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Generate a concise summary of the original article with ScoreCast AI.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/summarizer">
                    Summarize article <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-12 border-l-2 border-primary/40 pl-4 sm:pl-5">
            <p className="text-sm font-semibold text-foreground">
              Preview article
            </p>
            <p className="mt-1.5 text-base leading-7 text-muted-foreground">
              This article is currently available as a preview from {article.source}. Full article
              content will appear here when an article-content source is connected.
            </p>
          </div>
        </div>
      </article>

      <section className="mt-16">
        <p className="eyebrow mb-2.5">Continue reading</p>
        <h2 className="text-section-title">More headlines</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          {related.map((item) => (
            <NewsCard key={item.id} article={item} />
          ))}
        </div>
      </section>
    </div>
  );
}