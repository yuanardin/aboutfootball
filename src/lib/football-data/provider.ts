import 'server-only';
import type {
  FootballDataMatchesResponse,
  FootballDataStandingsResponse,
  FootballDataTeamMatchesResponse,
  FootballDataTeamsResponse,
} from './types';
import type { CompetitionCode } from './competitions';

const FOOTBALL_DATA_BASE_URL = 'https://api.football-data.org/v4';
const REQUEST_TIMEOUT_MS = 15_000;
// The free tier allows a small number of requests per minute. When several competitions
// are requested at once a 429 is expected, so a 429 is retried with a short backoff
// instead of being surfaced as a permanent error.
const RATE_LIMIT_RETRY_DELAYS_MS = [600, 1_500, 3_000];
const RATE_LIMIT_MAX_ATTEMPTS = RATE_LIMIT_RETRY_DELAYS_MS.length + 1;

export type FootballDataFailureKind = 'config' | 'http' | 'network' | 'timeout' | 'rate-limit';

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attemptRequest<T>(path: string, query: Record<string, string>): Promise<T> {
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
          `football-data.org rate limit reached for ${path}`
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

async function apiRequest<T>(path: string, query: Record<string, string> = {}): Promise<T> {
  for (let index = 0; index < RATE_LIMIT_MAX_ATTEMPTS; index += 1) {
    try {
      return await attemptRequest<T>(path, query);
    } catch (error) {
      const isRateLimit =
        error instanceof FootballDataProviderError && error.kind === 'rate-limit';
      if (!isRateLimit || index === RATE_LIMIT_MAX_ATTEMPTS - 1) {
        throw error;
      }
      await sleep(RATE_LIMIT_RETRY_DELAYS_MS[index]);
    }
  }

  // Unreachable: the loop either returns or throws.
  throw new FootballDataProviderError(429, 'rate-limit', `football-data.org rate limit for ${path}`);
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
