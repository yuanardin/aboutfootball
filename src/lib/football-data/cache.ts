type CacheEntry<T> = { value: Promise<T>; expiresAt: number };

const store = new Map<string, CacheEntry<unknown>>();

export function cachedWithTtl<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const existing = store.get(key);

  if (existing && existing.expiresAt > Date.now()) {
    return existing.value as Promise<T>;
  }

  const value = loader();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });

  value.catch(() => {
    if (store.get(key)?.value === value) {
      store.delete(key);
    }
  });

  return value;
}