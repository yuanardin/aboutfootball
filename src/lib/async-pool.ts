// Bounded-concurrency runner for bulk reads (multi-competition overviews).
//
// Client-safe: pure scheduling, no network/cache/server-only imports, so it is
// unit-testable with node:test and reusable anywhere.
//
// Why this exists: the football-data.org free tier allows roughly ten requests
// per minute per token. Firing all six competition reads simultaneously on a
// cold cache is the fastest way to collect 429s, so bulk reads run through a
// small pool (with the existing per-key TTL cache in front). The provider
// never retries a 429 — the first one arms the shared in-process cooldown gate
// (see football-data/rate-limit.ts) and the remaining competitions serve
// stale/last-good data instead of burning more quota — while cached
// competitions still resolve instantly.
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 1;
  const results = new Array<R>(items.length);
  let next = 0;

  async function run(): Promise<void> {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  const runnerCount = Math.min(safeLimit, items.length);
  const runners: Array<Promise<void>> = [];
  for (let i = 0; i < runnerCount; i += 1) {
    runners.push(run());
  }
  await Promise.all(runners);
  return results;
}
