import Image from 'next/image';
import type { MatchResult } from '@/lib/types';
import { cn, getImageById } from '@/lib/utils';

type MatchStatus = MatchResult['status'];

const statusStyles: Record<
  MatchStatus,
  { label: string; className: string; indicator?: boolean }
> = {
  LIVE: {
    label: 'LIVE',
    className: 'bg-destructive/15 text-destructive',
    indicator: true,
  },
  HT: {
    label: 'HT',
    className: 'bg-warning/15 text-warning',
  },
  FT: {
    label: 'FT',
    className: 'bg-secondary text-muted-foreground',
  },
};

function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const config = statusStyles[status] ?? statusStyles.FT;
  return (
    <span
      className={cn(
        'inline-flex min-w-9 items-center justify-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em]',
        config.className
      )}
    >
      {config.indicator && (
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {config.label}
    </span>
  );
}

export function MatchCard({ match, small = false }: { match: MatchResult; small?: boolean }) {
  const home = getImageById(match.homeTeam.logoId);
  const away = getImageById(match.awayTeam.logoId);

  return (
    <article className="rounded-lg border border-border/80 bg-card/60 px-4 py-3 transition hover:border-primary/40 sm:px-4">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
            {match.league}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">{match.matchDate}</span>
          <MatchStatusBadge status={match.status} />
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center justify-end gap-2.5 text-right font-medium">
          <span className={cn('truncate', small ? 'text-sm' : 'text-sm sm:text-[15px]')}>
            {match.homeTeam.name}
          </span>
          {home && (
            <Image
              src={home.imageUrl}
              alt={match.homeTeam.name}
              width={24}
              height={24}
              className="h-6 w-6 shrink-0 object-contain"
              data-ai-hint={home.imageHint}
            />
          )}
        </div>
        <div className="flex flex-col items-center px-1 text-center">
          <div className="font-headline text-lg font-bold tabular-nums tracking-tight">
            <span className={match.homeTeam.score > match.awayTeam.score ? 'text-foreground' : 'text-muted-foreground'}>
              {match.homeTeam.score}
            </span>
            <span className="px-1.5 text-muted-foreground/70" aria-hidden="true">
              –
            </span>
            <span className={match.awayTeam.score > match.homeTeam.score ? 'text-foreground' : 'text-muted-foreground'}>
              {match.awayTeam.score}
            </span>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2.5 font-medium">
          {away && (
            <Image
              src={away.imageUrl}
              alt={match.awayTeam.name}
              width={24}
              height={24}
              className="h-6 w-6 shrink-0 object-contain"
              data-ai-hint={away.imageHint}
            />
          )}
          <span className={cn('truncate', small ? 'text-sm' : 'text-sm sm:text-[15px]')}>
            {match.awayTeam.name}
          </span>
        </div>
      </div>
    </article>
  );
}