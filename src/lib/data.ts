import type { NewsArticle, MatchResult, Standing } from './types';

export const newsArticles: NewsArticle[] = [
  {
    id: '1',
    title: 'Transfer Window Heats Up: Blockbuster Deals on the Horizon',
    excerpt: 'Top clubs are preparing to splash the cash as several high-profile players are linked with summer moves. Who will make the biggest impact?',
    source: 'The Athletic',
    date: 'July 26, 2024',
    imageId: 'news-1',
  },
  {
    id: '2',
    title: "Manager Under Pressure After Disappointing Pre-Season",
    excerpt: "With a string of poor results in friendly matches, the gaffer's tactical decisions are coming under scrutiny from fans and pundits alike.",
    source: 'ESPN FC',
    date: 'July 25, 2024',
    imageId: 'news-2',
  },
  {
    id: '3',
    title: 'Last-Gasp Winner Decides Pre-Season Derby',
    excerpt: 'A stunning 94th-minute goal sealed a dramatic victory in a fiercely contested local derby, giving fans bragging rights.',
    source: 'Sky Sports',
    date: 'July 24, 2024',
    imageId: 'news-3',
  },
  {
    id: '4',
    title: "Youth Academy Star Shines on First Team Debut",
    excerpt: "An 18-year-old prodigy made a memorable debut, scoring one and assisting another, leaving a lasting impression.",
    source: 'Goal.com',
    date: 'July 23, 2024',
    imageId: 'news-4',
  },
  {
    id: '5',
    title: "New Season, New Tactics: Are We Set for a Tactical Revolution?",
    excerpt: "Several top managers are experimenting with innovative formations and strategies. We break down the tactical trends to watch.",
    source: 'Tifo Football',
    date: 'July 22, 2024',
    imageId: 'news-5',
  },
  {
    id: '6',
    title: 'VAR Controversy: Tech Chief Responds to Criticism',
    excerpt: 'The head of officiating has defended the use of VAR despite another weekend of controversial decisions, promising improvements.',
    source: 'BBC Sport',
    date: 'July 21, 2024',
    imageId: 'news-6',
  },
];

export const matchResults: MatchResult[] = [
    {
        id: 'm1',
        league: 'Pre-Season Friendly',
        homeTeam: { name: 'Man City', score: 2, logoId: 'team-logo-1' },
        awayTeam: { name: 'Barcelona', score: 2, logoId: 'team-logo-10' },
        matchDate: 'July 25, 2024',
        status: 'FT'
    },
    {
        id: 'm2',
        league: 'Pre-Season Friendly',
        homeTeam: { name: 'Man United', score: 1, logoId: 'team-logo-8' },
        awayTeam: { name: 'Arsenal', score: 3, logoId: 'team-logo-2' },
        matchDate: 'July 25, 2024',
        status: 'FT'
    },
    {
        id: 'm3',
        league: 'Pre-Season Friendly',
        homeTeam: { name: 'Real Madrid', score: 4, logoId: 'team-logo-9' },
        awayTeam: { name: 'Chelsea', score: 1, logoId: 'team-logo-6' },
        matchDate: 'July 24, 2024',
        status: 'FT'
    },
    {
        id: 'm4',
        league: 'Pre-Season Friendly',
        homeTeam: { name: 'Liverpool', score: 0, logoId: 'team-logo-3' },
        awayTeam: { name: 'Aston Villa', score: 0, logoId: 'team-logo-4' },
        matchDate: 'July 24, 2024',
        status: 'FT'
    }
];

export const leagueStandings: Standing[] = [
  { rank: 1, team: { name: 'Man City', logoId: 'team-logo-1' }, played: 38, win: 28, draw: 7, loss: 3, points: 91, form: ['W', 'W', 'W', 'W', 'W'] },
  { rank: 2, team: { name: 'Arsenal', logoId: 'team-logo-2' }, played: 38, win: 28, draw: 5, loss: 5, points: 89, form: ['W', 'W', 'W', 'W', 'W'] },
  { rank: 3, team: { name: 'Liverpool', logoId: 'team-logo-3' }, played: 38, win: 24, draw: 10, loss: 4, points: 82, form: ['W', 'D', 'L', 'W', 'D'] },
  { rank: 4, team: { name: 'Aston Villa', logoId: 'team-logo-4' }, played: 38, win: 20, draw: 8, loss: 10, points: 68, form: ['L', 'D', 'L', 'W', 'D'] },
  { rank: 5, team: { name: 'Tottenham', logoId: 'team-logo-5' }, played: 38, win: 20, draw: 6, loss: 12, points: 66, form: ['W', 'L', 'L', 'L', 'W'] },
  { rank: 6, team: { name: 'Chelsea', logoId: 'team-logo-6' }, played: 38, win: 18, draw: 9, loss: 11, points: 63, form: ['W', 'W', 'W', 'W', 'W'] },
  { rank: 7, team: { name: 'Newcastle', logoId: 'team-logo-7' }, played: 38, win: 18, draw: 6, loss: 14, points: 60, form: ['W', 'D', 'L', 'W', 'D'] },
  { rank: 8, team: { name: 'Man United', logoId: 'team-logo-8' }, played: 38, win: 18, draw: 6, loss: 14, points: 60, form: ['W', 'L', 'L', 'D', 'W'] },
];
