import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { matchResults } from '@/lib/data';
import { getImageById } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

export default function ResultsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <section className="text-center mb-12">
        <h1 className="font-headline text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
          Match Day Central
        </h1>
        <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto font-body">
          Catch up on all the recent action. Here are the latest scores from
          around the leagues.
        </p>
      </section>

      <div className="max-w-4xl mx-auto space-y-6">
        {matchResults.map((match) => {
          const homeLogo = getImageById(match.homeTeam.logoId);
          const awayLogo = getImageById(match.awayTeam.logoId);
          return (
            <Card key={match.id} className="glass-card">
              <CardHeader className="p-4">
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>{match.league}</span>
                  <span>{match.matchDate}</span>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="p-6">
                <div className="flex items-center justify-around">
                  <div className="flex flex-col md:flex-row items-center gap-4 w-2/5 justify-end">
                    <span className="font-headline text-lg md:text-xl text-right font-semibold">
                      {match.homeTeam.name}
                    </span>
                    {homeLogo && (
                      <Image
                        src={homeLogo.imageUrl}
                        alt={homeLogo.description}
                        width={40}
                        height={40}
                        data-ai-hint={homeLogo.imageHint}
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-center font-headline text-2xl md:text-4xl font-bold mx-4">
                    <span>{match.homeTeam.score}</span>
                    <span className="mx-2">-</span>
                    <span>{match.awayTeam.score}</span>
                  </div>

                  <div className="flex flex-col-reverse md:flex-row items-center gap-4 w-2/5 justify-start">
                    {awayLogo && (
                      <Image
                        src={awayLogo.imageUrl}
                        alt={awayLogo.description}
                        width={40}
                        height={40}
                        data-ai-hint={awayLogo.imageHint}
                      />
                    )}
                    <span className="font-headline text-lg md:text-xl text-left font-semibold">
                      {match.awayTeam.name}
                    </span>
                  </div>
                </div>
                <div className="text-center mt-4">
                  <Badge
                    className={
                      match.status === 'FT' ? 'bg-primary/20 text-primary' : ''
                    }
                  >
                    {match.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
