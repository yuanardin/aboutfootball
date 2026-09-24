import 'server-only';
import type {
  FootballDataMatchesResponse,
  FootballDataStandingsResponse,
  FootballDataTeamMatchesResponse,
  FootballDataTeamsResponse,
} from './types';

const FOOTBALL_DATA_BASE_URL = 'https://api.football-data.org/v4';
const REQUEST_TIMEOUT_MS = 15_000;

export type FootballDataFailureKind = 'config' | 'http' | 'network' | 'timeout';

export class FootballDataProviderError extends Error {
  constructor(
    public readonly status: number | null,
    public readonly kind: FootballDataFailureKind,
    message: string
  ) {
    super(message);
    this.name = 'FootballDataProviderError';
  }
}

function apiToken(): string {
  const token = process.env.FOOTBALL_DATA_API_KEY;
  if (!token) {
    throw new FootballDataProviderError(
      null,
      'config',
      'FOOTBALL_DATA_API_KEY is not set (free tier: https://www.football-data.org/pricing)'
    );
  }
  return token;
}

async function apiRequest<T>(path: string, query: Record<string, string> = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const search = new URLSearchParams(query);
    const url = `${FOOTBALL_DATA_BASE_URL}${path}${search.size ? `?${search.toString()}` : ''}`;

    const response = await fetch(url, {
      headers: {
        'X-Auth-Token': apiToken(),
        Accept: 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new FootballDataProviderError(
        response.status,
        'http',
        `football-data.org returned ${response.status} ${response.statusText} for ${path}`
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof FootballDataProviderError) {
      throw error;
    }
    if (controller.signal.aborted || (error as Error)?.name === 'AbortError') {
      throw new FootballDataProviderError(
        null,
        'timeout',
        `football-data.org request timed out after ${REQUEST_TIMEOUT_MS}ms for ${path}`
      );
    }
    throw new FootballDataProviderError(
      null,
      'network',
      `football-data.org request failed for ${path}: ${(error as Error).message}`
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function fetchFinishedMatches(competitionCode: string): Promise<FootballDataMatchesResponse> {
  return apiRequest<FootballDataMatchesResponse>(`/competitions/${competitionCode}/matches`, {
    status: 'FINISHED',
  });
}

export function fetchStandings(competitionCode: string): Promise<FootballDataStandingsResponse> {
  return apiRequest<FootballDataStandingsResponse>(`/competitions/${competitionCode}/standings`);
}

export function fetchCompetitionTeams(competitionCode: string): Promise<FootballDataTeamsResponse> {
  return apiRequest<FootballDataTeamsResponse>(`/competitions/${competitionCode}/teams`);
}

export function fetchTeamMatches(
  teamId: number,
  query: Record<string, string>
): Promise<FootballDataTeamMatchesResponse> {
  return apiRequest<FootballDataTeamMatchesResponse>(`/teams/${teamId}/matches`, query);
}