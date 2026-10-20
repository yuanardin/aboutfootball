import assert from 'node:assert/strict';
import test from 'node:test';

import { SummarizerThrottle } from './summarizer-throttle';

test('per-window limit blocks the next request in the same window', () => {
  let now = 0;
  const throttle = new SummarizerThrottle({
    windowMs: 1_000,
    maxPerWindow: 2,
    maxConcurrent: 10,
    now: () => now,
  });

  const first = throttle.acquire('ip');
  const second = throttle.acquire('ip');
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  if (first.allowed) first.release();
  if (second.allowed) second.release();

  const third = throttle.acquire('ip');
  assert.equal(third.allowed, false);
  if (!third.allowed) assert.equal(third.reason, 'rate');

  now = 1_001;
  const afterWindow = throttle.acquire('ip');
  assert.equal(afterWindow.allowed, true);
});

test('concurrency cap applies across keys and release frees a slot', () => {
  const throttle = new SummarizerThrottle({
    windowMs: 60_000,
    maxPerWindow: 100,
    maxConcurrent: 1,
    now: () => 0,
  });

  const a = throttle.acquire('a');
  assert.equal(a.allowed, true);

  const b = throttle.acquire('b');
  assert.equal(b.allowed, false);
  if (!b.allowed) assert.equal(b.reason, 'concurrency');

  if (a.allowed) a.release();
  assert.equal(throttle.activeCount, 0);

  const c = throttle.acquire('b');
  assert.equal(c.allowed, true);
});

test('release is idempotent', () => {
  const throttle = new SummarizerThrottle({ maxConcurrent: 1, maxPerWindow: 10, now: () => 0 });
  const slot = throttle.acquire('a');
  assert.equal(slot.allowed, true);
  if (slot.allowed) {
    slot.release();
    slot.release();
  }
  assert.equal(throttle.activeCount, 0);
});
