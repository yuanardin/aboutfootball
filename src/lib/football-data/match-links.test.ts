import assert from 'node:assert/strict';
import test from 'node:test';

import {
  describeMatchStatus,
  parseMatchRouteId,
  toMatchDetailPath,
} from './match-links';

test('match statuses map to the required display buckets', () => {
  assert.deepStrictEqual(describeMatchStatus('SCHEDULED'), {
    badge: 'UPCOMING',
    label: 'Upcoming',
    isLive: false,
  });
  assert.deepStrictEqual(describeMatchStatus('TIMED'), {
    badge: 'UPCOMING',
    label: 'Upcoming',
    isLive: false,
  });
  assert.deepStrictEqual(describeMatchStatus('IN_PLAY'), {
    badge: 'LIVE',
    label: 'In play',
    isLive: true,
  });
  assert.deepStrictEqual(describeMatchStatus('PAUSED'), {
    badge: 'LIVE',
    label: 'Half time',
    isLive: true,
  });
  assert.deepStrictEqual(describeMatchStatus('FINISHED'), {
    badge: 'FT',
    label: 'Full time',
    isLive: false,
  });
  assert.deepStrictEqual(describeMatchStatus('AWARDED'), {
    badge: 'FT',
    label: 'Full time',
    isLive: false,
  });
  assert.deepStrictEqual(describeMatchStatus('POSTPONED'), {
    badge: 'POSTPONED',
    label: 'Postponed',
    isLive: false,
  });
  assert.deepStrictEqual(describeMatchStatus('SUSPENDED'), {
    badge: 'SUSPENDED',
    label: 'Suspended',
    isLive: false,
  });
  assert.deepStrictEqual(describeMatchStatus('CANCELLED'), {
    badge: 'CANCELLED',
    label: 'Cancelled',
    isLive: false,
  });
});

test('match route ids only accept positive integers', () => {
  assert.equal(parseMatchRouteId('123'), 123);
  assert.equal(parseMatchRouteId('abc'), null);
  assert.equal(parseMatchRouteId('12ab'), null);
  assert.equal(parseMatchRouteId('-5'), null);
  assert.equal(parseMatchRouteId('0'), null);
  assert.equal(parseMatchRouteId(''), null);
  assert.equal(parseMatchRouteId(undefined), null);
});

test('match cards resolve to detail paths without broken links', () => {
  assert.equal(toMatchDetailPath('fd-123'), '/matches/123');
  assert.equal(toMatchDetailPath(456), '/matches/456');
  assert.equal(toMatchDetailPath('nope'), null);
  assert.equal(toMatchDetailPath(null), null);
  assert.equal(toMatchDetailPath(-3), null);
});
