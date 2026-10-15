import type { Firestore } from 'firebase/firestore';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import type { TeamMatchesResult } from '@/lib/football-data/service';

// Match alerts live in their own owner-only subcollection under the user:
//   users/{uid}/notifications/{notificationId}
// One document per news-worthy transition (kick off, score change, full time).
export type MatchAlertType = 'match_started' | 'match_score' | 'match_finished';

export type MatchAlertNotification = {
  id: string;
  type: MatchAlertType;
  matchId: number;
  team: string;
  competition: string;
  title: string;
  message: string;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  scoreKey: string | null;
  createdAt: string;
  readAt: string | null;
};

export type MatchAlertDraft = Omit<MatchAlertNotification, 'id' | 'createdAt' | 'readAt'>;

const NOTIFICATIONS_SUBCOLLECTION = 'notifications';

const ALERT_TYPES: readonly MatchAlertType[] = ['match_started', 'match_score', 'match_finished'];

function notificationsCollection(firestore: Firestore, uid: string) {
  return collection(firestore, 'users', uid, NOTIFICATIONS_SUBCOLLECTION);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value ? value : fallback;
}

function numOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseNotification(
  id: string,
  data: Record<string, unknown>
): MatchAlertNotification | null {
  if (typeof data.type !== 'string' || !ALERT_TYPES.includes(data.type as MatchAlertType)) {
    return null;
  }
  if (typeof data.matchId !== 'number' || !Number.isFinite(data.matchId)) {
    return null;
  }
  return {
    id,
    type: data.type as MatchAlertType,
    matchId: data.matchId,
    team: str(data.team, 'My team'),
    competition: str(data.competition, ''),
    title: str(data.title, 'Match update'),
    message: str(data.message, ''),
    homeName: str(data.homeName, ''),
    awayName: str(data.awayName, ''),
    homeScore: numOrNull(data.homeScore),
    awayScore: numOrNull(data.awayScore),
    status: str(data.status, ''),
    scoreKey: typeof data.scoreKey === 'string' ? data.scoreKey : null,
    createdAt: str(data.createdAt, new Date().toISOString()),
    readAt: typeof data.readAt === 'string' ? data.readAt : null,
  };
}

export async function fetchNotifications(
  firestore: Firestore,
  uid: string
): Promise<MatchAlertNotification[]> {
  const snapshot = await getDocs(
    query(notificationsCollection(firestore, uid), orderBy('createdAt', 'desc'), limit(50))
  );

  const items: MatchAlertNotification[] = [];
  snapshot.forEach((entry) => {
    const data = entry.data();
    if (!isRecord(data)) return;
    const parsed = parseNotification(entry.id, data);
    if (parsed) items.push(parsed);
  });
  return items;
}

export async function appendNotification(
  firestore: Firestore,
  uid: string,
  draft: MatchAlertDraft
): Promise<MatchAlertNotification> {
  const createdAt = new Date().toISOString();
  const ref = await addDoc(notificationsCollection(firestore, uid), {
    ...draft,
    createdAt,
    readAt: null,
  });
  return { id: ref.id, ...draft, createdAt, readAt: null };
}

export async function markNotificationRead(
  firestore: Firestore,
  uid: string,
  notificationId: string
): Promise<void> {
  await updateDoc(
    doc(firestore, 'users', uid, NOTIFICATIONS_SUBCOLLECTION, notificationId),
    { readAt: new Date().toISOString() }
  );
}

export async function markAllNotificationsRead(
  firestore: Firestore,
  uid: string,
  unread: MatchAlertNotification[]
): Promise<void> {
  if (!unread.length) return;
  const batch = writeBatch(firestore);
  const readAt = new Date().toISOString();
  for (const notification of unread) {
    batch.update(
      doc(firestore, 'users', uid, NOTIFICATIONS_SUBCOLLECTION, notification.id),
      { readAt }
    );
  }
  await batch.commit();
}

export function scoreKeyFor(
  homeScore: number | null,
  awayScore: number | null
): string | null {
  return homeScore === null || awayScore === null ? null : `${homeScore}-${awayScore}`;
}

function lastKnownScoreKey(
  existing: MatchAlertNotification[],
  matchId: number
): string | null {
  const scored = existing
    .filter((notification) => notification.matchId === matchId && notification.scoreKey !== null)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return scored[0]?.scoreKey ?? null;
}

// Status labels mirror what football-data.org reports; they also make the alerts
// self-explanatory (In play / Half time / Full time).
export function statusLabel(status: string): string {
  if (status === 'IN_PLAY') return 'In play';
  if (status === 'PAUSED') return 'Half time';
  if (status === 'FINISHED' || status === 'AWARDED') return 'Full time';
  if (status === 'POSTPONED') return 'Postponed';
  return 'Match';
}

// Turns the latest team-matches snapshot into only the genuinely new alerts for this
// user. Dedupe is based on matchId + type (and scoreKey for score updates), so the same
// kick off / goal / full-time never repeats across polls or browser tabs.
export function buildMatchAlertDrafts(
  result: TeamMatchesResult,
  teamName: string,
  existing: MatchAlertNotification[]
): MatchAlertDraft[] {
  const drafts: MatchAlertDraft[] = [];

  if (result.live) {
    const live = result.live;
    const started = !existing.some(
      (notification) => notification.matchId === live.id && notification.type === 'match_started'
    );

    if (started) {
      drafts.push({
        type: 'match_started',
        matchId: live.id,
        team: teamName,
        competition: live.competition,
        title: `${live.homeTeam.name} vs ${live.awayTeam.name}`,
        message: `Kick off — ${statusLabel(live.status)} now in ${live.competition}.`,
        homeName: live.homeTeam.name,
        awayName: live.awayTeam.name,
        homeScore: live.homeTeam.score,
        awayScore: live.awayTeam.score,
        status: live.status,
        scoreKey: scoreKeyFor(live.homeTeam.score, live.awayTeam.score),
      });
    }

    const currentScoreKey = scoreKeyFor(live.homeTeam.score, live.awayTeam.score);
    if (currentScoreKey && lastKnownScoreKey(existing, live.id) !== currentScoreKey) {
      drafts.push({
        type: 'match_score',
        matchId: live.id,
        team: teamName,
        competition: live.competition,
        title: `${live.homeTeam.name} ${live.homeTeam.score}–${live.awayTeam.score} ${live.awayTeam.name}`,
        message: `Score update — ${statusLabel(live.status)} in ${live.competition}.`,
        homeName: live.homeTeam.name,
        awayName: live.awayTeam.name,
        homeScore: live.homeTeam.score,
        awayScore: live.awayTeam.score,
        status: live.status,
        scoreKey: currentScoreKey,
      });
    }
  }

  if (result.previous) {
    const prev = result.previous;
    const finished = !existing.some(
      (notification) =>
        notification.matchId === prev.id && notification.type === 'match_finished'
    );

    if (finished) {
      const homeScore = prev.homeTeam.score ?? 0;
      const awayScore = prev.awayTeam.score ?? 0;
      drafts.push({
        type: 'match_finished',
        matchId: prev.id,
        team: teamName,
        competition: prev.competition,
        title: `${prev.homeTeam.name} ${homeScore}–${awayScore} ${prev.awayTeam.name}`,
        message: `Full time in ${prev.competition}.`,
        homeName: prev.homeTeam.name,
        awayName: prev.awayTeam.name,
        homeScore: prev.homeTeam.score,
        awayScore: prev.awayTeam.score,
        status: prev.status,
        scoreKey: scoreKeyFor(prev.homeTeam.score, prev.awayTeam.score),
      });
    }
  }

  return drafts;
}

export function countUnread(items: MatchAlertNotification[]): number {
  return items.reduce((count, item) => count + (item.readAt === null ? 1 : 0), 0);
}

export function timeAgo(iso: string): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}