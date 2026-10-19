// Best-effort, PER-INSTANCE abuse guard for the AI summarizer.
//
// Honest scope: this lives in module memory, so it only sees the traffic served
// by ONE serverless instance. It is NOT a global rate limiter and must not be
// treated as one on Vercel, where requests fan out across instances (and cold
// starts reset the state). It exists to blunt a single client hammering the
// endpoint — reducing obvious Gemini spend and socket pressure — while a proper
// shared limiter is put in place. See the hardening report for the proposed
// shared design (Upstash Redis / Vercel KV) and its cost.
//
// Client-safe and dependency-free: pure time math with an injectable clock so
// it is unit-testable with node:test like async-pool, rate-limit and observe.

export type ThrottleDecision =
  | { allowed: true; release: () => void }
  | { allowed: false; reason: 'rate' | 'concurrency'; retryAfterMs: number };

export type ThrottleOptions = {
  /** Sliding window length. Defaults to 60s. */
  windowMs?: number;
  /** Max accepted requests per key per window. Defaults to 6. */
  maxPerWindow?: number;
  /** Max summarizations running at once on this instance. Defaults to 4. */
  maxConcurrent?: number;
  /** Injectable clock (tests). Defaults to Date.now. */
  now?: () => number;
};

export class SummarizerThrottle {
  private readonly windowMs: number;
  private readonly maxPerWindow: number;
  private readonly maxConcurrent: number;
  private readonly now: () => number;
  private readonly buckets = new Map<string, number[]>();
  private inFlight = 0;

  constructor(options: ThrottleOptions = {}) {
    this.windowMs = options.windowMs ?? 60_000;
    this.maxPerWindow = options.maxPerWindow ?? 6;
    this.maxConcurrent = options.maxConcurrent ?? 4;
    this.now = options.now ?? (() => Date.now());
  }

  acquire(key: string): ThrottleDecision {
    const now = this.now();
    const hits = (this.buckets.get(key) ?? []).filter((time) => now - time < this.windowMs);
    this.buckets.set(key, hits);

    if (hits.length >= this.maxPerWindow) {
      return {
        allowed: false,
        reason: 'rate',
        retryAfterMs: Math.max(0, this.windowMs - (now - hits[0])),
      };
    }

    if (this.inFlight >= this.maxConcurrent) {
      return { allowed: false, reason: 'concurrency', retryAfterMs: 1_000 };
    }

    hits.push(now);
    this.inFlight += 1;
    let released = false;

    return {
      allowed: true,
      release: () => {
        if (released) return;
        released = true;
        this.inFlight = Math.max(0, this.inFlight - 1);
      },
    };
  }

  get activeCount(): number {
    return this.inFlight;
  }
}

export const summarizerThrottle = new SummarizerThrottle();
