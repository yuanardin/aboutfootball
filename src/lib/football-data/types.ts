import type { MatchResult, Standing, StandingGroup } from '@/lib/types';
import type { CompetitionCode } from './competitions';

export type { CompetitionCode } from './competitions';


export type FootballDataMatchStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'SUSPENDED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'AWARDED';

export type FootballDataTeam = {
  id: number;
  name: string;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
};

export type FootballDataCompetition = {
  id: number;
  name: string;
  code: string;
  type: string;
  emblem?: string | null;
};

export type FootballDataSeason = {
  id: number;
  startDate: string;
  endDate: string;
  currentMatchday?: number | null;
  winner?: unknown;
};

export type FootballDataMatch = {
  id: number;
  competition: FootballDataCompetition;
  season: FootballDataSeason;
  utcDate: string;
  status: FootballDataMatchStatus;
  matchday?: number | null;
  stage: string;
  group?: string | null;
  lastUpdated: string;
  homeTeam: FootballDataTeam;
  awayTeam: FootballDataTeam;
  score: {
    winner?: string | null;
    duration?: string | null;
    fullTime: { home: number | null; away: number | null };
    halfTime?: { home: number | null; away: number | null } | null;
  } | null;
};

export type FootballDataMatchesResponse = {
  filters: Record<string, unknown>;
  resultSet: { count: number; first?: string; last?: string; played?: number };
  competition: FootballDataCompetition;
  matches: FootballDataMatch[];
};

export type FootballDataStandingRow = {
  position: number;
  team: FootballDataTeam;
  playedGames: number;
  form?: string | null;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

export type FootballDataStandingsResponse = {
  filters: Record<string, unknown>;
  area?: { id: number; name: string };
  competition: FootballDataCompetition;
  season: FootballDataSeason;
  standings: Array<{
    stage: string;
    type: 'TOTAL' | 'HOME' | 'AWAY';
    group: string | null;
    table: FootballDataStandingRow[];
  }>;
};

export type FootballDataTeamsResponse = {
  count: number;
  filters: Record<string, unknown>;
  competition: FootballDataCompetition;
  season?: FootballDataSeason;
  teams: FootballDataTeam[];
};

export type FootballDataTeamMatchesResponse = {
  count: number;
  filters: Record<string, unknown>;
  matches: FootballDataMatch[];
};

export type FootballDataSource = 'live' | 'unavailable';

export type FootballDataMeta = {
  source: FootballDataSource;
  provider: string;
  competition: string;
  code: string;
  season: string;
  matchday: number | null;
  // Copied from the provider response when present. Domestic leagues report a regular
  // season matchday; cup competitions report a stage (e.g. LEAGUE_STAGE) and a group.
  stage: string | null;
  group: string | null;
  lastUpdated: string;
  // Set when the provider is throttling us and the payload below is the last data that
  // was actually returned by the API. Never used to substitute invented values.
  stale?: boolean;
  error?: string | null;
};

export type ResultsPayload = { matches: MatchResult[]; meta: FootballDataMeta };

// `standings` is the single table to use when a competition only returns one (every
// domestic league). `groups` carries every table exactly as the provider returned it, so
// a cup competition with a stage/group split is never flattened into a fake league table.
export type StandingsPayload = {
  standings: Standing[];
  groups: StandingGroup[];
  meta: FootballDataMeta;
};

export type CompetitionStandingsResult = {
  code: CompetitionCode;
  label: string;
  payload: StandingsPayload;
};

// Result of a multi-competition standings request. Individual competitions can fail while
// others succeed, so each entry keeps its own payload and there is no shared fallback data.
export type StandingsOverview = {
  groups: StandingGroup[];
  entries: CompetitionStandingsResult[];
  meta: FootballDataMeta;
  failed: CompetitionCode[];
  /** Competitions currently showing the provider's last known data after a throttle. */
  stale: CompetitionCode[];
};

export type CompetitionResultsResult = {
  code: CompetitionCode;
  label: string;
  payload: ResultsPayload;
};

export type ResultsOverview = {
  matches: MatchResult[];
  entries: CompetitionResultsResult[];
  meta: FootballDataMeta;
  failed: CompetitionCode[];
  /** Competitions currently showing the provider's last known data after a throttle. */
  stale: CompetitionCode[];
};