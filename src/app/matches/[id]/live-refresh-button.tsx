'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Manual refresh for LIVE matches. There is deliberately no interval polling:
// the server caches single-match reads for 60 seconds, so each click costs at
// most one provider request and never hammers the free-tier quota.
export function LiveRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        startTransition(() => router.refresh());
      }}
      aria-label="Refresh live match data"
      className="shrink-0"
    >
      <RefreshCw className={cn('h-3.5 w-3.5', isPending && 'animate-spin')} aria-hidden="true" />
      {isPending ? 'Refreshing…' : 'Refresh'}
    </Button>
  );
}
