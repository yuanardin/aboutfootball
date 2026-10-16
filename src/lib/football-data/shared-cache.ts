// Shared (cross-instance) cache for the football-data.org integration.
//
// Layering:
// - L1 (per process): `cachedWithTtl` in cache.ts — in-memory, keeps the
//   existing per-key TTLs and per-process single-flight. Fast, but every
//   Vercel serverless instance keeps its own Map, so N instances x M visitors
//   still means N x M upstream pressure on a cold start.
// - L2 (shared): this module — Next.js Data Cache via `unstable_cache`
//   (available in the locked Next 15.5.9). On Vercel the Data Cache is stored
//   outside any single instance, so instance A filling it lets instance B
//   serve the same payload with zero new upstream requests.
//
// Why the Data Cache instead of Redis/Upstash/Firestore:
// - No new dependency, no new billing surface, no secret handling (only
//   public, already-mapped payloads are cached — never the API token).
// - Payloads are read-heavy and TTL-tolerant (1 min – 24 h), which is exactly
//   what the Data Cache is built for.
// - Remaining gap vs Redis: no cross-instance mutex, so a cold/expired key
//   hit by N instances at once can still cost up to N upstream calls (one per
//   instance, each de-duplicated internally by its L1 single-flight). That is
//   bounded and far below today's unbounded per-visitor cost, and steady-state
//   (warm) costs zero upstream reads.
//
// Rules enforced here:
// - Explicit TTL per resource, mirroring the existing L1 TTLs (never longer,
//   so freshness never silently extends). Team-matches uses the SHORTER of
//   its two L1 TTLs (3 min live) because liveness is only known after fetch.
// - Only successful upstream payloads are written: loaders throw on
//   429/timeout/5xx, and the Data Cache never persists a thrown call, so
//   errors can never poison a valid entry.
// - Keys distinguish every dimension that changes the payload: cache
//   version, competition, resource kind, status filter, and id params.
//   Nothing user-specific is ever cached here (all keys are public data).
//
// Client-safe by design: `next/cache` is loaded lazily inside the fetch path
// so this module stays unit-testable with node:test (like observe.ts and
// rate-limit.ts). Tests inject an isolated memory backend via
// __setSharedCacheBackendForTests to simulate two runtimes sharing only L2.
//
// Logging (also client-safe, via observe.ts — console only, no network, no
// secrets): pass `scope`/`cacheKey` and this module emits one line per L2
// decision using the SAME counters as L1, with a `:L2` scope suffix so log
// readers can tell every layer apart:
// - L1 hit            -> `cache hit scope=<scope> ...`      (L2 never runs)
// - L1 miss + L2 hit  -> `cache miss scope=<scope> ...` then
//                        `cache hit scope=<scope>:L2 ...`   (no upstream fetch)
// - L1 miss + L2 miss -> `cache miss scope=<scope> ...` then
//                        `cache miss scope=<scope>:L2 ...` then the provider's
//                        `upstream ...` line (exactly one upstream fetch)
// - 429/cooldown      -> provider `upstream ... status=429 ...` plus
//                        `cooldown armed ...` (owned by provider.ts /
//                        rate-limit.ts, unchanged)

import { logCacheHit, logCacheMiss } from './observe';

const SHARED_CACHE_VERSION = 'fd-v1';

export const SHARED_REVALIDATE_SECONDS = {
  results: 5 * 60,
  standings: 10 * 60,
  teams: 24 * 60 * 60,
  // L1 uses 10 min normally and 3 min when a live match is present; liveness
  // is only known after the fetch, so L2 pins the shorter bound.
  teamMatches: 3 * 60,
  matchDetail: 60,
} as const;

// Key builders. Every segment that changes the upstream payload is part of
// the key; bumping SHARED_CACHE_VERSION invalidates the whole family at once.
export function resultsSharedKey(competitionCode: string, status = 'FINISHED'): string[] {
  return [SHARED_CACHE_VERSION, competitionCode, 'results', status];
}

export function standingsSharedKey(competitionCode: string): string[] {
  return [SHARED_CACHE_VERSION, competitionCode, 'standings'];
}

export function teamsSharedKey(competitionCode: string): string[] {
  return [SHARED_CACHE_VERSION, competitionCode, 'teams'];
}

export function teamMatchesSharedKey(
  teamId: number,
  status = 'SCHEDULED,TIMED,IN_PLAY,PAUSED,FINISHED'
): string[] {
  return [SHARED_CACHE_VERSION, 'team', String(teamId), 'matches', status];
}

export function matchDetailSharedKey(matchId: number): string[] {
  return [SHARED_CACHE_VERSION, 'match', String(matchId)];
}

// --- Pluggable backend (tests only) ----------------------------------------

export type SharedCacheBackend = {
  get<T>(key: string): { value: T; storedAt: number } | undefined;
  set<T>(key: string, value: T): void;
};

let testBackend: SharedCacheBackend | null = null;

/** Tests only: isolate two simulated runtimes on one shared backend. */
export function __setSharedCacheBackendForTests(backend: SharedCacheBackend | null): void {
  testBackend = backend;
}

export function createMemorySharedBackend(): SharedCacheBackend & { clear(): void } {
  const store = new Map<string, { value: unknown; storedAt: number }>();
  return {
    get<T>(key: string) {
      return store.get(key) as { value: T; storedAt: number } | undefined;
    },
    set<T>(key: string, value: T) {
      store.set(key, { value, storedAt: Date.now() });
    },
    clear() {
      store.clear();
    },
  };
}

function serializeKey(keyParts: readonly string[]): string {
  return JSON.stringify(keyParts);
}

// Per-process single-flight for the injected-backend path (mirrors the L1
// promise-sharing in cache.ts so a burst on a cold key costs one loader run).
const testInFlight = new Map<string, Promise<unknown>>();

export type SharedCacheOpts = {
  // Human-readable layer scope for logs (e.g. 'results', 'standings').
  // Omit to stay silent (unit tests). NEVER a secret: only competition
  // codes / resource names reach the log line.
  scope?: string;
  // Correlates the L2 line with its L1 line; defaults to the key parts.
  cacheKey?: string;
};

async function fetchViaTestBackend<T>(
  key: string,
  revalidateSeconds: number,
  loader: () => Promise<T>,
  opts: SharedCacheOpts = {}
): Promise<T> {
  const backend = testBackend;
  if (!backend) return loader();
  const ttlMs = revalidateSeconds * 1000;
  const existing = backend.get<T>(key);
  if (existing && Date.now() - existing.storedAt < ttlMs) {
    if (opts.scope) logCacheHit(`${opts.scope}:L2`, opts.cacheKey ?? key);
    return existing.value;
  }
  if (opts.scope) logCacheMiss(`${opts.scope}:L2`, opts.cacheKey ?? key);
  const inFlight = testInFlight.get(key);
  if (inFlight) return inFlight as Promise<T>;
  const pending = (async (): Promise<T> => {
    // Loader success is the ONLY write path: 429/timeout/5xx throw, so a
    // failure can never overwrite (or poison) a valid shared entry.
    const value = await loader();
    backend.set(key, value);
    return value;
  })();
  testInFlight.set(key, pending);
  try {
    return await pending;
  } finally {
    if (testInFlight.get(key) === pending) testInFlight.delete(key);
  }
}

// --- Production path ---------------------------------------------------------

async function fetchViaDataCache<T>(
  keyParts: readonly string[],
  revalidateSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  const { unstable_cache } = await import('next/cache');
  // The loader takes no arguments, so the Data Cache identity is exactly
  // keyParts — distinct competitions/resources/filters never collide.
  // Errors (429/5xx/timeout) propagate and are never persisted.
  const cached = unstable_cache(loader, [...keyParts], { revalidate: revalidateSeconds });
  return cached();
}

/**
 * Read through the shared cache. Uses the injected test backend when one is
 * set, the Next.js Data Cache in a Next runtime, and a direct loader call as
 * the last resort (plain node, or a Next-less environment).
 *
 * Failure semantics: when the Data Cache path rejects BECAUSE the loader
 * threw (429/timeout/5xx), the error propagates after exactly ONE loader run
 * — the loader is never re-executed, so a 429 never costs a second upstream
 * call. The direct-loader fallback runs only when the Data Cache itself is
 * unavailable (loader never ran: import failed outside a Next runtime).
 */
export async function fetchViaSharedCache<T>(
  keyParts: readonly string[],
  revalidateSeconds: number,
  loader: () => Promise<T>,
  opts: SharedCacheOpts = {}
): Promise<T> {
  if (testBackend) {
    return fetchViaTestBackend(serializeKey(keyParts), revalidateSeconds, loader, opts);
  }
  let loaderRan = false;
  const tracked = async (): Promise<T> => {
    loaderRan = true;
    return loader();
  };
  const logHit = (): void => {
    if (opts.scope) logCacheHit(`${opts.scope}:L2`, opts.cacheKey ?? serializeKey(keyParts));
  };
  const logMiss = (): void => {
    if (opts.scope) logCacheMiss(`${opts.scope}:L2`, opts.cacheKey ?? serializeKey(keyParts));
  };
  try {
    const result = await fetchViaDataCache(keyParts, revalidateSeconds, tracked);
    if (loaderRan) logMiss();
    else logHit();
    return result;
  } catch (error) {
    // A loader that ran and failed already produced its upstream/429 log
    // lines via the provider — record the L2 miss and rethrow WITHOUT
    // running the loader a second time.
    if (loaderRan) {
      logMiss();
      throw error;
    }
    // No Data Cache in this runtime (unit tests, scripts): run directly.
    return loader();
  }
}
