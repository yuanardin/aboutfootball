// Single source of truth for every football-data.org competition ScoreCast can show.
// Adding another league or cup competition only means adding one entry here — the
// provider, service, /standings and /results all read from this registry instead of
// hard-coding competition codes.
//
// Codes are the ones defined by the football-data.org v4 API documentation.
export type CompetitionCode = 'PL' | 'PD' | 'SA' | 'BL1' | 'FL1' | 'CL';

export type CompetitionOption = {
  code: CompetitionCode;
  /** Short label used in the selector chips and table headers. */
  label: string;
  /** Slightly longer label used in headings and empty states. */
  title: string;
  /** Domestic leagues answer with a single table; cups may split by stage/group. */
  format: 'league' | 'cup';
};

export const COMPETITIONS: readonly CompetitionOption[] = [
  { code: 'PL', label: 'Premier League', title: 'Premier League', format: 'league' },
  { code: 'PD', label: 'La Liga', title: 'La Liga', format: 'league' },
  { code: 'SA', label: 'Serie A', title: 'Serie A', format: 'league' },
  { code: 'BL1', label: 'Bundesliga', title: 'Bundesliga', format: 'league' },
  { code: 'FL1', label: 'Ligue 1', title: 'Ligue 1', format: 'league' },
  { code: 'CL', label: 'Champions League', title: 'UEFA Champions League', format: 'cup' },
] as const;

export const COMPETITION_CODES: readonly CompetitionCode[] = COMPETITIONS.map(
  (competition) => competition.code
);

// The competition the personalized home page and "Your Team"/"Your Standings" default to.
// Kept as PL so existing personalisation behaviour is unchanged.
export const DEFAULT_COMPETITION: CompetitionCode = 'PL';

// Sentinel used by the /standings and /results selector for the combined view.
export const ALL_COMPETITIONS = 'ALL' as const;
export type CompetitionSelection = CompetitionCode | typeof ALL_COMPETITIONS;

export function isCompetitionCode(value: unknown): value is CompetitionCode {
  return typeof value === 'string' && (COMPETITION_CODES as readonly string[]).includes(value);
}

export function isCompetitionSelection(value: unknown): value is CompetitionSelection {
  return value === ALL_COMPETITIONS || isCompetitionCode(value);
}

export function getCompetition(code: CompetitionCode): CompetitionOption {
  return COMPETITIONS.find((competition) => competition.code === code) ?? COMPETITIONS[0];
}

export function competitionLabel(code: CompetitionCode): string {
  return getCompetition(code).label;
}

export function competitionTitle(code: CompetitionCode): string {
  return getCompetition(code).title;
}
