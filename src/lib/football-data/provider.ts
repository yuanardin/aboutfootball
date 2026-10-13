import 'server-only';
import { parseRateLimitCooldownMs } from './rate-limit';
import type {
  FootballDataMatchDetailResponse,
  FootballDataMatchesResponse,
  FootballDataStandingsResponse,
  FootballDataTeamMatchesResponse,
  FootballDataTeamsResponse,
} from './types';
import type { CompetitionCode } from './competitions';

const FOOTBALL_DATA_BASE_URL = 'https://api.football-data.org/v4';
const REQUEST_TIMEOUT_MS = 15_000;
// The free tier allows ~10 requests/minute per API token. A 429 therefore
// means the whole token quota is exhausted — retrying the same request would
// only burn more quota, so every request is attempted EXACTLY ONCE. The
// service layer owns the shared in-process cooldown gate (armed from the
// 429's Retry-After / X-RequestCounter-Reset headers, see rate-limit.ts) and
// serves stale/last-known-good data while it is armed. No retry storm.

export type FootballDataFailureKind = 'config' | 'http' | 'network' | 'timeout' | 'rate-limit';

export class FootballDataProviderError extends Error {
  constructor(
    public readonly status: number | null,
    public readonly kind: FootballDataFailureKind,
    message: string,
    // Milliseconds the caller should stay quiet, derived from the 429
    // response headers. Null for every non-rate-limit failure.
    public readonly rateLimitCooldownMs: number | null = null
  ) {
    super(message);
    this.name = 'FootballDataProviderError';
  }
}

export function liveFootballDataEnabled(): boolean {
  const value = process.env.LIVE_FOOTBALL_DATA_ENABLED;
  if (value === undefined) return true;
  return !['0', 'false', 'off', 'no'].includes(value.trim().toLowerCase());
}

function apiToken(): string {
  if (!liveFootballDataEnabled()) {
    throw new FootballDataProviderError(
      null,
      'config',
      'LIVE_FOOTBALL_DATA_ENABLED is false, so the live football data provider is turned off.'
    );
  }

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
      if (response.status === 429) {
        throw new FootballDataProviderError(
          response.status,
          'rate-limit',
          `football-data.org rate limit reached for ${path}`,
          parseRateLimitCooldownMs(response.headers)
        );
      }
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

export function fetchFinishedMatches(competitionCode: CompetitionCode): Promise<FootballDataMatchesResponse> {
  return apiRequest<FootballDataMatchesResponse>(`/competitions/${competitionCode}/matches`, {
    status: 'FINISHED',
  });
}

export function fetchStandings(competitionCode: CompetitionCode): Promise<FootballDataStandingsResponse> {
  return apiRequest<FootballDataStandingsResponse>(`/competitions/${competitionCode}/standings`);
}

export function fetchCompetitionTeams(competitionCode: CompetitionCode): Promise<FootballDataTeamsResponse> {
  return apiRequest<FootballDataTeamsResponse>(`/competitions/${competitionCode}/teams`);
}

export function fetchTeamMatches(
  teamId: number,
  query: Record<string, string>
): Promise<FootballDataTeamMatchesResponse> {
  return apiRequest<FootballDataTeamMatchesResponse>(`/teams/${teamId}/matches`, query);
}

export function fetchMatchDetail(matchId: number): Promise<FootballDataMatchDetailResponse> {
  return apiRequest<FootballDataMatchDetailResponse>(`/matches/${matchId}`);
}
