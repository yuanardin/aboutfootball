import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarX2, CloudOff } from 'lucide-react';
import { getMatchDetail, parseMatchRouteId } from '@/lib/football-data/service';
import { MatchDetailView } from './match-detail-view';

// Always rendered on demand: single-match reads are cached in-memory for 60
// seconds, so a LIVE page stays fresh without static staleness and without
// hammering the free-tier quota.
export const dynamic = 'force-dynamic';

type MatchPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: MatchPageProps): Promise<Metadata> {
  const id = parseMatchRouteId((await params).id);
  if (id === null) {
    return { title: 'Match not found · ScoreCast' };
  }
  const result = await getMatchDetail(id);
  if (!result.match) {
    return { title: 'Match centre · ScoreCast' };
  }
  const { homeTeam, awayTeam, competition } = result.match;
  return {
    title: `${homeTeam.shortName} vs ${awayTeam.shortName} · Match centre`,
    description: `Live ${competition} match details for ${homeTeam.name} vs ${awayTeam.name} from football-data.org.`,
  };
}

function MatchNotFound() {
  return (
    <div className="page-shell min-w-0 py-10 sm:py-14">
      <nav aria-label="Breadcrumb">
        <Link
          href="/results"
          aria-label="Back to results"
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-primary transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Back to results
        </Link>
      </nav>
      <div className="card-surface mx-auto mt-8 max-w-lg px-6 py-12 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-secondary text-muted-foreground">
          <CalendarX2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="text-section-title mt-4">Match not found</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This match could not be found. It may have an invalid ID or the provider may no longer
          list it.
        </p>
        <Link
          href="/results"
          className="mt-6 inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Back to results
        </Link>
      </div>
    </div>
  );
}

function MatchUnavailable({ matchId }: { matchId: number }) {
  return (
    <div className="page-shell min-w-0 py-10 sm:py-14">
      <nav aria-label="Breadcrumb">
        <Link
          href="/results"
          aria-label="Back to results"
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-primary transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Back to results
        </Link>
      </nav>
      <div
        role="alert"
        className="card-surface mx-auto mt-8 max-w-lg border-destructive/30 px-6 py-12 text-center"
      >
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-destructive/10 text-destructive">
          <CloudOff className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="text-section-title mt-4">Live match data unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The live provider could not be reached right now. No scores are shown to avoid
          inaccuracies.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link
            href={`/matches/${matchId}`}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Try again
          </Link>
          <Link
            href="/results"
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border px-5 text-sm font-semibold transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to results
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function MatchDetailPage({ params }: MatchPageProps) {
  const rawId = (await params).id;
  const matchId = parseMatchRouteId(rawId);

  if (matchId === null) {
    return <MatchNotFound />;
  }

  const result = await getMatchDetail(matchId);

  if (result.notFound || !result.match) {
    if (!result.notFound) {
      return <MatchUnavailable matchId={matchId} />;
    }
    return <MatchNotFound />;
  }

  return <MatchDetailView match={result.match} />;
}
