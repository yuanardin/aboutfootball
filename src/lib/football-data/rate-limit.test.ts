import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RATE_LIMIT_FALLBACK_COOLDOWN_MS,
  applyRateLimitCooldown,
  clearRateLimit,
  getRateLimitResumeAt,
  isRateLimited,
  parseRateLimitCooldownMs,
} from './rate-limit';

function headers(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

test('missing headers fall back to the conservative default', () => {
  assert.equal(parseRateLimitCooldownMs(headers({})), RATE_LIMIT_FALLBACK_COOLDOWN_MS);
  assert.equal(parseRateLimitCooldownMs(headers({ 'retry-after': 'garbage' })), RATE_LIMIT_FALLBACK_COOLDOWN_MS);
  assert.equal(parseRateLimitCooldownMs(headers({ 'retry-after': '-5' })), RATE_LIMIT_FALLBACK_COOLDOWN_MS);
});

test('Retry-After seconds are honored with a buffer', () => {
  const cooldown = parseRateLimitCooldownMs(headers({ 'retry-after': '23' }));
  assert.ok(cooldown >= 23_000 && cooldown <= 25_000, `expected ~24s, saw ${cooldown}`);
});

test('Retry-After HTTP dates are honored', () => {
  const now = Date.now();
  const date = new Date(now + 30_000).toUTCString();
  const cooldown = parseRateLimitCooldownMs(headers({ 'retry-after': date }), now);
  assert.ok(cooldown >= 30_000 && cooldown <= 32_000, `expected ~31s, saw ${cooldown}`);
  const past = new Date(now - 30_000).toUTCString();
  assert.equal(
    parseRateLimitCooldownMs(headers({ 'retry-after': past }), now),
    RATE_LIMIT_FALLBACK_COOLDOWN_MS
  );
});

test('X-RequestCounter-Reset seconds are honored and the larger signal wins', () => {
  const resetOnly = parseRateLimitCooldownMs(headers({ 'X-RequestCounter-Reset': '12' }));
  assert.ok(resetOnly >= 12_000 && resetOnly <= 14_000, `expected ~13s, saw ${resetOnly}`);

  const both = parseRateLimitCooldownMs(
    headers({ 'retry-after': '5', 'X-RequestCounter-Reset': '40' })
  );
  assert.ok(both >= 40_000 && both <= 42_000, `expected ~41s, saw ${both}`);
});

test('absurd header values are capped instead of stalling the app', () => {
  const cooldown = parseRateLimitCooldownMs(headers({ 'retry-after': '99999' }));
  assert.ok(cooldown <= 5 * 60_000 + 1_000, `expected cap at ~5min, saw ${cooldown}`);
  assert.ok(cooldown > 60_000, `expected the cap, not the fallback, saw ${cooldown}`);
});

test('the shared gate arms, blocks, and lifts', () => {
  clearRateLimit();
  const now = Date.now();
  assert.equal(isRateLimited(now), false);
  const resumeAt = applyRateLimitCooldown(10_000, now);
  assert.equal(getRateLimitResumeAt(), resumeAt);
  assert.equal(isRateLimited(now + 5_000), true);
  assert.equal(isRateLimited(now + 11_000), false);
  // Invalid values fall back to the conservative default, never to zero.
  applyRateLimitCooldown(null, now);
  assert.equal(isRateLimited(now + 1_000), true);
  clearRateLimit();
  assert.equal(isRateLimited(now + 1_000), false);
});
