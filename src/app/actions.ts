'use server';

import { summarizeFootballNews } from '@/ai/flows/summarize-football-news';
import { getNewsForTeam, type TeamNewsResult, type NewsRankingPreferences } from '@/lib/news/service';
import { getCompetitionTeams, getStandings, getTeamMatches } from '@/lib/football-data/service';
import type { TeamMatchesResult } from '@/lib/football-data/service';
import {
  DEFAULT_COMPETITION,
  isCompetitionCode,
  type CompetitionCode,
} from '@/lib/football-data/competitions';
import type { FootballDataMeta, FootballDataTeam } from '@/lib/football-data/types';
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
};

export type ClubListResult = {
  teams: ClubOption[];
  error: string | null;
};

export async function getClubList(competitionCode?: string): Promise<ClubListResult> {
  const code: CompetitionCode = isCompetitionCode(competitionCode)
    ? competitionCode
    : DEFAULT_COMPETITION;
  const result = await getCompetitionTeams(code);

  if (result.error) {
    return { teams: [], error: result.error };
  }

  return {
    teams: result.teams.map((team) => ({
      id: team.id,
      name: team.name,
      shortName: team.shortName ?? team.name,
      tla: team.tla ?? null,
      crest: team.crest ?? null,
    })),
    error: null,
  };
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
