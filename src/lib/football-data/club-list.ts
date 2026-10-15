// Pure merge step for the Favorite Team club picker.
//
// Client-safe: no network, cache, or server-only imports — only the finished
// per-competition payloads go in, so the logic is unit-testable with node:test.
//
// Semantics are exactly the ones getClubList() has always had, only extracted:
// sources that report an error are skipped (their leagues simply contribute
// nothing), clubs dedupe by provider id, the combined list is sorted by name,
// and an error surfaces only when NO club could be loaded at all. Dummy clubs
// are never invented.
import type { CompetitionCode } from './competitions';

export type ClubListEntry = {
  id: number;
  name: string;
  shortName: string;
  tla: string | null;
  crest: string | null;
  competitionCode: CompetitionCode;
};

export type ClubListSource = {
  teams: ClubListEntry[];
  error: string | null;
};

export type MergedClubList = {
  teams: ClubListEntry[];
  error: string | null;
};

export const CLUB_LIST_UNAVAILABLE_MESSAGE =
  'Unable to load the club list right now. Please try again later.';

export function mergeClubLists(sources: readonly ClubListSource[]): MergedClubList {
  const teamsById = new Map<number, ClubListEntry>();

  for (const source of sources) {
    if (source.error) continue;

    for (const team of source.teams) {
      teamsById.set(team.id, team);
    }
  }

  const teams = [...teamsById.values()].sort((a, b) => a.name.localeCompare(b.name));

  if (teams.length > 0) {
    return { teams, error: null };
  }

  const firstError = sources.find((source) => source.error)?.error ?? null;
  return { teams: [], error: firstError ?? CLUB_LIST_UNAVAILABLE_MESSAGE };
}
