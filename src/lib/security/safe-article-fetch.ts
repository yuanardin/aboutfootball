// SSRF-safe article fetcher for the AI summarizer.
//
// Threat model: the summarizer lets a visitor hand us an arbitrary URL, and we
// fetch it server-side. Without checks that is a Server-Side Request Forgery
// primitive: `http://127.0.0.1`, `http://169.254.169.254/...` (cloud metadata),
// internal RFC1918 hosts, DNS names that resolve to private space, and blind
// `redirect: 'follow'` that bounces a "safe" URL into a private one.
//
// Design goals (all enforced here, never bypassed by a fallback):
// - Only http/https, no URL credentials, only the default/80/443 ports.
// - Reject loopback, private, link-local, CGNAT, multicast, reserved, and
//   metadata addresses for both IPv4 and IPv6 (including legacy numeric IPv4
//   host forms like `2130706433`, `0x7f000001`, `017700000001`).
// - Resolve A/AAAA ourselves, validate EVERY answer, then pin the socket to a
//   validated address via a custom `lookup`, so a DNS-rebinding answer that
//   changes between our check and the connect cannot reach a private IP.
// - Follow redirects manually with a small cap and re-validate each hop; no
//   blind `redirect: 'follow'`.
// - Strict timeout, hard body-size cap, content-type check, and a character cap
//   on the text handed to Gemini.
// - Never forward cookies/authorization or any caller-supplied header.
//
// This module is intentionally free of `server-only` and of network side
// effects at import time so it can be unit-tested with node:test. Node's
// http/https modules are imported statically (they perform no I/O on import),
// and the DNS dependency is loaded lazily inside the default deps factory.
// Tests inject their own resolver and transport.
//
// Fail closed: anything we cannot positively classify as a public target is
// blocked (unknown IP forms, single-label hostnames, missing/invalid DNS).

import { isIP } from 'node:net';
import { request as httpRequest, type RequestOptions } from 'node:http';
import { request as httpsRequest } from 'node:https';

export const MAX_ARTICLE_CHARS = 20_000;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_MAX_BYTES = 2_000_000;

const ALLOWED_PORTS = new Set(['', '80', '443']);

export type BlockReason =
  | 'invalid'
  | 'scheme'
  | 'credentials'
  | 'port'
  | 'host'
  | 'private-address';

export class UnsafeArticleUrlError extends Error {
  constructor(public readonly reason: BlockReason) {
    super(`Unsafe or unsupported article URL (${reason}).`);
    this.name = 'UnsafeArticleUrlError';
  }
}

// --- IPv4 classification ----------------------------------------------------

function parseDottedIpv4(host: string): number[] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const parts = match.slice(1).map((value) => Number(value));
  if (parts.some((value) => value > 255)) return null;
  return parts;
}

// Parses the legacy inet_aton forms (`a.b.c.d`, `a.b.c`, `a.b`, `a`) where the
// trailing component may be decimal, octal (leading 0) or hex (0x). Returns
// bytes or null when the host is not a numeric IPv4 literal at all.
function parseLegacyIpv4(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length === 0 || parts.length > 4) return null;

  const numbers: number[] = [];
  for (const part of parts) {
    if (part === '') return null;
    let value: number;
    if (/^0x[0-9a-f]+$/i.test(part)) {
      value = Number.parseInt(part.slice(2), 16);
    } else if (/^0[0-7]+$/.test(part)) {
      value = Number.parseInt(part.slice(1), 8);
    } else if (/^\d+$/.test(part)) {
      value = Number.parseInt(part, 10);
    } else {
      return null;
    }
    if (!Number.isFinite(value) || value < 0) return null;
    numbers.push(value);
  }

  const last = numbers.pop() as number;
  const maxLast = 2 ** (8 * (4 - numbers.length)) - 1;
  if (last > maxLast) return null;
  if (numbers.some((value) => value > 255)) return null;

  const bytes: number[] = [];
  for (const value of numbers) bytes.push(value);
  const remaining = 4 - bytes.length;
  for (let index = 0; index < remaining; index += 1) {
    const shift = 8 * (remaining - 1 - index);
    bytes.push((last >> shift) & 0xff);
  }
  return bytes;
}

function isBlockedIpv4Bytes(bytes: number[]): boolean {
  const [a, b] = bytes;
  if (a === 0) return true; // 0.0.0.0/8 "this network" / unspecified
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local (incl. 169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 192 && b === 0 && bytes[2] === 0) return true; // IETF protocol
  if (a === 192 && b === 0 && bytes[2] === 2) return true; // TEST-NET-1
  if (a === 192 && b === 88 && bytes[2] === 99) return true; // 6to4 relay anycast
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && bytes[2] === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && bytes[2] === 113) return true; // TEST-NET-3
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

// --- IPv6 classification ----------------------------------------------------

function expandIpv6(ip: string): number[] | null {
  let value = ip;
  const zoneIndex = value.indexOf('%');
  if (zoneIndex !== -1) value = value.slice(0, zoneIndex);

  // Split an optional embedded IPv4 tail (e.g. ::ffff:127.0.0.1).
  let v4Tail: number[] | null = null;
  const lastColon = value.lastIndexOf(':');
  const tail = value.slice(lastColon + 1);
  if (tail.includes('.')) {
    v4Tail = parseDottedIpv4(tail);
    if (!v4Tail) return null;
    const hexTail = `${((v4Tail[0] << 8) | v4Tail[1]).toString(16)}:${((v4Tail[2] << 8) | v4Tail[3]).toString(16)}`;
    value = value.slice(0, lastColon + 1) + hexTail;
  }

  const doubleColon = value.indexOf('::');
  let head: string[];
  let tailParts: string[];
  if (doubleColon === -1) {
    head = value.split(':');
    tailParts = [];
  } else {
    head = value.slice(0, doubleColon).split(':').filter(Boolean);
    tailParts = value.slice(doubleColon + 2).split(':').filter(Boolean);
  }

  const missing = 8 - (head.length + tailParts.length);
  if (doubleColon === -1 && missing !== 0) return null;
  if (doubleColon !== -1 && missing < 0) return null;

  const groups = [...head, ...Array.from({ length: missing }, () => '0'), ...tailParts];
  if (groups.length !== 8) return null;

  const bytes: number[] = [];
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(group)) return null;
    const parsed = Number.parseInt(group, 16);
    bytes.push((parsed >> 8) & 0xff, parsed & 0xff);
  }
  return bytes;
}

function isBlockedIpv6Bytes(bytes: number[]): boolean {
  const isZeroPrefix = bytes.slice(0, 10).every((value) => value === 0);
  // ::1 loopback / :: unspecified
  if (bytes.slice(0, 15).every((value) => value === 0)) return true;
  // IPv4-mapped ::ffff:a.b.c.d
  if (isZeroPrefix && bytes[10] === 0xff && bytes[11] === 0xff) {
    return isBlockedIpv4Bytes(bytes.slice(12));
  }
  // IPv4-compatible ::a.b.c.d (deprecated)
  if (isZeroPrefix && bytes[10] === 0 && bytes[11] === 0) {
    return isBlockedIpv4Bytes(bytes.slice(12));
  }
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true; // link-local fe80::/10
  if ((bytes[0] & 0xfe) === 0xfc) return true; // unique-local fc00::/7
  if (bytes[0] === 0xff) return true; // multicast
  // 6to4 2002::/16 embeds an IPv4 address in bytes 2..5
  if (bytes[0] === 0x20 && bytes[1] === 0x02) {
    return isBlockedIpv4Bytes(bytes.slice(2, 6));
  }
  // NAT64 64:ff9b::/96 embeds an IPv4 address in bytes 12..15
  if (
    bytes[0] === 0x00 &&
    bytes[1] === 0x64 &&
    bytes[2] === 0xff &&
    bytes[3] === 0x9b &&
    bytes.slice(4, 12).every((value) => value === 0)
  ) {
    return isBlockedIpv4Bytes(bytes.slice(12));
  }
  // Documentation 2001:db8::/32
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) {
    return true;
  }
  return false;
}

/** True when `ip` is a valid address that must never be fetched. */
export function isBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const bytes = parseDottedIpv4(ip);
    return bytes ? isBlockedIpv4Bytes(bytes) : true;
  }
  if (version === 6) {
    const bytes = expandIpv6(ip);
    return bytes ? isBlockedIpv6Bytes(bytes) : true;
  }
  return true; // fail closed on anything we cannot parse
}

// --- URL + hostname validation ----------------------------------------------

/** Normalizes a hostname to a canonical IP literal, or null if it is a name. */
export function normalizeIpLiteral(host: string): string | null {
  if (isIP(host)) return host;
  const legacy = parseLegacyIpv4(host);
  if (legacy) return legacy.join('.');
  return null;
}

function normalizeHostname(rawHostname: string): string {
  let hostname = rawHostname.trim().toLowerCase();
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }
  return hostname;
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'instance-data',
]);

export function isBlockedHostname(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;
  if (hostname.endsWith('.localhost')) return true;
  if (hostname.endsWith('.internal')) return true;
  if (hostname.endsWith('.local')) return true;
  // A single-label name is an internal/NetBIOS-style host, never a public site.
  if (!hostname.includes('.')) return true;
  return false;
}

export type UrlValidation = { ok: true; url: URL } | { ok: false; reason: BlockReason };

export function validateArticleUrl(raw: string): UrlValidation {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'scheme' };
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'credentials' };
  }
  if (url.port && !ALLOWED_PORTS.has(url.port)) {
    return { ok: false, reason: 'port' };
  }

  const hostname = normalizeHostname(url.hostname);
  if (!hostname) {
    return { ok: false, reason: 'host' };
  }

  const literal = normalizeIpLiteral(hostname);
  if (literal) {
    return isBlockedIp(literal) ? { ok: false, reason: 'private-address' } : { ok: true, url };
  }

  if (isBlockedHostname(hostname)) {
    return { ok: false, reason: 'host' };
  }

  return { ok: true, url };
}

// --- DNS validation ---------------------------------------------------------

export type DnsResolver = (hostname: string) => Promise<string[]>;

export type ResolveResult =
  | { status: 'ok'; ips: string[] }
  | { status: 'blocked'; reason: BlockReason }
  | { status: 'dns-error' };

export async function resolveAndValidate(
  hostnameRaw: string,
  resolver: DnsResolver
): Promise<ResolveResult> {
  const hostname = normalizeHostname(hostnameRaw);
  const literal = normalizeIpLiteral(hostname);
  if (literal) {
    return isBlockedIp(literal)
      ? { status: 'blocked', reason: 'private-address' }
      : { status: 'ok', ips: [literal] };
  }

  let addresses: string[];
  try {
    addresses = await resolver(hostname);
  } catch {
    return { status: 'dns-error' };
  }
  if (!addresses.length) {
    return { status: 'dns-error' };
  }

  const normalized: string[] = [];
  for (const address of addresses) {
    const ip = normalizeIpLiteral(address) ?? address;
    if (!isIP(ip)) {
      return { status: 'blocked', reason: 'host' }; // fail closed on unknown answer
    }
    if (isBlockedIp(ip)) {
      return { status: 'blocked', reason: 'private-address' };
    }
    normalized.push(ip);
  }

  return { status: 'ok', ips: normalized };
}

// --- Transport (network I/O) ------------------------------------------------

export type ArticleHttpRequest = {
  url: URL;
  resolvedIps: string[];
  signal: AbortSignal;
  maxBytes: number;
};

export type ArticleHttpResponse = {
  status: number;
  location: string | null;
  contentType: string | null;
  body: string;
  truncated: boolean;
};

export type ArticleHttpTransport = (request: ArticleHttpRequest) => Promise<ArticleHttpResponse>;

type PinnedLookup = (
  hostname: string,
  options: { all?: boolean } | undefined,
  callback: (error: NodeJS.ErrnoException | null, address: unknown, family?: number) => void
) => void;

// Production transport: a single non-following GET whose DNS lookup is pinned
// to the already-validated addresses, so the socket can never be rebound to a
// private IP between validation and connect. `agent: false` avoids a shared
// keep-alive socket that would bypass the pinned lookup.
export function createNodeTransport(): ArticleHttpTransport {
  return (request) =>
    new Promise<ArticleHttpResponse>((resolve, reject) => {
      const isHttps = request.url.protocol === 'https:';
      const requestFn = (isHttps ? httpsRequest : httpRequest) as unknown as (
        input: URL,
        options: RequestOptions,
        callback: (response: import('node:http').IncomingMessage) => void
      ) => import('node:http').ClientRequest;

      let settled = false;
      const settle = (action: () => void) => {
        if (settled) return;
        settled = true;
        action();
      };

      const pinned = request.resolvedIps;
      const lookup: PinnedLookup = (_hostname, options, callback) => {
        if (options && options.all) {
          callback(
            null,
            pinned.map((address) => ({ address, family: isIP(address) })),
            0
          );
          return;
        }
        const first = pinned[0];
        callback(null, first, isIP(first));
      };

      const nodeRequest = requestFn(
        request.url,
        {
          method: 'GET',
          agent: false,
          signal: request.signal,
          lookup: lookup as unknown as RequestOptions['lookup'],
          headers: {
            'User-Agent': 'ScoreCastNewsBot/1.0 (+https://scorecast.app)',
            Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'identity',
          },
        },
        (response) => {
          const status = response.statusCode ?? 0;
          const location = response.headers.location ?? null;
          const contentType = response.headers['content-type'] ?? null;
          const chunks: Buffer[] = [];
          let bytes = 0;

          response.on('data', (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > request.maxBytes) {
              response.destroy();
              settle(() =>
                resolve({
                  status,
                  location,
                  contentType,
                  body: Buffer.concat(chunks).toString('utf8'),
                  truncated: true,
                })
              );
              return;
            }
            chunks.push(chunk);
          });

          response.on('end', () => {
            settle(() =>
              resolve({
                status,
                location,
                contentType,
                body: Buffer.concat(chunks).toString('utf8'),
                truncated: false,
              })
            );
          });

          response.on('error', (error) => settle(() => reject(error)));
        }
      );

      nodeRequest.on('error', (error) => settle(() => reject(error)));
      nodeRequest.end();
    });
}

async function defaultDnsResolver(hostname: string): Promise<string[]> {
  const { lookup } = await import('node:dns/promises');
  const results = await lookup(hostname, { all: true });
  return results.map((result) => result.address);
}

export type ArticleFetcherDeps = {
  resolver: DnsResolver;
  transport: ArticleHttpTransport;
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
};

export function createDefaultArticleFetcherDeps(): ArticleFetcherDeps {
  return { resolver: defaultDnsResolver, transport: createNodeTransport() };
}

// --- Orchestration ----------------------------------------------------------

export type ArticleFetchResult =
  | { status: 'readable'; text: string }
  | { status: 'unreadable' }
  | { status: 'blocked'; reason: BlockReason };

/**
 * Fetches a public article URL and returns its readable text, or a classified
 * failure. Redirects are followed manually (each hop re-validated) and the
 * whole thing is bounded by timeout, redirect cap, and body-size cap. There is
 * no fallback path that skips validation.
 */
export async function fetchArticleText(
  rawUrl: string,
  deps: ArticleFetcherDeps
): Promise<ArticleFetchResult> {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = deps.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxBytes = deps.maxBytes ?? DEFAULT_MAX_BYTES;

  let currentUrl = rawUrl;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const validation = validateArticleUrl(currentUrl);
    if (!validation.ok) {
      return { status: 'blocked', reason: validation.reason };
    }

    const resolved = await resolveAndValidate(validation.url.hostname, deps.resolver);
    if (resolved.status === 'blocked') {
      return { status: 'blocked', reason: resolved.reason };
    }
    if (resolved.status === 'dns-error') {
      return { status: 'unreadable' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: ArticleHttpResponse;
    try {
      response = await deps.transport({
        url: validation.url,
        resolvedIps: resolved.ips,
        signal: controller.signal,
        maxBytes,
      });
    } catch {
      return { status: 'unreadable' };
    } finally {
      clearTimeout(timer);
    }

    if (response.truncated) {
      return { status: 'unreadable' };
    }

    if (response.status >= 300 && response.status < 400) {
      if (!response.location) {
        return { status: 'unreadable' };
      }
      let next: URL;
      try {
        next = new URL(response.location, validation.url);
      } catch {
        return { status: 'blocked', reason: 'host' };
      }
      currentUrl = next.toString();
      continue;
    }

    if (response.status !== 200) {
      return { status: 'unreadable' };
    }

    const contentType = (response.contentType ?? '').toLowerCase();
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return { status: 'unreadable' };
    }

    const text = extractReadableText(response.body);
    if (!text) {
      return { status: 'unreadable' };
    }
    return { status: 'readable', text };
  }

  return { status: 'unreadable' }; // redirect cap exceeded
}

// --- HTML → readable text (pure) --------------------------------------------

export function extractReadableText(html: string): string {
  const removed = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|nav|header|footer|aside|form|button)[^>]*>[\s\S]*?<\/\1>/gi, ' ');

  const withoutTags = removed
    // Turn block elements into line breaks so paragraphs survive tag stripping.
    .replace(/(<\/?(p|div|li|h[1-6]|section|article|blockquote|tr)>)/gi, '\n$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return decodeEntities(withoutTags)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
    .slice(0, MAX_ARTICLE_CHARS);
}

function decodeEntities(text: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&ndash;': '–',
    '&mdash;': '—',
    '&hellip;': '…',
  };
  return text.replace(/&[a-z]+;|&#\d+;/gi, (match) => entities[match.toLowerCase()] ?? match);
}
