import type { MatchResult, Standing } from './types';

export const matchResults: MatchResult[] = [
  {
    id: 'm1',
    league: 'Pre-Season Friendly',
    homeTeam: { name: 'Man City', score: 2, logoId: 'team-logo-1' },
    awayTeam: { name: 'Barcelona', score: 2, logoId: 'team-logo-10' },
    matchDate: 'July 25, 2024',
    status: 'FT',
  },
  {
    id: 'm2',
    league: 'Pre-Season Friendly',
    homeTeam: { name: 'Man United', score: 1, logoId: 'team-logo-8' },
    awayTeam: { name: 'Arsenal', score: 3, logoId: 'team-logo-2' },
    matchDate: 'July 25, 2024',
    status: 'FT',
  },
  {
    id: 'm3',
    league: 'Pre-Season Friendly',
    homeTeam: { name: 'Real Madrid', score: 4, logoId: 'team-logo-9' },
    awayTeam: { name: 'Chelsea', score: 1, logoId: 'team-logo-6' },
    matchDate: 'July 24, 2024',
    status: 'FT',
  },
  {
    id: 'm4',
    league: 'Pre-Season Friendly',
    homeTeam: { name: 'Liverpool', score: 0, logoId: 'team-logo-3' },
    awayTeam: { name: 'Aston Villa', score: 0, logoId: 'team-logo-4' },
    matchDate: 'July 24, 2024',
    status: 'FT',
  },
];

export const leagueStandings: Standing[] = [
  { rank: 1, team: { name: 'Man City', logoId: 'team-logo-1' }, played: 38, win: 28, draw: 7, loss: 3, gd: 62, points: 91, form: ['W', 'W', 'W', 'W', 'W'] },
  { rank: 2, team: { name: 'Arsenal', logoId: 'team-logo-2' }, played: 38, win: 28, draw: 5, loss: 5, gd: 62, points: 89, form: ['W', 'W', 'W', 'W', 'W'] },
  { rank: 3, team: { name: 'Liverpool', logoId: 'team-logo-3' }, played: 38, win: 24, draw: 10, loss: 4, gd: 45, points: 82, form: ['W', 'D', 'L', 'W', 'D'] },
  { rank: 4, team: { name: 'Aston Villa', logoId: 'team-logo-4' }, played: 38, win: 20, draw: 8, loss: 10, gd: 15, points: 68, form: ['L', 'D', 'L', 'W', 'D'] },
  { rank: 5, team: { name: 'Tottenham', logoId: 'team-logo-5' }, played: 38, win: 20, draw: 6, loss: 12, gd: 13, points: 66, form: ['W', 'L', 'L', 'L', 'W'] },
  { rank: 6, team: { name: 'Chelsea', logoId: 'team-logo-6' }, played: 38, win: 18, draw: 9, loss: 11, gd: -1, points: 63, form: ['W', 'W', 'W', 'W', 'W'] },
  { rank: 7, team: { name: 'Newcastle', logoId: 'team-logo-7' }, played: 38, win: 18, draw: 6, loss: 14, gd: 23, points: 60, form: ['W', 'D', 'L', 'W', 'D'] },
  { rank: 8, team: { name: 'Man United', logoId: 'team-logo-8' }, played: 38, win: 18, draw: 6, loss: 14, gd: -1, points: 60, form: ['W', 'L', 'L', 'D', 'W'] },
];
