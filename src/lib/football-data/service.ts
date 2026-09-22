import 'server-only';
import { cachedWithTtl } from './cache';
import {
  FootballDataProviderError,
  fetchFinishedMatches,
  fetchStandings,
} from './provider';
import type {
  FootballDataMeta,
  FootballDataSeason,
  ResultsPayload,
  StandingsPayload,
} from './types';
import { leagueStandings, matchResults } from '@/lib/data';
import type { MatchResult, Standing } from '@/lib/types';

const RESULTS_CACHE_TTL_MS = 2 * 60 * 1000;
const STANDINGS_CACHE_TTL_MS = 10 * 60 * 1000;

const COMPETITION_CODE = 'PL';

const RESULTS_CACHE_KEY = 'football-data:pl:matches';
const STANDINGS_CACHE_KEY = 'football-data:pl:standings';

export function footballDataConfigured(): boolean {
  return Boolean(process.env.FOOTBALL_DATA_API_KEY);
}

function logFallback(error: unknown, scope: string): void {
  if (error instanceof FootballDataProviderError) {
    const label = error.kind === 'http' ? `HTTP ${error.status}` : error.kind.toUpperCase();
    console.error(
      `[football-data] ${scope} failed (${label}): ${error.message}. Falling back to demo data.`
    );
    return;
  }
  console.error(
    `[football-data] ${scope} failed (NETWORK): ${(error as Error).message}. Falling back to demo data.`
  );
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function seasonLabel(season: FootballDataSeason | null | undefined): string {
  if (!season?.startDate) return 'Current';
  const start = Number.parseInt(season.startDate.slice(0, 4), 10);
  const end = Number.parseInt(season.endDate.slice(0, 4), 10);
  if (Number.isNaN(start)) return 'Current';
  return `${start}/${String(end).slice(-2)}`;
}

function mapMatchStatus(status: string): MatchResult['status'] {
  switch (status) {
    case 'IN_PLAY':
    case 'PAUSED':
      return 'LIVE';
    case 'FINISHED':
    case 'AWARDED':
    default:
      return 'FT';
  }
}

function mapTeam(team: { name: string; shortName?: string | null; crest?: string | null }) {
  return {
    name: team.shortName ?? team.name,
    crest: team.crest ?? undefined,
  };
}

function parseForm(form?: string | null): Standing['form'] {
  if (!form) return [];
  return form
    .split(',')
    .map((result) => result.trim().toUpperCase())
    .filter((result): result is 'W' | 'D' | 'L' => result === 'W' || result === 'D' || result === 'L');
}

export async function getResults(): Promise<ResultsPayload> {
  if (!footballDataConfigured()) {
    return demoResultsPayload();
  }

  try {
    return await cachedWithTtl(RESULTS_CACHE_KEY, RESULTS_CACHE_TTL_MS, async () => {
      const response = await fetchFinishedMatches(COMPETITION_CODE);

      const matches: MatchResult[] = [...response.matches]
        .sort((a, b) => Date.parse(b.utcDate) - Date.parse(a.utcDate))
        .map((match) => ({
          id: `fd-${match.id}`,
          league: match.competition.name,
          homeTeam: {
            ...mapTeam(match.homeTeam),
            score: match.score?.fullTime.home ?? 0,
          },
          awayTeam: {
            ...mapTeam(match.awayTeam),
            score: match.score?.fullTime.away ?? 0,
          },
          matchDate: toDateKey(new Date(match.utcDate)),
          status: mapMatchStatus(match.status),
        }))
        .filter((match) => match.status === 'FT');

      const referenceSeason = response.matches[0]?.season;

      const meta: FootballDataMeta = {
        source: 'live',
        provider: 'football-data.org',
        competition: response.competition.name,
        code: response.competition.code,
        season: seasonLabel(referenceSeason),
        matchday: referenceSeason?.currentMatchday ?? null,
        lastUpdated: new Date().toISOString(),
      };

      return { matches, meta };
    });
  } catch (error) {
    logFallback(error, 'results');
    return demoResultsPayload();
  }
}

export async function getStandings(): Promise<StandingsPayload> {
  if (!footballDataConfigured()) {
    return demoStandingsPayload();
  }

  try {
    return await cachedWithTtl(STANDINGS_CACHE_KEY, STANDINGS_CACHE_TTL_MS, async () => {
      const response = await fetchStandings(COMPETITION_CODE);

      const table = response.standings.find((entry) => entry.type === 'TOTAL');

      const standings: Standing[] = (table?.table ?? []).map((row) => ({
        rank: row.position,
        team: mapTeam(row.team),
        played: row.playedGames,
        win: row.won,
        draw: row.draw,
        loss: row.lost,
        gd: row.goalDifference,
        points: row.points,
        form: parseForm(row.form),
      }));

      const meta: FootballDataMeta = {
        source: 'live',
        provider: 'football-data.org',
        competition: response.competition.name,
        code: response.competition.code,
        season: seasonLabel(response.season),
        matchday: response.season.currentMatchday ?? null,
        lastUpdated: new Date().toISOString(),
      };

      return { standings, meta };
    });
  } catch (error) {
    logFallback(error, 'standings');
    return demoStandingsPayload();
  }
}

function demoResultsPayload(): ResultsPayload {
  return {
    matches: [...matchResults],
    meta: demoMeta(),
  };
}

function demoStandingsPayload(): StandingsPayload {
  return {
    standings: [...leagueStandings],
    meta: demoMeta(),
  };
}

function demoMeta(): FootballDataMeta {
  return {
    source: 'demo',
    provider: 'football-data.org',
    competition: 'Premier League',
    code: COMPETITION_CODE,
    season: '2023/24',
    matchday: null,
    lastUpdated: new Date().toISOString(),
  };
}