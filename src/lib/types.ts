export type NewsArticle = {
  id: string;
  title: string;
  excerpt: string;
  source: string;
  date: string;
  imageId: string;
  imageUrl?: string;
  category?: string;
  readTime?: string;
  articleUrl?: string;
  publishedAt?: string;
};

export type MatchResult = {
  id: string;
  league: string;
  homeTeam: { name: string; score: number; logoId?: string; crest?: string };
  awayTeam: { name: string; score: number; logoId?: string; crest?: string };
  matchDate: string;
  status: 'FT' | 'LIVE' | 'HT';
  // Straight from the provider response — never derived or invented. Used to label the
  // competition and the round (matchday / stage) each fixture belongs to.
  competitionCode?: string;
  competitionName?: string;
  matchday?: number | null;
  stage?: string;
  group?: string | null;
  kickoff?: string;
};

export type Standing = {
  rank: number;
  team: { name: string; logoId?: string; crest?: string };
  played: number;
  win: number;
  draw: number;
  loss: number;
  gd: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
};

// A single table inside a competition response. Domestic leagues answer with one block;
// cup competitions (Champions League) can answer with a stage/group split, so the shape
// carries the provider's own stage + group labels rather than assuming a league table.
export type StandingGroup = {
  key: string;
  label: string;
  stage: string;
  type: 'TOTAL' | 'HOME' | 'AWAY';
  group: string | null;
  standings: Standing[];
};
