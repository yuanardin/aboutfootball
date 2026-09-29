// Bounded-concurrency runner for bulk reads (multi-competition overviews).
//
// Client-safe: pure scheduling, no network/cache/server-only imports, so it is
// unit-testable with node:test and reusable anywhere.
//
// Why this exists: the football-data.org free tier allows roughly ten requests
// per minute. Firing all six competition reads simultaneously on a cold cache
// is the fastest way to collect 429s, and every 429 is then retried with
// backoff — amplifying the burst. Running bulk reads through a small pool
// (with the existing per-key TTL cache in front) keeps upstream pressure low
// while cached competitions still resolve instantly.
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
