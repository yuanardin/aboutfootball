'use server';

import { summarizeFootballNews } from '@/ai/flows/summarize-football-news';
import { getNewsForTeam, type TeamNewsResult, type NewsRankingPreferences } from '@/lib/news/service';
import { getAllStandings, getCompetitionTeams, getStandings, getTeamMatches } from '@/lib/football-data/service';
import type { TeamMatchesResult } from '@/lib/football-data/service';
import {
  DEFAULT_COMPETITION,
  getClubSelectionCodes,
  type CompetitionCode,
} from '@/lib/football-data/competitions';
import type { FootballDataMeta } from '@/lib/football-data/types';
import { mergeClubLists } from '@/lib/football-data/club-list';
import { mapWithConcurrency } from '@/lib/async-pool';
import type { Standing } from '@/lib/types';
import { z } from 'zod';
import { ZodError } from 'zod';

const schema = z.object({
  articleUrl: z.string().url({ message: 'Please enter a valid URL.' }),
});

export interface FormState {
  message: string;
  summary?: string;
  title?: string;
  keyTakeaways?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
}

export type ClubOption = {
  id: number;
  name: string;
  shortName: string;
  tla: string | null;
  crest: string | null;
  competitionCode: CompetitionCode;
};

export type ClubListResult = {
  teams: ClubOption[];
  error: string | null;
};

export async function getClubList(competitionCode?: string): Promise<ClubListResult> {
  const codes = getClubSelectionCodes(competitionCode);
  // Same quota-safe pattern as the multi-competition overviews: at most two
  // leagues load at once, 24h-cached leagues resolve without any upstream
  // call, and a single-competition selection still performs exactly one read.
  const results = await mapWithConcurrency(codes, 2, (code) => getCompetitionTeams(code));

  return mergeClubLists(
    results.map((result, index) => ({
      teams: result.teams.map((team) => ({
        id: team.id,
        name: team.name,
        shortName: team.shortName ?? team.name,
        tla: team.tla ?? null,
        crest: team.crest ?? null,
        competitionCode: codes[index],
      })),
      error: result.error,
    }))
  );
}

export async function getTeamMatchesAction(teamId: number): Promise<TeamMatchesResult> {
  if (!Number.isInteger(teamId) || teamId <= 0 || teamId > 100_000) {
    return { upcoming: null, previous: null, live: null, error: 'Invalid team id.', stale: false };
  }
  return getTeamMatches(teamId);
}

export type StandingsActionResult = {
  standings: Standing[];
  meta: FootballDataMeta | null;
  error: string | null;
};

export async function getStandingsAction(
  competitionCode: CompetitionCode = DEFAULT_COMPETITION
): Promise<StandingsActionResult> {
  const payload = await getStandings(competitionCode);

  if (payload.meta.source !== 'live') {
    return {
      standings: [],
      meta: null,
      error:
        payload.meta.error ??
        'Live standings are not available right now. Please try again shortly.',
    };
  }

  return { standings: payload.standings, meta: payload.meta, error: null };
}

export async function getStandingsForTeamAction(
  teamName: string,
  competitionCode: CompetitionCode | null
): Promise<StandingsActionResult> {
  if (competitionCode) return getStandingsAction(competitionCode);

  const overview = await getAllStandings();
  const normalizeTeamName = (value: string) =>
    value
      .toLowerCase()
      .replace(/\b(fc|cf|afc)\b/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const normalizedName = normalizeTeamName(teamName);
  const matchingEntry = overview.entries.find((entry) =>
    entry.payload.standings.some(
      (standing) => normalizeTeamName(standing.team.name) === normalizedName
    )
  );

  if (!matchingEntry) {
    return {
      standings: [],
      meta: null,
      error: overview.meta.error ?? 'The team is not present in the available league tables.',
    };
  }

  return getStandingsAction(matchingEntry.code);
}

export async function getNewsForTeamAction(
  clubName: string,
  aliases: string[] = [],
  preferences?: NewsRankingPreferences
): Promise<TeamNewsResult> {
  const safeName = typeof clubName === 'string' ? clubName.trim().slice(0, 60) : '';
  const safeAliases = (Array.isArray(aliases) ? aliases : [])
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().slice(0, 60))
    .filter((value) => value.length > 0);

  if (!safeName) {
    return {
      articles: [],
      club: clubName,
      provider: 'NewsAPI',
      lastUpdated: new Date().toISOString(),
      error: 'A team name is required to load personalized news.',
    };
  }

  const safePreferences: NewsRankingPreferences | undefined =
    preferences && (preferences.topics?.length || preferences.leagues?.length)
      ? {
          topics: (preferences.topics ?? [])
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.toLowerCase().trim().slice(0, 24))
            .filter((value) => value.length > 0)
            .slice(0, 8),
          leagues: (preferences.leagues ?? [])
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.toLowerCase().trim().slice(0, 40))
            .filter((value) => value.length > 0)
            .slice(0, 12),
        }
      : undefined;

  return getNewsForTeam(safeName, safeAliases, safePreferences);
}

export async function handleSummarize(prevState: FormState, formData: FormData): Promise<FormState> {
  const data = {
    articleUrl: formData.get('articleUrl'),
  };

  try {
    const validatedData = schema.parse(data);

    try {
      const result = await summarizeFootballNews({ articleUrl: validatedData.articleUrl });
      return {
        message: 'Success',
        summary: result.summary,
        title: result.title ?? '',
        keyTakeaways: result.keyTakeaways ?? [],
      };
    } catch (error) {
      console.error(error);
      return { message: "An error occurred while summarizing the article. The AI model might be unavailable." };
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        message: 'Invalid input.',
        fieldErrors: error.flatten().fieldErrors,
      };
    }
    return { message: 'An unexpected error occurred.' };
  }
}
