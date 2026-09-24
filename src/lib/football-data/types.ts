import type { MatchResult, Standing } from '@/lib/types';

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

export type FootballDataSource = 'live' | 'demo';

export type FootballDataMeta = {
  source: FootballDataSource;
  provider: string;
  competition: string;
  code: string;
  season: string;
  matchday: number | null;
  lastUpdated: string;
};

export type ResultsPayload = { matches: MatchResult[]; meta: FootballDataMeta };
export type StandingsPayload = { standings: Standing[]; meta: FootballDataMeta };