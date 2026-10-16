import assert from 'node:assert/strict';
import test from 'node:test';

import {
  __setSharedCacheBackendForTests,
  createMemorySharedBackend,
  matchDetailSharedKey,
  resultsSharedKey,
  standingsSharedKey,
  teamMatchesSharedKey,
  teamsSharedKey,
  fetchViaSharedCache,
} from './shared-cache';

// These tests simulate TWO isolated runtimes (A and B) that share NOTHING
// except the injected L2 backend — the stand-in for the Vercel Data Cache in
// production. Each runtime keeps its own loader call counter (its "upstream"
// quota usage); the assertion in every test is about total upstream calls.
// A single-Map L1 hit inside one process is never claimed as cross-instance
// sharing: sharing is only proven when B serves bytes that A's loader fetched.

const REVALIDATE_S = 300;

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('instance B reads what instance A filled with no new upstream fetch', async () => {
  const backend = createMemorySharedBackend();
  __setSharedCacheBackendForTests(backend);
  try {
    let upstreamCalls = 0;
    const runtimeA = () =>
      fetchViaSharedCache(resultsSharedKey('PL'), REVALIDATE_S, async () => {
        upstreamCalls += 1;
        return { table: 'pl-live' };
      });
    // Runtime B is a separate closure with its own loader that WOULD burn
    // quota if the shared entry missed — it must never run.
    const runtimeB = () =>
      fetchViaSharedCache(resultsSharedKey('PL'), REVALIDATE_S, async () => {
        upstreamCalls += 1;
        return { table: 'pl-live-from-b' };
      });

    const fromA = await runtimeA();
    const fromB = await runtimeB();
    assert.deepStrictEqual(fromA, { table: 'pl-live' });
    assert.deepStrictEqual(fromB, { table: 'pl-live' });
    assert.equal(upstreamCalls, 1);
  } finally {
    __setSharedCacheBackendForTests(null);
  }
});

test('two simultaneous cold-miss requests share one upstream call', async () => {
  const backend = createMemorySharedBackend();
  __setSharedCacheBackendForTests(backend);
  try {
    let upstreamCalls = 0;
    const gate = deferred<string>();
    const loader = async () => {
      upstreamCalls += 1;
      await gate.promise;
      return 'standings-payload';
    };
    const key = standingsSharedKey('PD');
    const left = fetchViaSharedCache(key, REVALIDATE_S, loader);
    const right = fetchViaSharedCache(key, REVALIDATE_S, loader);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(upstreamCalls, 1);
    gate.resolve('go');
    assert.deepStrictEqual([await left, await right], ['standings-payload', 'standings-payload']);
    assert.equal(upstreamCalls, 1);
  } finally {
    __setSharedCacheBackendForTests(null);
  }
});

test('a 429 / provider failure never overwrites a valid shared entry', async () => {
  const backend = createMemorySharedBackend();
  __setSharedCacheBackendForTests(backend);
  try {
    let upstreamCalls = 0;
    const key = standingsSharedKey('SA');
    const good = await fetchViaSharedCache(key, REVALIDATE_S, async () => {
      upstreamCalls += 1;
      return { table: 'sa-live' };
    });
    assert.deepStrictEqual(good, { table: 'sa-live' });

    // The provider now 429s. The valid entry must be served without touching
    // the failing loader path — B still sees live data, quota untouched.
    const served = await fetchViaSharedCache(key, REVALIDATE_S, async () => {
      upstreamCalls += 1;
      const error = new Error('football-data.org rate limit reached');
      (error as Error & { status?: number }).status = 429;
      throw error;
    });
    assert.deepStrictEqual(served, { table: 'sa-live' });
    assert.equal(upstreamCalls, 1);
  } finally {
    __setSharedCacheBackendForTests(null);
  }
});

test('a failed cold load writes nothing, so the next retry can succeed', async () => {
  const backend = createMemorySharedBackend();
  __setSharedCacheBackendForTests(backend);
  try {
    const key = resultsSharedKey('BL1');
    await assert.rejects(
      fetchViaSharedCache(key, 60, async () => {
        throw new Error('timeout');
      }),
      /timeout/
    );
    // Retry after the outage recovers: the earlier failure left no poisoned
    // entry behind, so the good payload lands and is shared afterwards.
    let secondCalls = 0;
    const recovered = await fetchViaSharedCache(key, 60, async () => {
      secondCalls += 1;
      return { matches: 12 };
    });
    assert.deepStrictEqual(recovered, { matches: 12 });
    assert.equal(secondCalls, 1);
  } finally {
    __setSharedCacheBackendForTests(null);
  }
});

test('TTL expiry and invalidation force a refetch', async () => {
  const backend = createMemorySharedBackend();
  __setSharedCacheBackendForTests(backend);
  try {
    const key = matchDetailSharedKey(123);
    let version = 0;
    const read = () =>
      fetchViaSharedCache(key, 60, async () => {
        version += 1;
        return { v: version };
      });
    assert.deepStrictEqual(await read(), { v: 1 });
    assert.deepStrictEqual(await read(), { v: 1 });
    backend.clear();
    assert.deepStrictEqual(await read(), { v: 2 });
  } finally {
    __setSharedCacheBackendForTests(null);
  }
});

test('one competition failing does not affect the others (ALL partial success)', async () => {
  const backend = createMemorySharedBackend();
  __setSharedCacheBackendForTests(backend);
  try {
    const pl = await fetchViaSharedCache(standingsSharedKey('PL'), REVALIDATE_S, async () => ({
      table: 'pl',
    }));
    await assert.rejects(
      fetchViaSharedCache(standingsSharedKey('CL'), REVALIDATE_S, async () => {
        throw new Error('HTTP 500');
      }),
      /HTTP 500/
    );
    const plAgain = await fetchViaSharedCache(standingsSharedKey('PL'), REVALIDATE_S, async () => ({
      table: 'pl-refetched-should-not-happen',
    }));
    assert.deepStrictEqual(pl, { table: 'pl' });
    assert.deepStrictEqual(plAgain, { table: 'pl' });
  } finally {
    __setSharedCacheBackendForTests(null);
  }
});

test('logs distinguish L2 miss from L2 hit (L1 lines stay separate)', async () => {
  const backend = createMemorySharedBackend();
  __setSharedCacheBackendForTests(backend);
  const lines: string[] = [];
  const originals = { debug: console.debug, info: console.info } as const;
  console.debug = ((...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  }) as typeof console.debug;
  console.info = ((...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  }) as typeof console.info;
  try {
    const key = resultsSharedKey('PL');
    const opts = { scope: 'results', cacheKey: 'football-data:PL:matches' };
    await fetchViaSharedCache(key, REVALIDATE_S, async () => 'v1', opts);
    await fetchViaSharedCache(key, REVALIDATE_S, async () => 'SHOULD-NOT-RUN', opts);
    const misses = lines.filter((line) => line.includes('scope=results:L2') && line.includes('cache miss'));
    const hits = lines.filter((line) => line.includes('scope=results:L2') && line.includes('cache hit'));
    assert.equal(misses.length, 1);
    assert.equal(hits.length, 1);
    for (const line of lines) {
      assert.ok(!line.includes('canary-secret-token-xyz-123'), `secret leaked: ${line}`);
    }
  } finally {
    console.debug = originals.debug;
    console.info = originals.info;
    __setSharedCacheBackendForTests(null);
  }
});

test('outside a Next runtime a failing loader runs exactly once (no retry)', async () => {
  // No injected backend here: plain node has no Data Cache, so the loader
  // runs directly — but still exactly once, even on failure.
  __setSharedCacheBackendForTests(null);
  let calls = 0;
  await assert.rejects(
    fetchViaSharedCache(matchDetailSharedKey(999001), 60, async () => {
      calls += 1;
      throw new Error('football-data.org rate limit reached');
    }),
    /rate limit reached/
  );
  assert.equal(calls, 1);
});

test('cache keys never mix competitions or resource kinds', async () => {
  assert.notDeepStrictEqual(resultsSharedKey('PL'), resultsSharedKey('PD'));
  assert.notDeepStrictEqual(resultsSharedKey('PL'), standingsSharedKey('PL'));
  assert.notDeepStrictEqual(teamsSharedKey('PL'), standingsSharedKey('PL'));
  assert.notDeepStrictEqual(teamMatchesSharedKey(1), teamMatchesSharedKey(2));
  assert.notDeepStrictEqual(matchDetailSharedKey(1), matchDetailSharedKey(2));

  const backend = createMemorySharedBackend();
  __setSharedCacheBackendForTests(backend);
  try {
    await fetchViaSharedCache(resultsSharedKey('PL'), REVALIDATE_S, async () => 'pl-results');
    await fetchViaSharedCache(standingsSharedKey('PL'), REVALIDATE_S, async () => 'pl-standings');
    // Same competition, different resources: each keeps its own payload.
    assert.equal(
      await fetchViaSharedCache(resultsSharedKey('PL'), REVALIDATE_S, async () => 'WRONG'),
      'pl-results'
    );
    assert.equal(
      await fetchViaSharedCache(standingsSharedKey('PL'), REVALIDATE_S, async () => 'WRONG'),
      'pl-standings'
    );
    // Same resource, different competition: PD was never filled, so its
    // loader runs exactly once and stores its own entry.
    let pdCalls = 0;
    assert.equal(
      await fetchViaSharedCache(resultsSharedKey('PD'), REVALIDATE_S, async () => {
        pdCalls += 1;
        return 'pd-results';
      }),
      'pd-results'
    );
    assert.equal(pdCalls, 1);
  } finally {
    __setSharedCacheBackendForTests(null);
  }
});
