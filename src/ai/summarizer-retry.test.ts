import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SUMMARIZER_BUSY_MESSAGE,
  SUMMARIZER_UNAVAILABLE_MESSAGE,
  classifyModelError,
  computeRetryDelayMs,
  runWithModelRetry,
  toSummarizerUserMessage,
} from './summarizer-retry';

// Mirrors the real plugin failure shape: client.ts throws
// `Error fetching from <url>: [503 Service Unavailable] <detail>` and its
// own catch rethrows, preserving the bracketed status in the message.
function pluginError(status: number, statusText: string, detail: string): Error {
  return new Error(
    `Failed to fetch from https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent: [${status} ${statusText}] ${detail}`
  );
}

function production503(): Error {
  return pluginError(503, 'Service Unavailable', 'This model is currently experiencing high demand.');
}

type TestOptions = {
  sleeps: number[];
};

function mockHarness(extra?: { budget?: number; base?: number }) {
  const state: TestOptions = { sleeps: [] };
  const options = {
    baseDelayMs: extra?.base ?? 10,
    maxDelayMs: 50,
    retryBudgetMs: extra?.budget ?? 1_000,
    jitterRatio: 0,
    sleep: async (ms: number) => {
      state.sleeps.push(ms);
    },
  };
  return { state, options };
}

test('503 then success on retry returns the result unchanged', async () => {
  const { state, options } = mockHarness();
  let calls = 0;
  const result = await runWithModelRetry(async () => {
    calls += 1;
    if (calls === 1) throw production503();
    return { summary: 'ok', title: 't', keyTakeaways: ['a'] };
  }, options);
  assert.equal(calls, 2);
  assert.deepStrictEqual(result, { summary: 'ok', title: 't', keyTakeaways: ['a'] });
  assert.equal(state.sleeps.length, 1);
});

test('repeated 503 stops after one retry and stays transient', async () => {
  const { state, options } = mockHarness();
  let calls = 0;
  await assert.rejects(
    runWithModelRetry(async () => {
      calls += 1;
      throw production503();
    }, options),
    (error: unknown) => {
      assert.equal(classifyModelError(error), 'transient');
      assert.equal(toSummarizerUserMessage(error), SUMMARIZER_BUSY_MESSAGE);
      return true;
    }
  );
  assert.equal(calls, 2);
  assert.equal(state.sleeps.length, 1);
});

test('400/401/403 are never retried', async () => {
  for (const [status, text] of [
    [400, 'Bad Request'],
    [401, 'Unauthorized'],
    [403, 'Forbidden'],
  ] as const) {
    const { state, options } = mockHarness();
    let calls = 0;
    await assert.rejects(
      runWithModelRetry(async () => {
        calls += 1;
        throw pluginError(status, text, 'request rejected');
      }, options),
      (error: unknown) => {
        assert.equal(classifyModelError(error), 'permanent');
        assert.equal(toSummarizerUserMessage(error), SUMMARIZER_UNAVAILABLE_MESSAGE);
        return true;
      }
    );
    assert.equal(calls, 1, `status ${status} must not be retried`);
    assert.equal(state.sleeps.length, 0);
  }
});

test('timeout and network errors are transient and retried once', async () => {
  for (const failure of [
    new Error('Failed to fetch from https://generativelanguage.googleapis.com/: fetch failed'),
    new Error('football summarizer timed out'),
    Object.assign(new Error('aborted'), { name: 'AbortError' }),
  ]) {
    const { options } = mockHarness();
    let calls = 0;
    const value = await runWithModelRetry(async () => {
      calls += 1;
      if (calls === 1) throw failure;
      return 'recovered';
    }, options);
    assert.equal(value, 'recovered');
    assert.equal(calls, 2);
  }
});

test('no duplicated requests: at most one retry, budget caps total delay', async () => {
  const { state, options } = mockHarness({ budget: 5, base: 10 });
  let calls = 0;
  await assert.rejects(
    runWithModelRetry(async () => {
      calls += 1;
      throw production503();
    }, options)
  );
  // Initial call + exactly one retry, then the budget is exhausted.
  assert.equal(calls, 2);
  assert.ok(state.sleeps.length <= 1);
  assert.ok(state.sleeps.every((ms) => ms <= 5));
});

test('exhausted budget stops without another request', async () => {
  const { state, options } = mockHarness({ budget: 0 });
  let calls = 0;
  await assert.rejects(
    runWithModelRetry(async () => {
      calls += 1;
      throw production503();
    }, options)
  );
  assert.equal(calls, 1);
  assert.equal(state.sleeps.length, 0);
});

test('unknown errors are not retried and keep the generic message', async () => {
  const { state, options } = mockHarness();
  let calls = 0;
  await assert.rejects(
    runWithModelRetry(async () => {
      calls += 1;
      throw new Error('something completely unexpected');
    }, options)
  );
  assert.equal(calls, 1);
  assert.equal(state.sleeps.length, 0);
  assert.equal(toSummarizerUserMessage(new Error('something completely unexpected')), SUMMARIZER_UNAVAILABLE_MESSAGE);
});

test('backoff is exponential, capped, and deterministic without jitter', () => {
  assert.equal(computeRetryDelayMs(0, { baseDelayMs: 1500, maxDelayMs: 8000, jitterRatio: 0 }), 1500);
  assert.equal(computeRetryDelayMs(1, { baseDelayMs: 1500, maxDelayMs: 8000, jitterRatio: 0 }), 3000);
  assert.equal(computeRetryDelayMs(10, { baseDelayMs: 1500, maxDelayMs: 8000, jitterRatio: 0 }), 8000);
  const jittered = computeRetryDelayMs(0, { baseDelayMs: 1000, maxDelayMs: 8000, jitterRatio: 0.25 });
  assert.ok(jittered >= 750 && jittered <= 1250, `expected jittered delay near 1000, saw ${jittered}`);
});

test('production default allows exactly one retry within budget', async () => {
  const sleeps: number[] = [];
  let calls = 0;
  await assert.rejects(
    runWithModelRetry(
      async () => {
        calls += 1;
        throw production503();
      },
      { jitterRatio: 0, sleep: async (ms: number) => void sleeps.push(ms) }
    )
  );
  assert.equal(calls, 2);
  assert.equal(sleeps.length, 1);
  assert.ok(sleeps[0] >= 1 && sleeps[0] <= 10_000, `retry delay out of budget: ${sleeps[0]}`);
});
