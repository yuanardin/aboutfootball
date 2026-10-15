// Single in-process rate-limit gate shared by every football-data.org read.
//
// Client-safe: pure time/header math plus safe logging, no network/cache/
// server-only imports, so it is unit-testable with node:test like async-pool.
//
// Why one gate instead of one per competition: the free-tier quota (10
// requests/minute) is enforced per API token, not per competition. A per-key
// gate lets a throttled Premier League read keep burning quota with Bundesliga
// retries. A single gate stops ALL football-data.org reads in this process as
// soon as the first 429 lands.
//
// Scope honesty: this gate lives in module memory, so it is shared by every
// request served by ONE Node process (one serverless instance). It is NOT a
// global cross-instance quota: N instances still keep N independent gates
// while sharing one token quota. A shared cross-instance cache (Redis/KV or
// Firestore) is deliberately out of scope for this change — see the diagnosis
// report for those options and their costs.

import { logCooldownArmed } from './observe';

export const RATE_LIMIT_FALLBACK_COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 5 * 60_000;
const COOLDOWN_BUFFER_MS = 1_000;

let resumeAt = 0;

export function isRateLimited(now: number = Date.now()): boolean {
  return now < resumeAt;
}

export function getRateLimitResumeAt(): number {
  return resumeAt;
}

// Lifts the gate. Only tests/diagnostics call this: a later upstream success
// deliberately does NOT clear the gate (the only requests that can succeed
// after a 429 passed the gate check before it armed — stale evidence, not
// proof of recovered quota), so the gate always runs its full course.
export function clearRateLimit(): void {
  resumeAt = 0;
}

// Arms the gate for `cooldownMs`, falling back to the conservative 60s default
// when the value is missing or invalid. Returns the new resume timestamp.
export function applyRateLimitCooldown(
  cooldownMs: number | null | undefined,
  now: number = Date.now(),
  trigger = 'unknown'
): number {
  const safe =
    typeof cooldownMs === 'number' && Number.isFinite(cooldownMs) && cooldownMs > 0
      ? Math.min(cooldownMs, MAX_COOLDOWN_MS)
      : RATE_LIMIT_FALLBACK_COOLDOWN_MS;
  resumeAt = now + safe;
  logCooldownArmed(safe, trigger);
  return resumeAt;
}

function parseSecondsField(value: string | null): number | null {
  if (value === null) return null;
  const seconds = Number(value.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds;
}

// Standard `Retry-After`: either delay-seconds or an HTTP date. Returns the
// delay in seconds, or null when the header is missing/invalid/in the past.
function parseRetryAfterField(value: string | null, now: number): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const asSeconds = Number(trimmed);
  if (Number.isFinite(asSeconds) && asSeconds > 0) return asSeconds;
  const asDate = Date.parse(trimmed);
  if (!Number.isNaN(asDate)) {
    const diffSeconds = (asDate - now) / 1000;
    if (diffSeconds > 0) return diffSeconds;
  }
  return null;
}

// Derives how long to stay quiet after a 429, preferring the provider's own
// signals. football-data.org documents `X-RequestCounter-Reset` as "the
// seconds left to reset your request counter", so it (or a standard
// `Retry-After`, whichever is larger) plus a 1s buffer is the honest cooldown.
// Unknown/missing/invalid headers fall back to the conservative 60s default.
// Capped at 5 minutes so one bad header can never stall the app for longer.
export function parseRateLimitCooldownMs(headers: Headers, now: number = Date.now()): number {
  const retryAfter = parseRetryAfterField(headers.get('retry-after'), now);
  const resetCandidates = [
    headers.get('x-requestcounter-reset'),
    headers.get('x-request-counter-reset'),
  ];
  let reset: number | null = null;
  for (const candidate of resetCandidates) {
    const seconds = parseSecondsField(candidate);
    if (seconds !== null) reset = Math.max(reset ?? 0, seconds);
  }
  const seconds = Math.max(retryAfter ?? 0, reset ?? 0);
  if (seconds <= 0) return RATE_LIMIT_FALLBACK_COOLDOWN_MS;
  return Math.min(seconds * 1000 + COOLDOWN_BUFFER_MS, MAX_COOLDOWN_MS);
}
