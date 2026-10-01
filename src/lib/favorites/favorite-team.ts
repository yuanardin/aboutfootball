import type { Firestore } from 'firebase/firestore';
import { deleteField, doc, getDoc, setDoc } from 'firebase/firestore';
import type { CompetitionCode } from '@/lib/football-data/competitions';

export const USERS_COLLECTION = 'users';

export type FavoriteTeam = {
  id: number;
  name: string;
  crest: string | null;
  competitionCode: CompetitionCode | null;
  updatedAt: string;
};

export type FavoriteTeamInput = {
  id: number;
  name: string;
  crest?: string | null;
  competitionCode: CompetitionCode;
};

// Favorites live as a `favoriteTeam` object inside the user's own document:
//   users/{uid}.favoriteTeam = { id, name, crest, updatedAt }
function userDoc(firestore: Firestore, uid: string) {
  return doc(firestore, USERS_COLLECTION, uid);
}

export async function getFavoriteTeam(
  firestore: Firestore,
  uid: string
): Promise<FavoriteTeam | null> {
  const snapshot = await getDoc(userDoc(firestore, uid));
  if (!snapshot.exists()) return null;

  const data = snapshot.data() as { favoriteTeam?: Record<string, unknown> };
  const team = data.favoriteTeam;
  if (!team || typeof team !== 'object') return null;

  const id = Number(team.id);
  if (!Number.isInteger(id) || id <= 0) return null;

  const competitionCode = team.competitionCode;
  const validCompetitionCodes = ['PL', 'PD', 'SA', 'BL1', 'FL1', 'CL'] as const;

  return {
    id,
    name: typeof team.name === 'string' && team.name ? team.name : '',
    crest: typeof team.crest === 'string' && team.crest ? team.crest : null,
    competitionCode: validCompetitionCodes.includes(competitionCode as (typeof validCompetitionCodes)[number])
      ? (competitionCode as FavoriteTeam['competitionCode'])
      : null,
    updatedAt: typeof team.updatedAt === 'string' ? team.updatedAt : '',
  };
}

export async function saveFavoriteTeam(
  firestore: Firestore,
  uid: string,
  input: FavoriteTeamInput
): Promise<FavoriteTeam> {
  const value: FavoriteTeam = {
    id: input.id,
    name: input.name,
    crest: input.crest ?? null,
    competitionCode: input.competitionCode,
    updatedAt: new Date().toISOString(),
  };
  await setDoc(userDoc(firestore, uid), { favoriteTeam: value }, { merge: true });
  return value;
}

export async function removeFavoriteTeam(firestore: Firestore, uid: string): Promise<void> {
  // merge:true + deleteField() is idempotent — it clears the nested field even if
  // the document does not exist yet, without removing any future user data.
  await setDoc(userDoc(firestore, uid), { favoriteTeam: deleteField() }, { merge: true });
}

const FIRESTORE_ERROR_MESSAGES: Record<string, string> = {
  'permission-denied':
    'You do not have permission to access this data. Sign out and sign back in, then try again.',
  unavailable: 'Could not reach the database right now. Check your connection and try again.',
  'deadline-exceeded': 'The database took too long to respond. Please try again.',
  'not-found': 'This record no longer exists.',
  cancelled: 'The request was cancelled. Please try again.',
};

export function getFirestoreErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  return FIRESTORE_ERROR_MESSAGES[code ?? ''] ?? 'Something went wrong. Please try again.';
}