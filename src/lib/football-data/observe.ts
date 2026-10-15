// Safe observability for the football-data.org integration.
//
// Client-safe: no network/cache/server-only imports, so it is unit-testable
// with node:test like async-pool and rate-limit.
//
// What is logged (and what is NEVER logged):
// - cache hits/misses per key scope, upstream request counts, HTTP statuses,
//   remaining-quota/reset headers when present, cooldown arming, instance id.
// - The API token and all secrets are NEVER logged: only numeric quota fields
//   parsed from response headers are recorded.
//
// Instance identity: Cloud Run exposes the container instance id as HOSTNAME;
// Vercel exposes the region (instances share it, hence the per-process random
// suffix). The suffix distinguishes processes that share one hostname, so two
// log lines with different instance ids provably came from different
// processes — the cross-instance diagnosis this module exists for.

function randomSuffix(): string {
  return Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
}

const HOST = process.env.HOSTNAME ?? process.env.VERCEL_REGION ?? 'local';

export const FOOTBALL_DATA_INSTANCE_ID = `${HOST}-${randomSuffix()}`;

export type QuotaSnapshot = {
  remaining: number | null;
  resetSeconds: number | null;
};

function parseNonNegativeInt(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

// Reads only the numeric quota fields. football-data.org documents
// X-RequestCounter-Reset as seconds until the counter resets and
// X-RequestsAvailable(-Minute) as the remaining calls before blocking.
export function parseQuotaSnapshot(headers: Headers): QuotaSnapshot {
  const remainingCandidates = [
    headers.get('x-requestsavailable-minute'),
    headers.get('x-requestsavailable'),
    headers.get('x-requests-available-minute'),
    headers.get('x-requests-available'),
  ];
  let remaining: number | null = null;
  for (const candidate of remainingCandidates) {
    const parsed = parseNonNegativeInt(candidate);
    if (parsed !== null) remaining = remaining === null ? parsed : Math.min(remaining, parsed);
  }
  const resetCandidates = [
    headers.get('x-requestcounter-reset'),
    headers.get('x-request-counter-reset'),
  ];
  let resetSeconds: number | null = null;
  for (const candidate of resetCandidates) {
    const parsed = parseNonNegativeInt(candidate);
    if (parsed !== null) resetSeconds = resetSeconds === null ? parsed : Math.max(resetSeconds, parsed);
  }
  return { remaining, resetSeconds };
}

export type FootballDataCounters = {
  upstreamRequests: number;
  cacheHits: number;
  cacheMisses: number;
  rateLimitResponses: number;
  cooldownsArmed: number;
};

const counters: FootballDataCounters = {
  upstreamRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  rateLimitResponses: 0,
  cooldownsArmed: 0,
};

export function getFootballDataCounters(): FootballDataCounters {
  return { ...counters };
}

export function resetFootballDataCounters(): void {
  counters.upstreamRequests = 0;
  counters.cacheHits = 0;
  counters.cacheMisses = 0;
  counters.rateLimitResponses = 0;
  counters.cooldownsArmed = 0;
}

function instanceTag(): string {
  return `instance=${FOOTBALL_DATA_INSTANCE_ID}`;
}

// Cache hits are high-volume (every navigation), so they go to debug while
// misses — which always precede an upstream call — stay at info.
export function logCacheHit(scope: string, key: string): void {
  counters.cacheHits += 1;
  console.debug(`[football-data] cache hit scope=${scope} key=${key} ${instanceTag()}`);
}

export function logCacheMiss(scope: string, key: string): void {
  counters.cacheMisses += 1;
  console.info(`[football-data] cache miss scope=${scope} key=${key} ${instanceTag()}`);
}

export function logUpstreamResponse(
  path: string,
  status: number,
  quota: QuotaSnapshot
): void {
  counters.upstreamRequests += 1;
  if (status === 429) counters.rateLimitResponses += 1;
  const remaining = quota.remaining === null ? 'unknown' : String(quota.remaining);
  const reset = quota.resetSeconds === null ? 'unknown' : `${quota.resetSeconds}s`;
  console.info(
    `[football-data] upstream path=${path} status=${status} remaining=${remaining} reset=${reset} ${instanceTag()}`
  );
}

// Timeouts and network failures never produce a response, so they are counted
// separately — otherwise the request counter would undercount quota pressure.
export function logUpstreamError(path: string, kind: 'timeout' | 'network'): void {
  counters.upstreamRequests += 1;
  console.warn(`[football-data] upstream path=${path} status=${kind} ${instanceTag()}`);
}

export function logCooldownArmed(cooldownMs: number, trigger: string): void {
  counters.cooldownsArmed += 1;
  console.warn(
    `[football-data] cooldown armed for=${Math.round(cooldownMs)}ms trigger=${trigger} ${instanceTag()}`
  );
}
