'use client';

import Link from 'next/link';
import { CircleAlert, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { errorState } from '@/lib/route-errors';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const copy = errorState(error.message);

  return (
    <div className="page-shell flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive">
        <CircleAlert className="h-7 w-7" aria-hidden="true" />
      </span>
      <p className="eyebrow !text-destructive mt-6">Something went wrong</p>
      <h1 className="text-page-title mt-2">{copy.title}</h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">{copy.description}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button type="button" onClick={reset}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">
            <Home className="h-4 w-4" aria-hidden="true" />
            Back to home
          </Link>
        </Button>
      </div>
    </div>
  );
}