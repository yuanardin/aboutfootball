import 'server-only';
import { cachedWithTtl } from './cache';
import {
  FootballDataProviderError,
  fetchCompetitionTeams,
  fetchFinishedMatches,
  fetchMatchDetail,
  fetchStandings,
  fetchTeamMatches,
} from './provider';
import type {
  FootballDataMatch,
  FootballDataMatchDetailResponse,
  FootballDataMatchStatus,
  FootballDataMeta,
  FootballDataSeason,
  FootballDataTeam,
  MatchDetail,
  MatchDetailResult,
  ResultsOverview,
  ResultsPayload,
  StandingsOverview,
  StandingsPayload,
  CompetitionResultsResult,
  CompetitionStandingsResult,
} from './types';
import { describeMatchStatus } from './match-links';
export { matchDetailPath, parseMatchRouteId, toMatchDetailPath } from './match-links';
import { mapWithConcurrency } from '../async-pool';
import type { MatchResult, Standing, StandingGroup } from '@/lib/types';
import {
  COMPETITIONS,
  DEFAULT_COMPETITION,
  competitionTitle,
  type CompetitionCode,
} from './competitions';

const RESULTS_CACHE_TTL_MS = 5 * 60 * 1000;
const STANDINGS_CACHE_TTL_MS = 10 * 60 * 1000;
const TEAMS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const NOT_CONFIGURED_MESSAGE = 'The football data provider is not configured on the server.';
const RATE_LIMIT_MESSAGE = 'The live football data provider rate limit was reached. Please try again shortly.';

// Cache keys are per competition so switching leagues never serves another league's table.
const resultsCacheKey = (code: CompetitionCode) => `football-data:${code}:matches`;
const standingsCacheKey = (code: CompetitionCode) => `football-data:${code}:standings`;
const teamsCacheKey = (code: CompetitionCode) => `football-data:${code}:teams`;

// football-data.org's free tier allows roughly ten requests per minute, so a burst of
// multi-competition requests is expected to hit 429. Two guards keep that honest and cheap:
// a cooldown gate that stops burning quota while the provider is throttling us, and a
// last-known-good copy so a throttled request can still show real (older) API data instead
// of an empty page. Invented data is never substituted.
const RATE_LIMIT_COOLDOWN_MS = 60_000;
const rateLimitGate = new Map<string, number>();
const lastGood = new Map<string, { value: unknown; storedAt: number }>();

type WithMeta = { meta: FootballDataMeta };

function rememberSuccess<T>(key: string, value: T): T {
  lastGood.set(key, { value, storedAt: Date.now() });
  return value;
}

function markStale<T extends WithMeta>(value: T, message: string): T {
  return { ...value, meta: { ...value.meta, stale: true, error: message } };
}

function staleOrUnavailable<T extends WithMeta>(
  key: string,
  message: string,
  build: (competition: CompetitionCode, message: string) => T,
  competition: CompetitionCode
): T {
  const previous = lastGood.get(key);
  if (previous) {
    return markStale(previous.value as T, message);
  }
  return build(competition, message);
}

export function footballDataConfigured(): boolean {
  return Boolean(process.env.FOOTBALL_DATA_API_KEY);
}

function unavailableMeta(message: string, code: CompetitionCode): FootballDataMeta {
  return {
    source: 'unavailable',
    provider: 'football-data.org',
    competition: competitionTitle(code),
    code,
    season: 'Unavailable',
    matchday: null,
    stage: null,
    group: null,
    lastUpdated: new Date().toISOString(),
    error: message,
  };
}

function unavailableResultsPayload(message: string, code: CompetitionCode): ResultsPayload {
  return { matches: [], meta: unavailableMeta(message, code) };
}

function unavailableStandingsPayload(message: string, code: CompetitionCode): StandingsPayload {
  return { standings: [], groups: [], meta: unavailableMeta(message, code) };
}

function logFailure(error: unknown, scope: string): void {
  if (error instanceof FootballDataProviderError) {
    const label =
      error.kind === 'http'
        ? `HTTP ${error.status}`
        : error.kind === 'rate-limit'
          ? 'RATE LIMIT'
          : error.kind.toUpperCase();
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
    if (error.kind === 'rate-limit') {
      return `The live ${scope} provider rate limit was reached. Please try again shortly.`;
    }
    if (error.kind === 'http') {
      if (error.status === 401 || error.status === 403) {
        return 'The football data provider rejected the configured API key. Please try again later.';
      }
      if (error.status === 429) {
        return 'The live football data provider rate limit was reached. Please try again shortly.';
      }
      return `The live ${scope} provider returned an error (${error.status}). Please try again shortly.`;
    }
    if (error.kind === 'config') {
      return NOT_CONFIGURED_MESSAGE;
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


function mapTeam(team: { id?: number; name: string; shortName?: string | null; crest?: string | null }) {
  return {
    ...(typeof team.id === 'number' ? { id: team.id } : {}),
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

// Turns the provider's raw stage + group into a readable heading. Domestic leagues report
// stage REGULAR_SEASON with a "Matchday" group, which is noise, so it is left unnamed.
// Anything else (cup stages, knockout rounds, named groups) is surfaced as the API gave it.
function groupLabel(stage: string, group: string | null, type: string): string {
  const namedGroup = group && group.toLowerCase() !== 'matchday' ? group : null;
  if (namedGroup) return namedGroup;

  const namedStage = stage && stage !== 'REGULAR_SEASON' ? stage : null;
  if (namedStage) return namedStage;

  if (type === 'HOME') return 'Home table';
  if (type === 'AWAY') return 'Away table';
  return 'League table';
}

function buildGroups(
  blocks: Array<{
    stage: string;
    type: 'TOTAL' | 'HOME' | 'AWAY';
    group: string | null;
    table: Array<{
      position: number;
      team: { id?: number; name: string; shortName?: string | null; crest?: string | null };
      playedGames: number;
      form?: string | null;
      won: number;
      draw: number;
      lost: number;
      points: number;
      goalDifference: number;
    }>;
  }>
): StandingGroup[] {
  return blocks
    .filter((block) => block.table.length > 0)
    .map((block, index) => ({
      key: `${block.stage}-${block.group ?? 'none'}-${block.type}-${index}`,
      label: groupLabel(block.stage, block.group, block.type),
      stage: block.stage,
      type: block.type,
      group: block.group,
      standings: block.table
        .map<Standing>((row) => ({
          rank: row.position,
          team: mapTeam(row.team),
          played: row.playedGames,
          win: row.won,
          draw: row.draw,
          loss: row.lost,
          gd: row.goalDifference,
          points: row.points,
          form: parseForm(row.form),
        }))
        .sort((a, b) => a.rank - b.rank),
    }));
}

function mapMatch(match: FootballDataMatch): MatchResult {
  return {
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
    competitionCode: match.competition.code,
    competitionName: match.competition.name,
    matchday: match.matchday ?? null,
    stage: match.stage,
    group: match.group ?? null,
    kickoff: match.utcDate,
  };
}

// Wraps one live provider read with caching, a rate-limit cooldown and a last-known-good
// fallback. `scope` is only used for log/error wording so one implementation serves every
// competition without duplicating logic per league.
async function loadLive<T extends WithMeta>(options: {
  key: string;
  ttlMs: number;
  scope: string;
  competition: CompetitionCode;
  load: () => Promise<{ meta: FootballDataMeta } & T>;
  build: (competition: CompetitionCode, message: string) => T;
}): Promise<T> {
  const { key, ttlMs, scope, competition, load, build } = options;

  if (!footballDataConfigured()) {
    return build(competition, NOT_CONFIGURED_MESSAGE);
  }

  const resumeAt = rateLimitGate.get(key) ?? 0;
  if (Date.now() < resumeAt) {
    return staleOrUnavailable(key, RATE_LIMIT_MESSAGE, build, competition);
  }

  try {
    const value = (await cachedWithTtl(key, ttlMs, load)) as T;
    rateLimitGate.delete(key);
    if (value.meta.source === 'live') {
      return rememberSuccess(key, value);
    }
    return value;
  } catch (error) {
    logFailure(error, scope);
    if (error instanceof FootballDataProviderError && error.kind === 'rate-limit') {
      rateLimitGate.set(key, Date.now() + RATE_LIMIT_COOLDOWN_MS);
      return staleOrUnavailable(key, RATE_LIMIT_MESSAGE, build, competition);
    }
    return staleOrUnavailable(
      key,
      footballDataErrorMessage(error, scope),
      build,
      competition
    );
  }
}

export async function getResults(
  competitionCode: CompetitionCode = DEFAULT_COMPETITION
): Promise<ResultsPayload> {
  return loadLive<ResultsPayload>({
    key: resultsCacheKey(competitionCode),
    ttlMs: RESULTS_CACHE_TTL_MS,
    scope: 'results',
    competition: competitionCode,
    load: async () => {
      const response = await fetchFinishedMatches(competitionCode);

      const matches = [...response.matches]
        .sort((a, b) => Date.parse(b.utcDate) - Date.parse(a.utcDate))
        .map(mapMatch)
        .filter((match) => match.status === 'FT');

      const referenceSeason = response.matches[0]?.season;

      const meta: FootballDataMeta = {
        source: 'live',
        provider: 'football-data.org',
        competition: response.competition.name,
        code: response.competition.code,
        season: seasonLabel(referenceSeason),
        matchday: referenceSeason?.currentMatchday ?? null,
        stage: response.matches[0]?.stage ?? null,
        group: response.matches[0]?.group ?? null,
        lastUpdated: new Date().toISOString(),
      };

      return { matches, meta };
    },
    build: (competition, message) => unavailableResultsPayload(message, competition),
  });
}

export async function getStandings(
  competitionCode: CompetitionCode = DEFAULT_COMPETITION
): Promise<StandingsPayload> {
  return loadLive<StandingsPayload>({
    key: standingsCacheKey(competitionCode),
    ttlMs: STANDINGS_CACHE_TTL_MS,
    scope: 'standings',
    competition: competitionCode,
    load: async () => {
      const response = await fetchStandings(competitionCode);

      // Prefer the overall table. Cup competitions can answer with several blocks, and
      // each one is preserved with its own stage/group label instead of being merged.
      const totalBlocks = response.standings.filter((entry) => entry.type === 'TOTAL');
      const blocks = totalBlocks.length ? totalBlocks : response.standings;
      const groups = buildGroups(blocks);

      const meta: FootballDataMeta = {
        source: 'live',
        provider: 'football-data.org',
        competition: response.competition.name,
        code: response.competition.code,
        season: seasonLabel(response.season),
        matchday: response.season.currentMatchday ?? null,
        stage: blocks[0]?.stage ?? null,
        group: blocks[0]?.group ?? null,
        lastUpdated: new Date().toISOString(),
      };

      return { standings: groups[0]?.standings ?? [], groups, meta };
    },
    build: (competition, message) => unavailableStandingsPayload(message, competition),
  });
}

// Bulk reads (the "All" overviews) go through a small pool instead of firing
// every competition at once. Cached competitions still resolve instantly via
// the per-key TTL cache inside loadLive — only genuinely missing competitions
// reach the network, at most BULK_COMPETITION_CONCURRENCY at a time. Single-
// competition pages bypass the pool entirely and stay as fast as before.
const BULK_COMPETITION_CONCURRENCY = 2;

// Loads every registered competition. Each competition is cached independently, so a
// failure in one league never affects the others and no placeholder data is substituted.
export async function getAllStandings(): Promise<StandingsOverview> {
  const entries = await mapWithConcurrency(
    COMPETITIONS,
    BULK_COMPETITION_CONCURRENCY,
    async (competition): Promise<CompetitionStandingsResult> => ({
      code: competition.code,
      label: competition.label,
      payload: await getStandings(competition.code),
    })
  );

  const live = entries.filter((entry) => entry.payload.meta.source === 'live');
  const failed = entries
    .filter((entry) => entry.payload.meta.source !== 'live')
    .map((entry) => entry.code);
  const stale = entries
    .filter((entry) => entry.payload.meta.source === 'live' && entry.payload.meta.stale)
    .map((entry) => entry.code);

  const groups = live.flatMap((entry) => entry.payload.groups);
  const lastUpdated = entries
    .map((entry) => entry.payload.meta.lastUpdated)
    .sort()
    .at(-1);

  const meta: FootballDataMeta = {
    source: live.length ? 'live' : 'unavailable',
    provider: 'football-data.org',
    competition: 'All competitions',
    code: 'ALL',
    season: live[0]?.payload.meta.season ?? 'Unavailable',
    matchday: live[0]?.payload.meta.matchday ?? null,
    stage: null,
    group: null,
    lastUpdated: lastUpdated ?? new Date().toISOString(),
    error: live.length
      ? null
      : entries[0]?.payload.meta.error ?? 'No live standings could be loaded right now.',
  };

  return { groups, entries, meta, failed, stale };
}

export async function getAllResults(): Promise<ResultsOverview> {
  const entries = await mapWithConcurrency(
    COMPETITIONS,
    BULK_COMPETITION_CONCURRENCY,
    async (competition): Promise<CompetitionResultsResult> => ({
      code: competition.code,
      label: competition.label,
      payload: await getResults(competition.code),
    })
  );

  const live = entries.filter((entry) => entry.payload.meta.source === 'live');
  const failed = entries
    .filter((entry) => entry.payload.meta.source !== 'live')
    .map((entry) => entry.code);
  const stale = entries
    .filter((entry) => entry.payload.meta.source === 'live' && entry.payload.meta.stale)
    .map((entry) => entry.code);

  const matches = live
    .flatMap((entry) => entry.payload.matches)
    .sort((a, b) => {
      const byKickoff = Date.parse(b.kickoff ?? '') - Date.parse(a.kickoff ?? '');
      if (!Number.isNaN(byKickoff) && byKickoff !== 0) return byKickoff;
      return Date.parse(b.matchDate) - Date.parse(a.matchDate);
    });

  const lastUpdated = entries
    .map((entry) => entry.payload.meta.lastUpdated)
    .sort()
    .at(-1);

  const meta: FootballDataMeta = {
    source: live.length ? 'live' : 'unavailable',
    provider: 'football-data.org',
    competition: 'All competitions',
    code: 'ALL',
    season: live[0]?.payload.meta.season ?? 'Unavailable',
    matchday: live[0]?.payload.meta.matchday ?? null,
    stage: null,
    group: null,
    lastUpdated: lastUpdated ?? new Date().toISOString(),
    error: live.length
      ? null
      : entries[0]?.payload.meta.error ?? 'No live results could be loaded right now.',
  };

  return { matches, entries, meta, failed, stale };
}

export type CompetitionTeamsResult = {
  teams: FootballDataTeam[];
  error: string | null;
};

export async function getCompetitionTeams(
  competitionCode: CompetitionCode = DEFAULT_COMPETITION
): Promise<CompetitionTeamsResult> {
  if (!footballDataConfigured()) {
    return {
      teams: [],
      error: NOT_CONFIGURED_MESSAGE,
    };
  }

  const key = teamsCacheKey(competitionCode);

  if ((rateLimitGate.get(key) ?? 0) > Date.now()) {
    const previous = lastGood.get(key);
    if (previous) {
      return { teams: previous.value as FootballDataTeam[], error: null };
    }
    return { teams: [], error: RATE_LIMIT_MESSAGE };
  }

  try {
    const teams = await cachedWithTtl(key, TEAMS_CACHE_TTL_MS, async () => {
      const response = await fetchCompetitionTeams(competitionCode);
      return [...response.teams].sort((a, b) => a.name.localeCompare(b.name));
    });
    rateLimitGate.delete(key);
    return { teams, error: null };
  } catch (error) {
    logFailure(error, `teams ${competitionCode}`);
    if (error instanceof FootballDataProviderError && error.kind === 'rate-limit') {
      rateLimitGate.set(key, Date.now() + RATE_LIMIT_COOLDOWN_MS);
    }
    const previous = lastGood.get(key);
    if (previous) {
      return { teams: previous.value as FootballDataTeam[], error: null };
    }
    return {
      teams: [],
      error: 'Unable to load the club list right now. Please try again later.',
    };
  }
}

export type TeamMatchDto = {
  id: number;
  competition: string;
  competitionCode: CompetitionCode;
  status: FootballDataMatchStatus;
  utcDate: string;
  matchday: number | null;
  stage: string;
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
    competitionCode: match.competition.code as CompetitionCode,
    status: match.status,
    utcDate: match.utcDate,
    matchday: match.matchday ?? null,
    stage: match.stage,
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
        error: 'Live updates paused â€” showing last known match data.',
        stale: true,
      };
    }
    return {
      upcoming: null,
      previous: null,
      live: null,
      error: 'Unable to load this teamâ€™s matches right now. Please try again later.',
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
      error: NOT_CONFIGURED_MESSAGE,
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

const MATCH_DETAIL_TTL_MS = 60_000;

function detailTeamName(team: FootballDataTeam): string {
  return team.shortName ?? team.name;
}

function mapMatchDetailGoal(
  goal: NonNullable<FootballDataMatchDetailResponse['goals']>[number]
): MatchDetail['goals'][number] {
  return {
    minute: typeof goal.minute === 'number' ? goal.minute : null,
    injuryTime: typeof goal.injuryTime === 'number' ? goal.injuryTime : null,
    type: typeof goal.type === 'string' ? goal.type : null,
    teamId: typeof goal.team?.id === 'number' ? goal.team.id : null,
    teamName:
      typeof goal.team?.name === 'string' && goal.team.name ? goal.team.name : null,
    scorer:
      typeof goal.scorer?.name === 'string' && goal.scorer.name ? goal.scorer.name : null,
    assist:
      typeof goal.assist?.name === 'string' && goal.assist.name ? goal.assist.name : null,
  };
}

// Normalizes one GET /v4/matches/{id} response. Only fields the provider
// actually returned are kept â€” venue, goals and referees stay null/empty when
// the API omits them instead of being substituted.
function mapMatchDetail(response: FootballDataMatchDetailResponse): MatchDetail {
  const candidate =
    response && typeof response === 'object' && 'match' in response
      ? ((response as Record<string, unknown>).match as FootballDataMatchDetailResponse)
      : response;

  if (!candidate || typeof candidate !== 'object' || typeof candidate.id !== 'number') {
    throw new FootballDataProviderError(
      null,
      'network',
      'football-data.org returned an unexpected match shape'
    );
  }

  const described = describeMatchStatus(candidate.status);
  const venue =
    typeof candidate.venue === 'string' && candidate.venue.trim()
      ? candidate.venue.trim()
      : null;

  return {
    id: candidate.id,
    status: candidate.status,
    badge: described.badge,
    statusLabel: described.label,
    isLive: described.isLive,
    kickoff: candidate.utcDate,
    competition: candidate.competition?.name ?? 'Unknown competition',
    competitionCode:
      typeof candidate.competition?.code === 'string' ? candidate.competition.code : null,
    competitionEmblem:
      typeof candidate.competition?.emblem === 'string' ? candidate.competition.emblem : null,
    season: seasonLabel(candidate.season),
    matchday:
      typeof candidate.matchday === 'number' && Number.isInteger(candidate.matchday)
        ? candidate.matchday
        : null,
    stage: typeof candidate.stage === 'string' && candidate.stage ? candidate.stage : null,
    group: typeof candidate.group === 'string' && candidate.group ? candidate.group : null,
    lastUpdated:
      typeof candidate.lastUpdated === 'string' ? candidate.lastUpdated : new Date().toISOString(),
    venue,
    homeTeam: {
      id: typeof candidate.homeTeam?.id === 'number' ? candidate.homeTeam.id : null,
      name: candidate.homeTeam?.name ?? 'Home team',
      shortName: candidate.homeTeam ? detailTeamName(candidate.homeTeam) : 'Home',
      crest:
        typeof candidate.homeTeam?.crest === 'string' && candidate.homeTeam.crest
          ? candidate.homeTeam.crest
          : null,
    },
    awayTeam: {
      id: typeof candidate.awayTeam?.id === 'number' ? candidate.awayTeam.id : null,
      name: candidate.awayTeam?.name ?? 'Away team',
      shortName: candidate.awayTeam ? detailTeamName(candidate.awayTeam) : 'Away',
      crest:
        typeof candidate.awayTeam?.crest === 'string' && candidate.awayTeam.crest
          ? candidate.awayTeam.crest
          : null,
    },
    score: {
      home: candidate.score?.fullTime?.home ?? null,
      away: candidate.score?.fullTime?.away ?? null,
      halfHome: candidate.score?.halfTime?.home ?? null,
      halfAway: candidate.score?.halfTime?.away ?? null,
      winner: typeof candidate.score?.winner === 'string' ? candidate.score.winner : null,
    },
    goals: Array.isArray(candidate.goals)
      ? candidate.goals.slice(0, 60).map(mapMatchDetailGoal)
      : [],
    referees: Array.isArray(candidate.referees)
      ? candidate.referees
          .filter(
            (referee): referee is NonNullable<FootballDataMatchDetailResponse['referees']>[number] =>
              Boolean(referee) && typeof referee?.name === 'string' && referee.name.trim().length > 0
          )
          .slice(0, 10)
          .map((referee) => ({
            name: (referee.name as string).trim(),
            role:
              typeof referee.type === 'string' && referee.type ? referee.type : null,
            nationality:
              typeof referee.nationality === 'string' && referee.nationality
                ? referee.nationality
                : null,
          }))
      : [],
  };
}

// Single-match read for /matches/[id]. Cached for 60 seconds (the same
// in-memory cache family as results/standings) so a LIVE page can refresh
// without hammering the free-tier quota. A provider 404 becomes `notFound`;
// every other failure becomes a plain error the page renders as
// "Live match data unavailable" â€” dummy data is never substituted.
export async function getMatchDetail(matchId: number): Promise<MatchDetailResult> {
  if (!Number.isInteger(matchId) || matchId <= 0 || matchId > 10_000_000) {
    return { match: null, error: 'Match not found.', notFound: true };
  }

  if (!footballDataConfigured()) {
    return { match: null, error: NOT_CONFIGURED_MESSAGE, notFound: false };
  }

  const key = `football-data:match:${matchId}`;

  try {
    const match = await cachedWithTtl(key, MATCH_DETAIL_TTL_MS, async () => {
      const response = await fetchMatchDetail(matchId);
      return mapMatchDetail(response);
    });
    return { match, error: null, notFound: false };
  } catch (error) {
    logFailure(error, `match ${matchId}`);
    if (
      error instanceof FootballDataProviderError &&
      error.kind === 'http' &&
      error.status === 404
    ) {
      return { match: null, error: 'Match not found.', notFound: true };
    }
    return {
      match: null,
      error: footballDataErrorMessage(error, 'match data'),
      notFound: false,
    };
  }
}
