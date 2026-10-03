'use client';

import { useState } from 'react';
import { Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';

type NewsImageProps = {
  src: string;
  alt: string;
  sizes?: string;
  /** Above-the-fold hero: eager load with high fetch priority. Everything else stays lazy. */
  eager?: boolean;
  className?: string;
  hint?: string;
};

function NewsImageFallback() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 grid place-items-center bg-gradient-to-br from-secondary via-secondary to-muted"
    >
      <span className="grid h-11 w-11 place-items-center rounded-full border border-border bg-background/60 text-muted-foreground">
        <Newspaper className="h-5 w-5" aria-hidden="true" />
      </span>
    </div>
  );
}

/**
 * Article imagery (NewsAPI provider URLs such as Yahoo/ZenFS, plus the
 * Unsplash stand-ins) is fetched directly by the browser instead of through
 * the Next.js image optimizer. Slow or hotlink-protected upstream hosts used
 * to surface as "upstream image response timed out" from `/_next/image` and
 * leave broken/slow cards; a direct `<img>` keeps a single bad host from
 * degrading the whole news surface. A failed image swaps to a stable
 * fallback in the same box, so aspect ratio holds and no layout shift occurs.
 */
export function NewsImage({ src, alt, sizes, eager = false, className, hint }: NewsImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <NewsImageFallback />;
  }

  return (
    <>
      <NewsImageFallback />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        sizes={sizes}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        decoding="async"
        referrerPolicy="no-referrer"
        draggable={false}
        onError={() => setFailed(true)}
        className={cn('absolute inset-0 h-full w-full object-cover', className)}
        data-ai-hint={hint}
      />
    </>
  );
}
