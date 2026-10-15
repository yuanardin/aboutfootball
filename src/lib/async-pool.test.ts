import assert from 'node:assert/strict';
import test from 'node:test';

import { mapWithConcurrency } from './async-pool';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('bulk reads never exceed the concurrency limit', async () => {
  const gates = Array.from({ length: 6 }, () => deferred<string>());
  let running = 0;
  let maxRunning = 0;

  const pending = mapWithConcurrency(gates, 2, async (gate, index) => {
    running += 1;
    maxRunning = Math.max(maxRunning, running);
    const value = await gate.promise;
    running -= 1;
    return `${index}:${value}`;
  });

  // Let the first two workers start, then release everything.
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(maxRunning <= 2, `expected at most 2 concurrent workers, saw ${maxRunning}`);
  assert.equal(maxRunning, 2);
  gates.forEach((gate, index) => gate.resolve(`v${index}`));

  const results = await pending;
  assert.deepStrictEqual(results, ['0:v0', '1:v1', '2:v2', '3:v3', '4:v4', '5:v5']);
  assert.equal(maxRunning, 2);
});

test('results keep input order and empty input resolves immediately', async () => {
  const order = await mapWithConcurrency([30, 10, 20], 2, async (ms) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return ms;
  });
  assert.deepStrictEqual(order, [30, 10, 20]);
  assert.deepStrictEqual(await mapWithConcurrency([], 2, async () => 'x'), []);
});

test('an invalid limit falls back to sequential execution', async () => {
  let running = 0;
  let maxRunning = 0;
  const results = await mapWithConcurrency([1, 2, 3], 0, async (value) => {
    running += 1;
    maxRunning = Math.max(maxRunning, running);
    await new Promise((resolve) => setTimeout(resolve, 5));
    running -= 1;
    return value * 2;
  });
  assert.deepStrictEqual(results, [2, 4, 6]);
  assert.equal(maxRunning, 1);
});
