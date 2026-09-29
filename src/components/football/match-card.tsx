import Image from 'next/image';
import Link from 'next/link';
import type { MatchResult } from '@/lib/types';
import { toMatchDetailPath } from '@/lib/football-data/match-links';
import { cn, formatMatchDate, getImageById } from '@/lib/utils';

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

type TeamLogoInfo = { imageUrl: string; imageHint?: string };

function TeamLogo({
  crest,
  logo,
  alt,
  size = 24,
}: {
  crest?: string;
  logo?: TeamLogoInfo;
  alt: string;
  size?: number;
}) {
  const src = crest ?? logo?.imageUrl;

  if (!src) {
    return (
      <span
        className={cn(
          'grid shrink-0 place-items-center rounded-full border border-border bg-secondary font-bold text-muted-foreground',
          size === 24 ? 'h-6 w-6 text-[10px]' : 'h-5 w-5 text-[9px]'
        )}
        aria-label={alt}
      >
        {alt.trim().charAt(0).toUpperCase() || 'T'}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn('shrink-0 object-contain', size === 24 ? 'h-6 w-6' : 'h-5 w-5')}
      data-ai-hint={logo?.imageHint}
    />
  );
}

export function MatchCard({ match, small = false }: { match: MatchResult; small?: boolean }) {
  const home = getImageById(match.homeTeam.logoId);
  const away = getImageById(match.awayTeam.logoId);
  const showHomeLogo = Boolean(match.homeTeam.crest || home);
  const showAwayLogo = Boolean(match.awayTeam.crest || away);
  const detailHref = toMatchDetailPath(match.id);

  const body = (
    <>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
            {match.league}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">{formatMatchDate(match.matchDate)}</span>
          <MatchStatusBadge status={match.status} />
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center justify-end gap-2.5 text-right font-medium">
          <span className={cn('truncate', small ? 'text-sm' : 'text-sm sm:text-[15px]')}>
            {match.homeTeam.name}
          </span>
          {showHomeLogo && (
            <TeamLogo crest={match.homeTeam.crest} logo={home} alt={match.homeTeam.name} />
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
          {showAwayLogo && (
            <TeamLogo crest={match.awayTeam.crest} logo={away} alt={match.awayTeam.name} />
          )}
          <span className={cn('truncate', small ? 'text-sm' : 'text-sm sm:text-[15px]')}>
            {match.awayTeam.name}
          </span>
        </div>
      </div>
    </>
  );

  // Every card with a real provider id links to its live detail page. Cards
  // without a parseable id render as plain content so no broken link exists.
  if (!detailHref) {
    return (
      <article className="rounded-lg border border-border/80 bg-card/60 px-4 py-3 sm:px-4">
        {body}
      </article>
    );
  }

  return (
    <Link
      href={detailHref}
      aria-label={`View ${match.homeTeam.name} vs ${match.awayTeam.name} match details`}
      className="block rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <article className="rounded-lg border border-border/80 bg-card/60 px-4 py-3 transition hover:border-primary/40 sm:px-4">
        {body}
      </article>
    </Link>
  );
}