export type NewsArticle = {
  id: string;
  title: string;
  excerpt: string;
  source: string;
  date: string;
  imageId: string;
  category?: string;
  readTime?: string;
};

export type MatchResult = {
  id: string;
  league: string;
  homeTeam: { name: string; score: number; logoId: string };
  awayTeam: { name: string; score: number; logoId: string };
  matchDate: string;
  status: 'FT' | 'LIVE' | 'HT';
};

export type Standing = {
  rank: number;
  team: { name: string; logoId: string };
  played: number;
  win: number;
  draw: number;
  loss: number;
  gd: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
};
