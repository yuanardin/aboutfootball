import type { Firestore } from 'firebase/firestore';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export { getFirestoreErrorMessage } from '@/lib/favorites/favorite-team';

// User preferences live under users/{uid}.preferences, which inherits the same
// owner-only rules as the rest of the user's document. The favorite team itself is
// stored at users/{uid}.favoriteTeam (single source of truth); the content
// preferences below steer how personalized news is ranked.
export type NewsScope = 'club' | 'leagues' | 'balanced';

export type UserPreferencesInput = {
  newsScope: NewsScope;
  leagues: string[];
  topics: string[];
  // matchAlerts drives the header notification center: when false, the bell stops
  // polling for the favorite team's matches and only shows previously saved alerts.
  matchAlerts: boolean;
};

export type UserPreferences = UserPreferencesInput & { updatedAt: string };

export const LEAGUE_OPTIONS = [
  'Premier League',
  'La Liga',
  'Serie A',
  'Bundesliga',
  'Ligue 1',
  'Champions League',
  'Europa League',
] as const;

export const TOPIC_OPTIONS = [
  { id: 'matchday', label: 'Matchday' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'injuries', label: 'Injuries' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'offpitch', label: 'Off the pitch' },
] as const;

export type TopicId = (typeof TOPIC_OPTIONS)[number]['id'];

export const NEWS_SCOPE_OPTIONS: { id: NewsScope; label: string; description: string }[] = [
  {
    id: 'club',
    label: 'My club first',
    description: 'Prioritize stories about your favorite team.',
  },
  {
    id: 'leagues',
    label: 'Preferred leagues',
    description: 'Prioritize stories from the leagues you follow.',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'A general mix of the football world.',
  },
];

function userDoc(firestore: Firestore, uid: string) {
  return doc(firestore, 'users', uid);
}

export function defaultPreferences(): UserPreferences {
  return { newsScope: 'club', leagues: [], topics: [], matchAlerts: true, updatedAt: '' };
}

function isNewsScope(value: unknown): value is NewsScope {
  return value === 'club' || value === 'leagues' || value === 'balanced';
}

function stringList(value: unknown, allowed?: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && Boolean(item))
    .filter((item) => !allowed || (allowed as readonly string[]).includes(item))
    .slice(0, 12);
}

export async function getPreferences(
  firestore: Firestore,
  uid: string
): Promise<UserPreferences> {
  const snapshot = await getDoc(userDoc(firestore, uid));
  if (!snapshot.exists()) return defaultPreferences();

  const data = snapshot.data() as { preferences?: Record<string, unknown> };
  const prefs = data.preferences;
  if (!prefs || typeof prefs !== 'object') return defaultPreferences();

  return {
    newsScope: isNewsScope(prefs.newsScope) ? prefs.newsScope : 'club',
    leagues: stringList(prefs.leagues, LEAGUE_OPTIONS as readonly string[]),
    topics: stringList(prefs.topics, TOPIC_OPTIONS.map((option) => option.id)),
    matchAlerts: prefs.matchAlerts !== false,
    updatedAt: typeof prefs.updatedAt === 'string' ? prefs.updatedAt : new Date().toISOString(),
  };
}

export async function savePreferences(
  firestore: Firestore,
  uid: string,
  input: UserPreferencesInput
): Promise<UserPreferences> {
  const value: UserPreferences = {
    newsScope: isNewsScope(input.newsScope) ? input.newsScope : 'club',
    leagues: stringList(input.leagues, LEAGUE_OPTIONS as readonly string[]),
    topics: stringList(input.topics, TOPIC_OPTIONS.map((option) => option.id)),
    matchAlerts: input.matchAlerts !== false,
    updatedAt: new Date().toISOString(),
  };
  // merge:true keeps favoriteTeam, savedArticles and any other user data intact.
  await setDoc(userDoc(firestore, uid), { preferences: value }, { merge: true });
  return value;
}