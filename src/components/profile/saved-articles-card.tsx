'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Bookmark, Loader2, Newspaper, RefreshCw, Trash2 } from 'lucide-react';
import type { User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn, getImageById } from '@/lib/utils';
import {
  getSavedArticles,
  getFirestoreErrorMessage,
  unsaveArticle,
  type SavedArticle,
} from '@/lib/favorites/saved-articles';

function SavedArticleSkeletonCard() {
  return (
    <div className="flex gap-4 py-4">
      <Skeleton className="h-16 w-24 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-full max-w-sm" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}

function SavedArticleRow({
  article,
  onRemove,
  removing,
}: {
  article: SavedArticle;
  onRemove: (article: SavedArticle) => void;
  removing: boolean;
}) {
  const fallbackImage = getImageById(article.imageId);
  const image = article.imageUrl
    ? { imageUrl: article.imageUrl, description: article.title }
    : fallbackImage;
  const isExternal = Boolean(article.articleUrl);

  return (
    <div className="flex items-start gap-4 border-t border-border/60 py-4 first:border-t-0 first:pt-0 last:pb-0">
      <Link
        href={article.articleUrl ?? '#'}
        target={isExternal ? '_blank' : undefined}
        rel="noreferrer"
        aria-label={article.title}
        className="relative block h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-secondary transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {image ? (
          <Image
            src={image.imageUrl}
            alt={image.description}
            fill
            sizes="96px"
            className="object-cover"
            data-ai-hint={'imageHint' in image ? image.imageHint : article.title}
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-muted-foreground">
            <Newspaper className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          href={article.articleUrl ?? '#'}
          target={isExternal ? '_blank' : undefined}
          rel="noreferrer"
          className="line-clamp-2 text-card-title text-sm font-semibold leading-5 transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          {article.title}
        </Link>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {article.source}
          {article.date ? ` · ${article.date}` : ''}
          {article.readTime ? ` · ${article.readTime}` : ''}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        {isExternal && (
          <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
            <Link href={article.articleUrl ?? '#'} target="_blank" rel="noreferrer">
              Read <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => onRemove(article)}
          disabled={removing}
          aria-label={`Remove ${article.title} from saved`}
        >
          {removing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Remove
        </Button>
      </div>
    </div>
  );
}

export function SavedArticlesCard({ user }: { user: User }) {
  const firebase = useFirebase();
  const firestore = firebase.firestore ?? null;
  const { toast } = useToast();

  const [articles, setArticles] = useState<SavedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!firestore) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      setArticles(await getSavedArticles(firestore, user.uid));
    } catch (error) {
      setLoadError(getFirestoreErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [firestore, user.uid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRemove = useCallback(
    async (article: SavedArticle) => {
      if (!firestore || removingId) return;
      setRemovingId(article.id);
      try {
        await unsaveArticle(firestore, user.uid, article);
        setArticles((items) => items.filter((item) => item.id !== article.id));
        toast({ description: 'Story removed from your saved articles.' });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Unable to remove this story',
          description: getFirestoreErrorMessage(error),
        });
      } finally {
        setRemovingId(null);
      }
    },
    [firestore, removingId, toast, user.uid]
  );

  return (
    <Card className="card-surface mt-6">
      <CardHeader className="border-b border-border/60 px-6 py-5 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-card-title text-lg">Saved articles</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Stories you bookmarked from the football feed — stored only on your profile.
            </p>
          </div>
          {!loading && !loadError && articles.length > 0 && (
            <span className="chip shrink-0">
              {articles.length} {articles.length === 1 ? 'story' : 'stories'}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6 sm:p-8">
        {loading ? (
          <div className="space-y-1" aria-busy="true">
            <SavedArticleSkeletonCard />
            <SavedArticleSkeletonCard />
            <SavedArticleSkeletonCard />
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4">
            <p className="text-sm leading-6 text-destructive" role="alert">
              {loadError}
            </p>
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw
                className={cn('h-3.5 w-3.5', loading && 'animate-spin')}
                aria-hidden="true"
              />
              Try again
            </Button>
          </div>
        ) : articles.length ? (
          <>
            <div className="space-y-4">
              {articles.map((article) => (
                <SavedArticleRow
                  key={article.id}
                  article={article}
                  onRemove={handleRemove}
                  removing={removingId === article.id}
                />
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-5">
              <p className="text-xs text-muted-foreground">
                Saved with your account — sign in on any device to see them.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/news">
                  Browse the newsroom <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
            <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-secondary text-muted-foreground">
              <Bookmark className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="text-card-title text-base">No saved articles yet</h3>
            <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">
              Tap the bookmark on any football story to keep it here for later.
            </p>
            <Button asChild className="mt-5">
              <Link href="/news">
                Find stories <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}