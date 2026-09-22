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
