import Link from 'next/link';
import { ArrowLeft, CalendarDays, Flag, MapPin, ShieldHalf } from 'lucide-react';
import { YourTeamBadge } from '@/components/football/your-team-badge';
import { LiveRefreshButton } from './live-refresh-button';
import { cn } from '@/lib/utils';
import type { MatchDetail } from '@/lib/football-data/types';

const badgeStyles: Record<MatchDetail['badge'], string> = {
  LIVE: 'bg-destructive/15 text-destructive',
  FT: 'bg-secondary text-muted-foreground',
  UPCOMING: 'border border-border bg-card text-muted-foreground',
  POSTPONED: 'bg-warning/15 text-warning',
  SUSPENDED: 'bg-warning/15 text-warning',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

function humanizeStage(stage: string): string {
  return stage
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatKickoff(utcDate: string): { date: string; time: string } {
  const date = new Date(utcDate);
  if (Number.isNaN(date.getTime())) return { date: 'Date to be confirmed', time: '' };
  return {
    date: new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date),
    time: new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    }).format(date),
  };
}

function TeamCrest({ crest, alt, size = 64 }: { crest: string | null; alt: string; size?: number }) {
  if (!crest) {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full border border-border bg-secondary text-muted-foreground"
        style={{ width: size, height: size }}
        role="img"
        aria-label={alt}
      >
        <ShieldHalf className="h-1/2 w-1/2" aria-hidden="true" />
      </span>
    );
  }
  // Provider crests are tiny fixed-size SVGs — served directly so the page
  // does not wait on the image optimizer for above-the-fold content.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={crest}
      alt={alt}
      width={size}
      height={size}
      decoding="async"
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

function GoalMinute({ minute, injuryTime }: { minute: number | null; injuryTime: number | null }) {
  if (minute === null) return null;
  return (
    <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums text-muted-foreground">
      {minute}&prime;{typeof injuryTime === 'number' && injuryTime > 0 ? `+${injuryTime}` : ''}
    </span>
  );
}

export function MatchDetailView({ match }: { match: MatchDetail }) {
  const kickoff = formatKickoff(match.kickoff);
  const showScore = match.score.home !== null && match.score.away !== null;
  const showHalfTime = match.score.halfHome !== null && match.score.halfAway !== null;
  const roundLabel = match.matchday
    ? `Matchday ${match.matchday}`
    : match.stage && match.stage !== 'REGULAR_SEASON'
      ? humanizeStage(match.stage)
      : null;

  return (
    <div className="page-shell min-w-0 py-10 sm:py-14">
      <nav aria-label="Breadcrumb">
        <Link
          href="/results"
          aria-label="Back to results"
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-primary transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All results
        </Link>
      </nav>

      <header className="mt-6 min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="chip max-w-full">
            <span className="truncate">
              {match.competition}
              {match.season !== 'Unavailable' && match.season !== 'Current'
                ? ` · ${match.season}`
                : ''}
            </span>
          </span>
          {roundLabel && (
            <span className="chip max-w-full">
              <span className="truncate">{roundLabel}</span>
            </span>
          )}
          {match.isLive && <LiveRefreshButton />}
        </div>
        <h1 className="text-page-title mt-4 max-w-full text-balance">
          {match.homeTeam.name} vs {match.awayTeam.name}
        </h1>
        <p className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
            <time dateTime={match.kickoff}>
              {kickoff.date}
              {kickoff.time ? ` · ${kickoff.time}` : ''}
            </time>
          </span>
        </p>
      </header>

      <section
        aria-labelledby="match-score-heading"
        className="card-surface mt-6 overflow-hidden p-5 sm:p-8"
      >
        <h2 id="match-score-heading" className="sr-only">
          Score
        </h2>
        <div className="flex justify-center">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold tracking-[0.1em]',
              badgeStyles[match.badge]
            )}
            role={match.isLive ? 'status' : undefined}
            aria-live={match.isLive ? 'polite' : undefined}
          >
            {match.isLive && (
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
              </span>
            )}
            {match.isLive ? 'LIVE' : match.statusLabel.toUpperCase()}
          </span>
        </div>
        {match.isLive && match.status === 'PAUSED' && (
          <p className="mt-2 text-center text-xs text-muted-foreground" role="status">
            Half time — the live score below is the latest from the provider.
          </p>
        )}

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-6">
          <div className="flex min-w-0 flex-col items-center gap-3 text-center">
            <TeamCrest crest={match.homeTeam.crest} alt={`${match.homeTeam.name} crest`} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold sm:text-base" title={match.homeTeam.name}>
                {match.homeTeam.name}
              </p>
              <div className="mt-1.5 flex justify-center">
                <YourTeamBadge teamId={match.homeTeam.id} />
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col items-center px-1 pt-2 text-center sm:pt-4">
            {showScore ? (
              <p
                className="font-headline text-4xl font-bold tabular-nums tracking-tight sm:text-5xl"
                aria-label={`Score: ${match.homeTeam.name} ${match.score.home}, ${match.awayTeam.name} ${match.score.away}`}
              >
                <span>{match.score.home}</span>
                <span className="px-2 text-muted-foreground/70 sm:px-3" aria-hidden="true">
                  –
                </span>
                <span>{match.score.away}</span>
              </p>
            ) : (
              <p className="font-headline text-xl font-bold uppercase tracking-[0.2em] text-muted-foreground">
                vs
              </p>
            )}
            {showHalfTime && showScore && (
              <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                Half time: {match.score.halfHome}–{match.score.halfAway}
              </p>
            )}
          </div>

          <div className="flex min-w-0 flex-col items-center gap-3 text-center">
            <TeamCrest crest={match.awayTeam.crest} alt={`${match.awayTeam.name} crest`} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold sm:text-base" title={match.awayTeam.name}>
                {match.awayTeam.name}
              </p>
              <div className="mt-1.5 flex justify-center">
                <YourTeamBadge teamId={match.awayTeam.id} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="match-info-heading" className="card-surface min-w-0 p-5 sm:p-6">
          <h2 id="match-info-heading" className="text-section-title">
            Match information
          </h2>
          <dl className="mt-4 divide-y divide-border/60">
            <div className="grid grid-cols-[7rem_1fr] gap-3 py-2.5 text-sm sm:grid-cols-[9rem_1fr]">
              <dt className="text-muted-foreground">Competition</dt>
              <dd className="min-w-0 break-words font-medium">{match.competition}</dd>
            </div>
            <div className="grid grid-cols-[7rem_1fr] gap-3 py-2.5 text-sm sm:grid-cols-[9rem_1fr]">
              <dt className="text-muted-foreground">Kickoff (UTC)</dt>
              <dd className="min-w-0 font-medium">
                <time dateTime={match.kickoff} className="break-words">
                  {kickoff.date}
                  {kickoff.time ? ` · ${kickoff.time}` : ''}
                </time>
              </dd>
            </div>
            {match.matchday !== null && (
              <div className="grid grid-cols-[7rem_1fr] gap-3 py-2.5 text-sm sm:grid-cols-[9rem_1fr]">
                <dt className="text-muted-foreground">Matchday</dt>
                <dd className="font-medium tabular-nums">{match.matchday}</dd>
              </div>
            )}
            {match.stage && (
              <div className="grid grid-cols-[7rem_1fr] gap-3 py-2.5 text-sm sm:grid-cols-[9rem_1fr]">
                <dt className="text-muted-foreground">Stage</dt>
                <dd className="min-w-0 break-words font-medium">
                  {humanizeStage(match.stage)}
                </dd>
              </div>
            )}
            {match.group && (
              <div className="grid grid-cols-[7rem_1fr] gap-3 py-2.5 text-sm sm:grid-cols-[9rem_1fr]">
                <dt className="text-muted-foreground">Group</dt>
                <dd className="min-w-0 break-words font-medium">{match.group}</dd>
              </div>
            )}
            {match.venue && (
              <div className="grid grid-cols-[7rem_1fr] gap-3 py-2.5 text-sm sm:grid-cols-[9rem_1fr]">
                <dt className="text-muted-foreground">Venue</dt>
                <dd className="flex min-w-0 items-start gap-1.5 font-medium">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 break-words">{match.venue}</span>
                </dd>
              </div>
            )}
            <div className="grid grid-cols-[7rem_1fr] gap-3 py-2.5 text-sm sm:grid-cols-[9rem_1fr]">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium">{match.statusLabel}</dd>
            </div>
            <div className="grid grid-cols-[7rem_1fr] gap-3 py-2.5 text-sm sm:grid-cols-[9rem_1fr]">
              <dt className="text-muted-foreground">Updated</dt>
              <dd className="min-w-0 font-medium">
                <time dateTime={match.lastUpdated} className="break-words">
                  {new Date(match.lastUpdated).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC
                </time>
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Live data from football-data.org. Scores and match events are shown exactly as the
            provider reports them.
          </p>
        </section>

        <div className="grid min-w-0 content-start gap-6">
          {match.goals.length > 0 && (
            <section aria-labelledby="match-goals-heading" className="card-surface min-w-0 p-5 sm:p-6">
              <h2 id="match-goals-heading" className="text-section-title">
                Goals
              </h2>
              <ul className="mt-4 space-y-2.5">
                {match.goals.map((goal, index) => (
                  <li
                    key={`${goal.minute}-${goal.scorer ?? 'unknown'}-${index}`}
                    className="flex min-w-0 items-start gap-2.5 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
                  >
                    <GoalMinute minute={goal.minute} injuryTime={goal.injuryTime} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {goal.scorer ?? 'Unknown scorer'}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[goal.teamName, goal.assist ? `assist ${goal.assist}` : null, goal.type]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {match.referees.length > 0 && (
            <section
              aria-labelledby="match-officials-heading"
              className="card-surface min-w-0 p-5 sm:p-6"
            >
              <h2 id="match-officials-heading" className="text-section-title">
                Officials
              </h2>
              <ul className="mt-4 space-y-2.5">
                {match.referees.map((referee, index) => (
                  <li key={`${referee.name}-${index}`} className="flex min-w-0 items-start gap-2.5 text-sm">
                    <Flag className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{referee.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[referee.role, referee.nationality].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <footer className="mt-8">
        <Link
          href="/results"
          aria-label="Back to results"
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-primary transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to results
        </Link>
      </footer>
    </div>
  );
}
