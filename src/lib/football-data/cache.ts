// L1: per-process in-memory TTL cache with promise-sharing single-flight.
// Concurrent reads for one key in THIS process share one loader run, and a
// rejected loader evicts its entry so errors never stick. Cross-instance
// sharing lives one layer up in shared-cache.ts (Next.js Data Cache); this L1
// stays in front of it so warm keys never touch L2 either.
type CacheEntry<T> = { value: Promise<T>; expiresAt: number };

export type CacheHooks = {
  onHit?: () => void;
  onMiss?: () => void;
};

const store = new Map<string, CacheEntry<unknown>>();

export function cachedWithTtl<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  hooks?: CacheHooks
): Promise<T> {
  const existing = store.get(key);

  if (existing && existing.expiresAt > Date.now()) {
    hooks?.onHit?.();
    return existing.value as Promise<T>;
  }

  hooks?.onMiss?.();
  const value = loader();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });

  value.catch(() => {
    if (store.get(key)?.value === value) {
      store.delete(key);
    }
  });

  return value;
}