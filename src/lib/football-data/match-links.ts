import type { FootballDataMatchStatus, MatchDetailBadge } from './types';

// Canonical status description for the /matches/[id] page. Raw provider
// statuses are never invented or re-timed: SCHEDULED/TIMED stay upcoming,
// IN_PLAY/PAUSED stay live, FINISHED/AWARDED stay full time, and the
// postponed/suspended/cancelled states keep their own labels.
//
// Client-safe: this module never touches the network, the cache or any
// server-only code, so UI components (MatchCard, notifications) can import it.
export function describeMatchStatus(status: FootballDataMatchStatus): {
  badge: MatchDetailBadge;
  label: string;
  isLive: boolean;
} {
  switch (status) {
    case 'IN_PLAY':
      return { badge: 'LIVE', label: 'In play', isLive: true };
    case 'PAUSED':
      return { badge: 'LIVE', label: 'Half time', isLive: true };
    case 'FINISHED':
    case 'AWARDED':
      return { badge: 'FT', label: 'Full time', isLive: false };
    case 'POSTPONED':
      return { badge: 'POSTPONED', label: 'Postponed', isLive: false };
    case 'SUSPENDED':
      return { badge: 'SUSPENDED', label: 'Suspended', isLive: false };
    case 'CANCELLED':
      return { badge: 'CANCELLED', label: 'Cancelled', isLive: false };
    case 'SCHEDULED':
    case 'TIMED':
    default:
      return { badge: 'UPCOMING', label: 'Upcoming', isLive: false };
  }
}

// Validates a /matches/[id] route parameter. Anything that is not a positive
// integer is treated as "not found" by the page, never fetched.
export function parseMatchRouteId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || !value) return null;
  if (!/^\d+$/.test(value.trim())) return null;
  const id = Number.parseInt(value.trim(), 10);
  if (!Number.isInteger(id) || id <= 0 || id > 10_000_000) return null;
  return id;
}

export function matchDetailPath(matchId: number | string): string {
  return `/matches/${matchId}`;
}

// MatchResult ids are namespaced (`fd-123`); team-match DTOs carry the raw
// numeric id. Both resolve to a detail path, anything else resolves to null
// so cards without a real provider id never render a broken link.
export function toMatchDetailPath(id: string | number | undefined | null): string | null {
  if (typeof id === 'number') {
    return Number.isInteger(id) && id > 0 ? matchDetailPath(id) : null;
  }
  if (typeof id !== 'string' || !id) return null;
  const numeric = Number.parseInt(id.replace(/^fd-/, ''), 10);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return matchDetailPath(numeric);
}
