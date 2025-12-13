import Image from 'next/image';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { leagueStandings } from '@/lib/data';
import { getImageById, cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

export default function StandingsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <section className="text-center mb-12">
        <h1 className="font-headline text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
          League Tables
        </h1>
        <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto font-body">
          See who's topping the charts and who's fighting for survival.
          The complete Premier League standings.
        </p>
      </section>

      <Card className="glass-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px] text-center">#</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="text-center">P</TableHead>
              <TableHead className="text-center">W</TableHead>
              <TableHead className="text-center">D</TableHead>
              <TableHead className="text-center">L</TableHead>
              <TableHead className="text-center">Pts</TableHead>
              <TableHead className="text-right hidden md:table-cell">Form</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leagueStandings.map((standing) => {
              const teamLogo = getImageById(standing.team.logoId);
              return (
                <TableRow key={standing.rank}>
                  <TableCell className="font-medium text-center text-muted-foreground">{standing.rank}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {teamLogo && (
                        <Image
                          src={teamLogo.imageUrl}
                          alt={teamLogo.description}
                          width={24}
                          height={24}
                          data-ai-hint={teamLogo.imageHint}
                        />
                      )}
                      <span className="font-medium font-headline">{standing.team.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{standing.played}</TableCell>
                  <TableCell className="text-center">{standing.win}</TableCell>
                  <TableCell className="text-center">{standing.draw}</TableCell>
                  <TableCell className="text-center">{standing.loss}</TableCell>
                  <TableCell className="font-bold text-center">{standing.points}</TableCell>
                  <TableCell className="text-right hidden md:table-cell">
                    <div className="flex gap-1 justify-end">
                      {standing.form.map((result, index) => (
                        <span key={index} className={cn(
                          'flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold',
                          result === 'W' && 'bg-green-500/80 text-white',
                          result === 'D' && 'bg-gray-500/80 text-white',
                          result === 'L' && 'bg-red-500/80 text-white',
                        )}>
                          {result}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
