import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FOOTBALL_DATA_INSTANCE_ID,
  getFootballDataCounters,
  logCacheHit,
  logCacheMiss,
  logCooldownArmed,
  logUpstreamError,
  logUpstreamResponse,
  parseQuotaSnapshot,
  resetFootballDataCounters,
} from './observe';

type LogMethod = 'debug' | 'info' | 'warn';

function captureConsole(run: () => void): string[] {
  const lines: string[] = [];
  const methods: LogMethod[] = ['debug', 'info', 'warn'];
  const originals: Record<LogMethod, (...args: never[]) => void> = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
  };
  methods.forEach((method) => {
    console[method] = (...args: never[]) => {
      lines.push(args.map(String).join(' '));
    };
  });
  try {
    run();
  } finally {
    methods.forEach((method) => {
      console[method] = originals[method];
    });
  }
  return lines;
}

test('quota snapshot reads only numeric remaining/reset fields', () => {
  const quota = parseQuotaSnapshot(
    new Headers({ 'X-RequestsAvailable-Minute': '7', 'X-RequestCounter-Reset': '23' })
  );
  assert.deepStrictEqual(quota, { remaining: 7, resetSeconds: 23 });
  assert.deepStrictEqual(parseQuotaSnapshot(new Headers({})), {
    remaining: null,
    resetSeconds: null,
  });
  assert.deepStrictEqual(
    parseQuotaSnapshot(new Headers({ 'X-RequestsAvailable': 'nope', 'Retry-After': 'x' })),
    { remaining: null, resetSeconds: null }
  );
});

test('instance id is stable per process and safe to log', () => {
  assert.match(FOOTBALL_DATA_INSTANCE_ID, /^[A-Za-z0-9_.-]+-[0-9a-f]{4}$/);
});

test('counters track hits, misses, upstream, 429s and cooldowns', () => {
  resetFootballDataCounters();
  captureConsole(() => {
    logCacheHit('standings', 'k1');
    logCacheMiss('standings', 'k1');
    logUpstreamResponse('/competitions/PL/standings', 200, { remaining: 9, resetSeconds: 12 });
    logUpstreamResponse('/competitions/PD/standings', 429, { remaining: 0, resetSeconds: 60 });
    logUpstreamError('/competitions/SA/standings', 'timeout');
    logCooldownArmed(60_000, 'standings:k');
  });
  assert.deepStrictEqual(getFootballDataCounters(), {
    upstreamRequests: 3,
    cacheHits: 1,
    cacheMisses: 1,
    rateLimitResponses: 1,
    cooldownsArmed: 1,
  });
  resetFootballDataCounters();
  assert.deepStrictEqual(getFootballDataCounters(), {
    upstreamRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    rateLimitResponses: 0,
    cooldownsArmed: 0,
  });
});

test('no log line ever contains the API token or secrets', () => {
  const canary = 'canary-secret-token-xyz-123';
  process.env.FOOTBALL_DATA_API_KEY = canary;
  process.env.GEMINI_API_KEY = canary;
  const lines = captureConsole(() => {
    logCacheHit('standings', 'k1');
    logCacheMiss('results', 'k2');
    logUpstreamResponse('/competitions/PL/standings', 429, { remaining: 0, resetSeconds: 5 });
    logUpstreamError('/x', 'network');
    logCooldownArmed(6_000, 'standings:k1');
  });
  delete process.env.FOOTBALL_DATA_API_KEY;
  delete process.env.GEMINI_API_KEY;
  assert.ok(lines.length > 0, 'expected log lines to assert on');
  for (const line of lines) {
    assert.ok(!line.includes(canary), `secret leaked in log line: ${line}`);
  }
});
