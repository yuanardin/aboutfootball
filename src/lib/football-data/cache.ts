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