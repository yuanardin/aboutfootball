import Link from 'next/link';
import Image from 'next/image';
import { Trophy } from 'lucide-react';
import type { Standing } from '@/lib/types';
import { getImageById, cn } from '@/lib/utils';

export function FormLetters({ form }: { form: Standing['form'] }) {
  return (
    <div
      className="flex justify-end gap-1"
      aria-label={form.map((r) => (r === 'W' ? 'Won' : r === 'D' ? 'Draw' : 'Lost')).join(', ')}
    >
      {form.map((result, index) => (
        <span
          key={index}
          className={cn(
            'grid h-5 w-5 place-items-center rounded text-[10px] font-bold',
            result === 'W' && 'bg-success/15 text-success',
            result === 'D' && 'bg-secondary text-muted-foreground',
            result === 'L' && 'bg-destructive/15 text-destructive'
          )}
        >
          {result}
        </span>
      ))}
    </div>
  );
}

type StandingsTableProps = {
  standings: Standing[];
  compact?: boolean;
  title?: string;
  subtitle?: string;
};

export function StandingsTable({ standings, compact = false, title = 'Premier League', subtitle }: StandingsTableProps) {
  const rows = compact ? standings.slice(0, 5) : standings;
  const leadingRows = rows.filter((row) => row.points === Math.max(...rows.map((r) => r.points)));

  return (
    <div className="card-surface overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-border bg-secondary/30 px-4 py-3">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/15 text-primary">
          <Trophy className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-headline text-sm font-bold">{title}</h2>
          <p className="text-[11px] text-muted-foreground">{subtitle ?? '2023/24 · final table'}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className={cn('w-full text-sm', compact ? 'min-w-[400px]' : 'min-w-[620px]')}>
          <caption className="sr-only">
            {title} standings — position, points, goal difference and recent form.
          </caption>
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-[0.11em] text-muted-foreground">
              <th scope="col" className="sticky left-0 z-10 w-10 bg-card px-4 py-3 text-center">Pos</th>
              <th scope="col" className="sticky left-10 z-10 bg-card px-3 py-3">Team</th>
              {!compact && <th scope="col" className="px-3 py-3 text-center">P</th>}
              {!compact && <th scope="col" className="px-3 py-3 text-center">W</th>}
              {!compact && <th scope="col" className="px-3 py-3 text-center">D</th>}
              {!compact && <th scope="col" className="px-3 py-3 text-center">L</th>}
              <th scope="col" className="px-3 py-3 text-center">GD</th>
              <th scope="col" className="px-3 py-3 text-center">Pts</th>
              <th scope="col" className="px-4 py-3 text-right">Form</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((standing) => {
              const logo = getImageById(standing.team.logoId);
              const hasLogo = Boolean(standing.team.crest || logo);
              const isLeader = leadingRows.includes(standing);
              return (
                <tr
                  key={standing.rank}
                  className={cn(
                    'border-b border-border/70 last:border-0 transition hover:bg-secondary/30',
                    isLeader && 'bg-primary/[0.06]'
                  )}
                >
                  <td className="sticky left-0 z-10 bg-card px-3 py-3 text-center">
                    <span
                      className={cn(
                        'inline-grid h-5 w-5 place-items-center rounded text-[11px] font-bold tabular-nums',
                        isLeader
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary/70 text-muted-foreground'
                      )}
                    >
                      {standing.rank}
                    </span>
                  </td>
                  <th scope="row" className={cn('sticky left-10 z-10 bg-card px-3 py-3 text-left font-normal')}>
                    <div className="flex items-center gap-2.5">
                      {hasLogo && (
                        <Image
                          src={standing.team.crest ?? logo?.imageUrl ?? ''}
                          alt=""
                          width={24}
                          height={24}
                          className="h-6 w-6 shrink-0 object-contain"
                          data-ai-hint={logo?.imageHint}
                        />
                      )}
                      <span className="whitespace-nowrap font-semibold text-foreground">{standing.team.name}</span>
                    </div>
                  </th>
                  {!compact && <td className="px-3 py-3 text-center tabular-nums text-muted-foreground">{standing.played}</td>}
                  {!compact && <td className="px-3 py-3 text-center tabular-nums">{standing.win}</td>}
                  {!compact && <td className="px-3 py-3 text-center tabular-nums">{standing.draw}</td>}
                  {!compact && <td className="px-3 py-3 text-center tabular-nums">{standing.loss}</td>}
                  <td className={cn('px-3 py-3 text-center tabular-nums', standing.gd > 0 ? 'text-success' : standing.gd < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                    {standing.gd > 0 ? `+${standing.gd}` : standing.gd}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="font-headline text-base font-bold tabular-nums text-primary">{standing.points}</span>
                  </td>
                  <td className="px-4 py-3">
                    <FormLetters form={standing.form} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-secondary/20 px-4 py-2.5 text-[11px] text-muted-foreground">
          <span>Form: W won · D draw · L lost</span>
          <span>GD = goal difference</span>
        </div>
      )}
      {compact && (
        <div className="border-t border-border/70 bg-secondary/20 px-4 py-2.5">
          <Link href="/standings" className="link-arrow">
            Full table <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}