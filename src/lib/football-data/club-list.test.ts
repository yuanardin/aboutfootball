import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLUB_LIST_UNAVAILABLE_MESSAGE,
  mergeClubLists,
  type ClubListSource,
} from './club-list';

function club(
  id: number,
  name: string,
  shortName: string = name,
  competitionCode: ClubListSource['teams'][number]['competitionCode'] = 'PL'
): ClubListSource['teams'][number] {
  return { id, name, shortName, tla: null, crest: null, competitionCode };
}

test('five leagues merge into one combined club list', () => {
  const sources: ClubListSource[] = (['PL', 'PD', 'SA', 'BL1', 'FL1'] as const).map(
    (league, leagueIndex) => ({
      teams: [club(leagueIndex * 100 + 1, `${league} United`), club(leagueIndex * 100 + 2, `${league} City`)],
      error: null,
    })
  );

  const merged = mergeClubLists(sources);
  assert.equal(merged.error, null);
  assert.equal(merged.teams.length, 10);
});

test('clubs dedupe by provider id without duplication', () => {
  const merged = mergeClubLists([
    { teams: [club(1, 'Arsenal'), club(2, 'Chelsea')], error: null },
    { teams: [club(2, 'Chelsea'), club(3, 'Liverpool')], error: null },
  ]);

  assert.equal(merged.error, null);
  assert.deepStrictEqual(
    merged.teams.map((team) => team.id),
    [1, 2, 3]
  );
});

test('combined list stays sorted by club name', () => {
  const merged = mergeClubLists([
    { teams: [club(1, 'Zurich'), club(2, 'Arsenal')], error: null },
    { teams: [club(3, 'Milan')], error: null },
  ]);

  assert.deepStrictEqual(
    merged.teams.map((team) => team.name),
    ['Arsenal', 'Milan', 'Zurich']
  );
});

test('partial failure keeps the leagues that succeeded', () => {
  const merged = mergeClubLists([
    { teams: [club(1, 'Arsenal')], error: null },
    { teams: [], error: 'league unavailable' },
    { teams: [club(2, 'Barcelona')], error: null },
  ]);

  assert.equal(merged.error, null);
  assert.deepStrictEqual(
    merged.teams.map((team) => team.name),
    ['Arsenal', 'Barcelona']
  );
});

test('total failure surfaces the first league error, never dummy clubs', () => {
  const merged = mergeClubLists([
    { teams: [], error: 'first league down' },
    { teams: [], error: 'second league down' },
  ]);

  assert.deepStrictEqual(merged.teams, []);
  assert.equal(merged.error, 'first league down');

  const empty = mergeClubLists([{ teams: [], error: null }]);
  assert.deepStrictEqual(empty.teams, []);
  assert.equal(empty.error, CLUB_LIST_UNAVAILABLE_MESSAGE);
});
