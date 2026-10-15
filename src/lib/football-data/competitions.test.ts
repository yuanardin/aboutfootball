import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_COMPETITION, TOP_EUROPEAN_LEAGUES, getClubSelectionCodes } from './competitions';

test('favorite team selector defaults to all five major European leagues', () => {
  assert.deepStrictEqual(getClubSelectionCodes(), [...TOP_EUROPEAN_LEAGUES]);
  assert.deepStrictEqual(getClubSelectionCodes('PL'), ['PL']);
  assert.deepStrictEqual(getClubSelectionCodes(DEFAULT_COMPETITION), [DEFAULT_COMPETITION]);
});
