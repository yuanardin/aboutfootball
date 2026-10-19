import assert from 'node:assert/strict';
import test from 'node:test';

import {
  type ArticleFetcherDeps,
  type ArticleHttpRequest,
  type ArticleHttpResponse,
  fetchArticleText,
  isBlockedIp,
  validateArticleUrl,
} from './safe-article-fetch';

function makeResponse(partial: Partial<ArticleHttpResponse> = {}): ArticleHttpResponse {
  return {
    status: 200,
    location: null,
    contentType: 'text/html; charset=utf-8',
    body: '<html><body><h1>Headline</h1><p>A public football article body.</p></body></html>',
    truncated: false,
    ...partial,
  };
}

const PUBLIC_IP = '93.184.216.34';

function makeDeps(overrides: Partial<ArticleFetcherDeps> = {}): ArticleFetcherDeps {
  return {
    resolver: async () => [PUBLIC_IP],
    transport: async () => makeResponse(),
    ...overrides,
  };
}

// --- URL / host validation --------------------------------------------------

test('rejects localhost, private IPv4 and metadata addresses', () => {
  const blocked = [
    'http://127.0.0.1/secret',
    'http://10.0.0.5/',
    'http://192.168.1.1/',
    'http://172.16.0.1/',
    'http://172.31.255.254/',
    'http://169.254.169.254/latest/meta-data/',
    'http://169.254.1.1/',
    'http://0.0.0.0/',
    'http://100.64.0.1/',
    'http://224.0.0.1/',
  ];
  for (const url of blocked) {
    const result = validateArticleUrl(url);
    assert.equal(result.ok, false, `${url} must be rejected`);
    if (!result.ok) {
      assert.ok(
        result.reason === 'private-address' || result.reason === 'host',
        `${url} reason=${result.reason}`
      );
    }
  }
});

test('rejects legacy numeric IPv4 host forms', () => {
  for (const url of [
    'http://2130706433/',
    'http://0x7f000001/',
    'http://017700000001/',
  ]) {
    const result = validateArticleUrl(url);
    assert.equal(result.ok, false, `${url} must be rejected`);
  }
});

test('rejects IPv6 loopback, link-local, ULA and IPv4-mapped forms', () => {
  for (const url of [
    'http://[::1]/',
    'http://[::]/',
    'http://[fe80::1]/',
    'http://[fc00::1]/',
    'http://[fd00:ec2::254]/',
    'http://[ff02::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[2001:db8::1]/',
  ]) {
    const result = validateArticleUrl(url);
    assert.equal(result.ok, false, `${url} must be rejected`);
    if (!result.ok) {
      assert.equal(result.reason, 'private-address', `${url} reason=${result.reason}`);
    }
  }
});

test('rejects credentials, non-http schemes and disallowed ports', () => {
  assert.equal(validateArticleUrl('ftp://example.com/').ok, false);
  assert.equal(validateArticleUrl('file:///etc/passwd').ok, false);
  assert.equal(validateArticleUrl('http://user:pass@example.com/').ok, false);
  assert.equal(validateArticleUrl('http://example.com:8080/').ok, false);
  assert.equal(validateArticleUrl('http://example.com:22/').ok, false);

  const credentials = validateArticleUrl('http://user:pass@example.com/');
  assert.equal(credentials.ok === false && credentials.reason, 'credentials');
  const scheme = validateArticleUrl('ftp://example.com/');
  assert.equal(scheme.ok === false && scheme.reason, 'scheme');
  const port = validateArticleUrl('http://example.com:8080/');
  assert.equal(port.ok === false && port.reason, 'port');
});

test('rejects internal hostnames and single-label hosts', () => {
  for (const host of [
    'http://localhost/',
    'http://sub.localhost/',
    'http://metadata.google.internal/',
    'http://intranet/',
    'http://router.local/',
    'http://service.internal/',
  ]) {
    const result = validateArticleUrl(host);
    assert.equal(result.ok, false, `${host} must be rejected`);
    if (!result.ok) {
      assert.equal(result.reason, 'host', `${host} reason=${result.reason}`);
    }
  }
});

test('accepts a normal public article URL', () => {
  const result = validateArticleUrl('https://www.bbc.com/sport/football/articles/abc123');
  assert.equal(result.ok, true);
});

test('isBlockedIp classifies representative ranges', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '192.168.0.1', '::1', 'fe80::1', 'fc00::1']) {
    assert.equal(isBlockedIp(ip), true, `${ip} must be blocked`);
  }
  for (const ip of ['93.184.216.34', '1.1.1.1', '2606:4700:4700::1111']) {
    assert.equal(isBlockedIp(ip), false, `${ip} must be allowed`);
  }
});

// --- fetch orchestration ----------------------------------------------------

test('private literal target is blocked without any network call', async () => {
  let transportCalls = 0;
  const result = await fetchArticleText(
    'http://169.254.169.254/latest/meta-data/',
    makeDeps({
      transport: async () => {
        transportCalls += 1;
        return makeResponse();
      },
    })
  );
  assert.equal(result.status, 'blocked');
  assert.equal(transportCalls, 0);
});

test('invalid URL is blocked and never reaches the network', async () => {
  let transportCalls = 0;
  const result = await fetchArticleText(
    'not a real url',
    makeDeps({
      transport: async () => {
        transportCalls += 1;
        return makeResponse();
      },
    })
  );
  assert.equal(result.status, 'blocked');
  assert.equal(transportCalls, 0);
});

test('DNS resolving to a private address is blocked before connect', async () => {
  let transportCalls = 0;
  const result = await fetchArticleText(
    'https://rebind.example.com/article',
    makeDeps({
      resolver: async () => ['10.0.0.7'],
      transport: async () => {
        transportCalls += 1;
        return makeResponse();
      },
    })
  );
  assert.equal(result.status, 'blocked');
  assert.equal(transportCalls, 0);
});

test('DNS returning a mix including a private address blocks the whole fetch', async () => {
  let transportCalls = 0;
  const result = await fetchArticleText(
    'https://mixed.example.com/article',
    makeDeps({
      resolver: async () => ['93.184.216.34', '169.254.169.254'],
      transport: async () => {
        transportCalls += 1;
        return makeResponse();
      },
    })
  );
  assert.equal(result.status, 'blocked');
  assert.equal(transportCalls, 0);
});

test('DNS resolution failure is treated as unreadable, not fetched', async () => {
  let transportCalls = 0;
  const result = await fetchArticleText(
    'https://ghost.example.com/article',
    makeDeps({
      resolver: async () => {
        throw new Error('ENOTFOUND');
      },
      transport: async () => {
        transportCalls += 1;
        return makeResponse();
      },
    })
  );
  assert.equal(result.status, 'unreadable');
  assert.equal(transportCalls, 0);
});

test('redirect to a forbidden address is blocked and not fetched', async () => {
  const seen: string[] = [];
  const result = await fetchArticleText(
    'https://news.example.com/article',
    makeDeps({
      resolver: async (hostname) =>
        hostname === 'news.example.com' ? [PUBLIC_IP] : ['10.0.0.1'],
      transport: async (request: ArticleHttpRequest) => {
        seen.push(request.url.href);
        return makeResponse({ status: 302, location: 'http://127.0.0.1/internal', body: '' });
      },
    })
  );
  assert.equal(result.status, 'blocked');
  assert.equal(seen.length, 1, 'must not follow the redirect to the blocked host');
});

test('redirect loop stops at the cap and reports unreadable', async () => {
  let transportCalls = 0;
  const result = await fetchArticleText(
    'https://loop.example.com/a',
    makeDeps({
      maxRedirects: 3,
      transport: async () => {
        transportCalls += 1;
        return makeResponse({ status: 302, location: '/a', body: '' });
      },
    })
  );
  assert.equal(result.status, 'unreadable');
  assert.equal(transportCalls, 4, 'hops = maxRedirects + 1');
});

test('a safe multi-hop redirect to another public host resolves readable', async () => {
  let transportCalls = 0;
  const result = await fetchArticleText(
    'https://start.example.com/a',
    makeDeps({
      transport: async () => {
        transportCalls += 1;
        if (transportCalls === 1) {
          return makeResponse({ status: 301, location: 'https://final.example.com/b', body: '' });
        }
        return makeResponse();
      },
    })
  );
  assert.equal(result.status, 'readable');
  if (result.status === 'readable') {
    assert.match(result.text, /Headline/);
    assert.match(result.text, /public football article body/);
  }
});

test('timeout aborts the request and reports unreadable', async () => {
  const result = await fetchArticleText(
    'https://slow.example.com/article',
    makeDeps({
      timeoutMs: 25,
      transport: (request) =>
        new Promise<ArticleHttpResponse>((_resolve, reject) => {
          request.signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    })
  );
  assert.equal(result.status, 'unreadable');
});

test('oversized body is rejected as unreadable', async () => {
  const result = await fetchArticleText(
    'https://big.example.com/article',
    makeDeps({
      transport: async () => makeResponse({ body: '<html>partial', truncated: true }),
    })
  );
  assert.equal(result.status, 'unreadable');
});

test('non-HTML content type is rejected as unreadable', async () => {
  const result = await fetchArticleText(
    'https://files.example.com/report.pdf',
    makeDeps({
      transport: async () => makeResponse({ contentType: 'application/pdf', body: '%PDF-1.7' }),
    })
  );
  assert.equal(result.status, 'unreadable');
});

test('a valid public article returns readable text and pins a validated IP', async () => {
  const captured: { request: ArticleHttpRequest | null } = { request: null };
  const result = await fetchArticleText(
    'https://news.example.com/article',
    makeDeps({
      resolver: async () => [PUBLIC_IP],
      transport: async (request) => {
        captured.request = request;
        return makeResponse();
      },
    })
  );
  assert.equal(result.status, 'readable');
  assert.ok(captured.request);
  const request = captured.request as ArticleHttpRequest;
  assert.deepEqual(request.resolvedIps, [PUBLIC_IP]);
  assert.ok(request.maxBytes > 0);
});
