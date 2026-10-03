'use client';

import { useCallback, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
  ALL_COMPETITIONS,
  COMPETITIONS,
  type CompetitionSelection,
} from '@/lib/football-data/competitions';
import { cn } from '@/lib/utils';

type CompetitionSelectorProps = {
  value: CompetitionSelection;
  /** Show the "All" chip in addition to the individual competitions. */
  allowAll?: boolean;
  label?: string;
  className?: string;
};

// The selection lives in the URL (?competition=PL) so the chosen competition is shareable,
// survives a refresh, and lets the server component fetch the right data per competition.
export function CompetitionSelector({
  value,
  allowAll = true,
  label = 'Select competition',
  className,
}: CompetitionSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const options: { code: CompetitionSelection; label: string }[] = [
    ...(allowAll ? [{ code: ALL_COMPETITIONS, label: 'All' }] : []),
    ...COMPETITIONS.map((competition) => ({
      code: competition.code as CompetitionSelection,
      label: competition.label,
    })),
  ];

  const select = useCallback(
    (next: CompetitionSelection) => {
      if (next === value) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set('competition', next);
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams, value]
  );

  return (
    <div
      role="group"
      aria-label={label}
      aria-busy={pending}
      className={cn(
        '-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 pt-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0',
        className
      )}
    >
      {options.map((option) => {
        const active = option.code === value;
        return (
          <button
            key={option.code}
            type="button"
            onClick={() => select(option.code)}
            aria-pressed={active}
            className={cn(
              'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-secondary/40 text-muted-foreground hover:border-primary/60 hover:text-foreground'
            )}
          >
            {active && pending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
