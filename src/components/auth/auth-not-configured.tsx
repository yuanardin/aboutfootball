'use client';

import { LockKeyhole } from 'lucide-react';
import { CardContent } from '@/components/ui/card';

const REQUIRED_FIREBASE_KEYS = [
  { name: 'NEXT_PUBLIC_FIREBASE_API_KEY', present: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) },
  { name: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', present: Boolean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) },
  { name: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', present: Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) },
  { name: 'NEXT_PUBLIC_FIREBASE_APP_ID', present: Boolean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID) },
];

const missingKeys = REQUIRED_FIREBASE_KEYS.filter((entry) => !entry.present).map(
  (entry) => entry.name
);

export function AuthNotConfigured({ mode }: { mode: 'login' | 'register' }) {
  const action = mode === 'login' ? 'sign in' : 'sign up';

  return (
    <CardContent className="pb-8">
      <div
        className="flex flex-col items-center rounded-xl border border-dashed border-border bg-secondary/20 px-6 py-8 text-center"
        role="group"
        aria-label="Authentication status"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" aria-hidden="true" />
          Status — not configured
        </span>
        <span className="mt-4 grid h-12 w-12 place-items-center rounded-full bg-secondary text-muted-foreground">
          <LockKeyhole className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="mt-3 text-card-title text-base">Authentication not configured</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">
          Email and Google {action} will appear here automatically once the Firebase keys are added
          to <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">.env.local</code>.
        </p>
        {missingKeys.length > 0 && (
          <div className="mt-4 w-full rounded-lg border border-border bg-background/60 p-3 text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Missing keys
            </p>
            <ul className="mt-1.5 space-y-1">
              {missingKeys.map((key) => (
                <li key={key} className="font-mono text-xs leading-5 text-muted-foreground/90">
                  {key}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </CardContent>
  );
}