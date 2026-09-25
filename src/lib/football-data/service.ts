import 'server-only';
import { cachedWithTtl } from './cache';
import {
  FootballDataProviderError,
  fetchCompetitionTeams,
  fetchFinishedMatches,
  fetchStandings,
  fetchTeamMatches,
} from './provider';
import type {
  FootballDataMatch,
  FootballDataMatchStatus,
  FootballDataMeta,
  FootballDataSeason,
  FootballDataTeam,
  ResultsPayload,
  StandingsPayload,
} from './types';
import type { MatchResult, Standing } from '@/lib/types';

const RESULTS_CACHE_TTL_MS = 2 * 60 * 1000;
const STANDINGS_CACHE_TTL_MS = 10 * 60 * 1000;
const TEAMS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const COMPETITION_CODE = 'PL';

const RESULTS_CACHE_KEY = 'football-data:pl:matches';
const STANDINGS_CACHE_KEY = 'football-data:pl:standings';
const TEAMS_CACHE_KEY = 'football-data:pl:teams';

export function footballDataConfigured(): boolean {
  return Boolean(process.env.FOOTBALL_DATA_API_KEY);
}

function liveDataUnavailableMeta(scope: string, message: string): FootballDataMeta {
  return {
    source: 'unavailable',
    provider: 'football-data.org',
    competition: 'Premier League',
    code: COMPETITION_CODE,
    season: 'Unavailable',
    matchday: null,
    lastUpdated: new Date().toISOString(),
    error: `Live ${scope} unavailable: ${message}`,
  };
}

function unavailableResultsPayload(message: string): ResultsPayload {
  return {
    matches: [],
    meta: liveDataUnavailableMeta('results', message),
  };
}

function unavailableStandingsPayload(message: string): StandingsPayload {
  return {
    standings: [],
    meta: liveDataUnavailableMeta('standings', message),
  };
}

function logFailure(error: unknown, scope: string): void {
  if (error instanceof FootballDataProviderError) {
    const label = error.kind === 'http' ? `HTTP ${error.status}` : error.kind.toUpperCase();
    console.error(`[football-data] ${scope} failed (${label}): ${error.message}`);
    return;
  }
  console.error(`[football-data] ${scope} failed (NETWORK): ${(error as Error).message}`);
}

export function footballDataErrorMessage(error: unknown, scope: string): string {
  if (error instanceof FootballDataProviderError) {
    if (error.kind === 'timeout') {
      return `The live ${scope} request timed out. Please try again shortly.`;
    }
    if (error.kind === 'http') {
      return `The live ${scope} provider returned an error (${error.status}). Please try again shortly.`;
    }
    if (error.kind === 'config') {
      return 'The football data provider is not configured on the server.';
    }
    return `Could not reach the live ${scope} provider right now. Please try again shortly.`;
  }
  return `Could not reach the live ${scope} provider right now. Please try again shortly.`;
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
    return unavailableResultsPayload('FOOTBALL_DATA_API_KEY is not configured on the server.');
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
    logFailure(error, 'results');
    return unavailableResultsPayload(footballDataErrorMessage(error, 'results'));
  }
}

export async function getStandings(): Promise<StandingsPayload> {
  if (!footballDataConfigured()) {
    return unavailableStandingsPayload('FOOTBALL_DATA_API_KEY is not configured on the server.');
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
    logFailure(error, 'standings');
    return unavailableStandingsPayload(footballDataErrorMessage(error, 'standings'));
  }
}

export type CompetitionTeamsResult = {
  teams: FootballDataTeam[];
  error: string | null;
};

export async function getCompetitionTeams(): Promise<CompetitionTeamsResult> {
  if (!footballDataConfigured()) {
    return {
      teams: [],
      error: 'FOOTBALL_DATA_API_KEY is not configured on the server.',
    };
  }

  try {
    const teams = await cachedWithTtl(TEAMS_CACHE_KEY, TEAMS_CACHE_TTL_MS, async () => {
      const response = await fetchCompetitionTeams(COMPETITION_CODE);
      return [...response.teams].sort((a, b) => a.name.localeCompare(b.name));
    });
    return { teams, error: null };
  } catch (error) {
    logFailure(error, 'teams');
    return {
      teams: [],
      error: 'Unable to load the club list right now. Please try again later.',
    };
  }
}

export type TeamMatchDto = {
  id: number;
  competition: string;
  competitionCode: string;
  status: FootballDataMatchStatus;
  utcDate: string;
  matchday: number | null;
  homeTeam: { id: number; name: string; crest: string | null; score: number | null };
  awayTeam: { id: number; name: string; crest: string | null; score: number | null };
};

export type TeamMatchesResult = {
  upcoming: TeamMatchDto | null;
  previous: TeamMatchDto | null;
  live: TeamMatchDto | null;
  error: string | null;
  stale: boolean;
};

const TEAM_MATCHES_TTL_MS = 10 * 60 * 1000;
const TEAM_MATCHES_LIVE_TTL_MS = 3 * 60 * 1000;

type TeamMatchesCacheEntry = { value: TeamMatchesResult; storedAt: number; ttlMs: number };
const teamMatchesCache = new Map<string, TeamMatchesCacheEntry>();
const teamMatchesInFlight = new Map<string, Promise<TeamMatchesResult>>();

function isLiveMatchStatus(status: FootballDataMatchStatus): boolean {
  return status === 'IN_PLAY' || status === 'PAUSED';
}

function toTeamMatchDto(match: FootballDataMatch): TeamMatchDto {
  return {
    id: match.id,
    competition: match.competition.name,
    competitionCode: match.competition.code,
    status: match.status,
    utcDate: match.utcDate,
    matchday: match.matchday ?? null,
    homeTeam: {
      id: match.homeTeam.id,
      name: match.homeTeam.shortName ?? match.homeTeam.name,
      crest: match.homeTeam.crest ?? null,
      score: match.score?.fullTime?.home ?? match.score?.halfTime?.home ?? null,
    },
    awayTeam: {
      id: match.awayTeam.id,
      name: match.awayTeam.shortName ?? match.awayTeam.name,
      crest: match.awayTeam.crest ?? null,
      score: match.score?.fullTime?.away ?? match.score?.halfTime?.away ?? null,
    },
  };
}

async function loadTeamMatchesFromApi(teamId: number): Promise<TeamMatchesResult> {
  const key = `team-matches:${teamId}`;
  const now = Date.now();
  const existing = teamMatchesCache.get(key);

  try {
    const [upcomingResult, finishedResult] = await Promise.all([
      fetchTeamMatches(teamId, { status: 'SCHEDULED,TIMED,IN_PLAY,PAUSED' }),
      fetchTeamMatches(teamId, { status: 'FINISHED', limit: '1' }),
    ]);

    const upcomingMatches = [...upcomingResult.matches].sort(
      (a, b) => Date.parse(a.utcDate) - Date.parse(b.utcDate)
    );

    const live = upcomingMatches.find((match) => isLiveMatchStatus(match.status)) ?? null;

    const nextMatch = upcomingMatches.find(
      (match) => !isLiveMatchStatus(match.status) && Date.parse(match.utcDate) > Date.now()
    );

    const lastMatch = [...finishedResult.matches].sort(
      (a, b) => Date.parse(b.utcDate) - Date.parse(a.utcDate)
    )[0];

    const value: TeamMatchesResult = {
      upcoming: nextMatch ? toTeamMatchDto(nextMatch) : null,
      previous: lastMatch ? toTeamMatchDto(lastMatch) : null,
      live: live ? toTeamMatchDto(live) : null,
      error: null,
      stale: false,
    };

    teamMatchesCache.set(key, {
      value,
      storedAt: now,
      ttlMs: live ? TEAM_MATCHES_LIVE_TTL_MS : TEAM_MATCHES_TTL_MS,
    });

    return value;
  } catch (error) {
    logFailure(error, `team ${teamId} matches`);
    if (existing) {
      return {
        ...existing.value,
        error: 'Live updates paused — showing last known match data.',
        stale: true,
      };
    }
    return {
      upcoming: null,
      previous: null,
      live: null,
      error: 'Unable to load this team’s matches right now. Please try again later.',
      stale: false,
    };
  }
}

export async function getTeamMatches(teamId: number): Promise<TeamMatchesResult> {
  const key = `team-matches:${teamId}`;
  const now = Date.now();
  const existing = teamMatchesCache.get(key);

  if (existing && now - existing.storedAt < existing.ttlMs) {
    return existing.value;
  }

  if (!footballDataConfigured()) {
    return {
      upcoming: null,
      previous: null,
      live: null,
      error: 'FOOTBALL_DATA_API_KEY is not configured on the server.',
      stale: false,
    };
  }

  const inFlight = teamMatchesInFlight.get(key);
  if (inFlight) {
    return inFlight;
  }

  const pending = loadTeamMatchesFromApi(teamId);
  teamMatchesInFlight.set(key, pending);
  try {
    return await pending;
  } finally {
    teamMatchesInFlight.delete(key);
  }
}
