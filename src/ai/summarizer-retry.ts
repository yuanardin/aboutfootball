// Controlled retry for transient Gemini model errors (e.g. 503 high demand).
//
// Client-safe: pure error classification plus timing, no genkit/network/
// server-only imports, so it is unit-testable with node:test like the
// football-data helpers.
//
// Why this module exists: the @genkit-ai/google-genai plugin (v1.20.0)
// performs a single fetch per generateContent call and neither it nor the
// genkit core performs any automatic retry (verified by audit of
// node_modules/@genkit-ai/{google-genai,core}/src). A 503 therefore fails
// the summarizer on the first attempt. This module adds exactly ONE bounded
// application-level retry for transient failures only, so there is no
// layered/duplicated retry between SDK and app.
//
// What is retried: 503/UNAVAILABLE (+429/RESOURCE_EXHAUSTED, which is the
// same transient overload family), timeouts, and network failures.
// What is NEVER retried: 400/401/403/404 and other permanent config, auth,
// validation, or not-found errors (INVALID_ARGUMENT, UNAUTHENTICATED,
// PERMISSION_DENIED, NOT_FOUND, ...), plus anything unrecognized.

export type ModelErrorKind = 'transient' | 'permanent' | 'unknown';

function readStatus(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'string' && status.length > 0) {
      return status.toUpperCase();
    }
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return code.toUpperCase();
    }
  }
  return '';
}

function readHaystack(error: unknown): string {
  if (error instanceof Error) return `${error.name} ${error.message}`;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    const record = error as { message?: unknown; name?: unknown };
    const name = typeof record.name === 'string' ? record.name : '';
    const message = typeof record.message === 'string' ? record.message : '';
    return `${name} ${message}`.trim();
  }
  return '';
}

const TRANSIENT_STATUSES = new Set([
  'UNAVAILABLE', // 503 / high demand — the production failure being fixed.
  'RESOURCE_EXHAUSTED', // 429 — same transient overload family.
  'ABORTED', // Client should retry at a higher level.
  'DEADLINE_EXCEEDED', // Timeout at the provider.
]);

const PERMANENT_STATUSES = new Set([
  'INVALID_ARGUMENT', // 400 — retrying cannot fix the request.
  'FAILED_PRECONDITION', // 400 — retrying cannot fix the state.
  'UNAUTHENTICATED', // 401 — key/config problem, never transient.
  'PERMISSION_DENIED', // 403 — key/scope problem, never transient.
  'NOT_FOUND', // 404 — wrong model/resource name, never transient.
  'ALREADY_EXISTS',
  'CANCELLED',
]);

// Bracketed "[503 ...]" / "[429 ...]" come from the plugin's own error
// format (`Error fetching from <url>: [<status> <text>] <detail>`), which it
// preserves through its rethrow, so matching the bracket keeps the signal
// precise instead of matching stray digits elsewhere in a message.
const TRANSIENT_MESSAGE_PATTERNS = [
  /\[(503|429)\b/,
  /\bUNAVAILABLE\b/i,
  /\bRESOURCE_EXHAUSTED\b/i,
  /service unavailable/i,
  /high demand/i,
  /\boverloaded\b/i,
  /try again later/i,
  /temporarily unavailable/i,
  /\btimeout\b/i,
  /timed out/i,
  /deadline exceeded/i,
  /aborterror/i,
  /fetch failed/i,
  /\bnetwork\b/i,
  /socket hang up/i,
  /ECONN[A-Z]*/,
  /ETIMEDOUT/,
  /ENOTFOUND/,
  /EAI_AGAIN/,
];

const PERMANENT_MESSAGE_PATTERNS = [
  /\[(400|401|403|404)\b/,
  /\bINVALID_ARGUMENT\b/i,
  /\bUNAUTHENTICATED\b/i,
  /\bPERMISSION_DENIED\b/i,
  /permission denied/i,
  /API key/i,
  /\bnot found\b/i,
  /model not found/i,
];

export function classifyModelError(error: unknown): ModelErrorKind {
  const status = readStatus(error);
  if (status) {
    if (TRANSIENT_STATUSES.has(status)) return 'transient';
    if (PERMANENT_STATUSES.has(status)) return 'permanent';
  }
  const message = readHaystack(error);
  if (message) {
    // Permanent first: a message can mention both (e.g. "got 503 while
    // reporting 401" wrappers), and a permanent root cause must win so it is
    // never retried.
    if (PERMANENT_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) {
      return 'permanent';
    }
    if (TRANSIENT_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) {
      return 'transient';
    }
  }
  return 'unknown';
}

export function isTransientModelError(error: unknown): boolean {
  return classifyModelError(error) === 'transient';
}

export type RetryOptions = {
  /** Extra attempts after the first call. Exactly 1 by default — never more. */
  maxRetries?: number;
  /** Base backoff delay before the first retry. Defaults to 1500ms. */
  baseDelayMs?: number;
  /** Hard cap for a single computed delay. Defaults to 8000ms. */
  maxDelayMs?: number;
  /** Total sleep budget across all retries; when exhausted, stop retrying. */
  retryBudgetMs?: number;
  /** Jitter fraction applied to the delay (0 disables, for tests). Default 0.25. */
  jitterRatio?: number;
  sleep?: (ms: number) => Promise<void>;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
};

const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_BASE_DELAY_MS = 1_500;
const DEFAULT_MAX_DELAY_MS = 8_000;
const DEFAULT_RETRY_BUDGET_MS = 10_000;
const DEFAULT_JITTER_RATIO = 0.25;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function computeRetryDelayMs(
  attempt: number,
  options?: Pick<RetryOptions, 'baseDelayMs' | 'maxDelayMs' | 'jitterRatio'>
): number {
  const base = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const cap = options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const jitterRatio = options?.jitterRatio ?? DEFAULT_JITTER_RATIO;
  const exponential = base * 2 ** attempt;
  const jittered =
    jitterRatio > 0
      ? exponential * (1 - jitterRatio + Math.random() * jitterRatio * 2)
      : exponential;
  return Math.max(0, Math.min(Math.round(jittered), cap));
}

/**
 * Runs `fn` once, retrying at most `maxRetries` times (default 1) when
 * `shouldRetry` accepts the failure (default: transient model errors only).
 * Backoff is exponential with jitter and bounded by `retryBudgetMs`, so the
 * total extra time is capped and retries can never loop forever.
 */
export async function runWithModelRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const maxRetries = Math.max(0, Math.floor(options?.maxRetries ?? DEFAULT_MAX_RETRIES));
  const budget = options?.retryBudgetMs ?? DEFAULT_RETRY_BUDGET_MS;
  const sleep = options?.sleep ?? defaultSleep;
  const shouldRetry =
    options?.shouldRetry ?? ((error: unknown) => isTransientModelError(error));

  let attempt = 0;
  let sleptMs = 0;
  for (;;) {
    try {
      return await fn(attempt);
    } catch (error) {
      if (attempt >= maxRetries || !shouldRetry(error, attempt)) {
        throw error;
      }
      const delay = Math.min(
        computeRetryDelayMs(attempt, options),
        Math.max(0, budget - sleptMs)
      );
      if (delay <= 0) {
        throw error;
      }
      await sleep(delay);
      sleptMs += delay;
      attempt += 1;
    }
  }
}

export const SUMMARIZER_BUSY_MESSAGE =
  'The AI summarizer is busy right now due to high demand. Please try again in a moment.';

export const SUMMARIZER_UNAVAILABLE_MESSAGE =
  'An error occurred while summarizing the article. The AI model might be unavailable.';

export function toSummarizerUserMessage(error: unknown): string {
  if (isTransientModelError(error)) {
    return SUMMARIZER_BUSY_MESSAGE;
  }
  return SUMMARIZER_UNAVAILABLE_MESSAGE;
}
