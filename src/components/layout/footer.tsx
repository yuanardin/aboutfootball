import Link from 'next/link';
import { Logo } from '../icons/logo';
import { footballDataConfigured } from '@/lib/football-data/service';

const columns = [
  {
    title: 'Explore',
    links: [
      { label: 'News', href: '/news' },
      { label: 'Results', href: '/results' },
      { label: 'Standings', href: '/standings' },
    ],
  },
  {
    title: 'Tools',
    links: [{ label: 'AI Summarizer', href: '/summarizer' }],
  },
  {
    title: 'Account',
    links: [
      { label: 'Log in', href: '/login' },
      { label: 'Create account', href: '/register' },
    ],
  },
];

export async function Footer() {
  const liveConnected = footballDataConfigured();

  return (
    <footer className="mt-16 border-t border-border/80 bg-card/40">
      <div className="page-shell grid gap-10 py-12 lg:grid-cols-[1.1fr_1.6fr]">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="ScoreCast home"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
              <Logo className="h-5 w-5" />
            </span>
            <span className="font-headline text-lg font-bold tracking-tight">ScoreCast</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
            Football news, scores and insights — without the clutter.
          </p>
          <p role="status" className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={`h-1.5 w-1.5 rounded-full ${liveConnected ? 'bg-success' : 'bg-warning'}`}
              aria-hidden="true"
            />
            {liveConnected
              ? 'Live football-data feeds connected.'
              : 'Live football-data feeds unavailable right now.'}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {columns.map((column) => (
            <nav key={column.title} aria-label={`Footer — ${column.title}`}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{column.title}</h3>
              <ul className="mt-3 space-y-2.5">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="rounded-md text-sm text-muted-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="page-shell py-5 text-xs text-muted-foreground">
          © {new Date().getFullYear()} ScoreCast. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
