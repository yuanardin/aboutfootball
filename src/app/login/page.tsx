'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GoogleIcon } from '@/components/icons/google-icon';
import { AuthNotConfigured } from '@/components/auth/auth-not-configured';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useIsAuthEnabled } from '@/firebase';
import { getFirebaseErrorMessage } from '@/lib/firebase-errors';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = { email?: string; password?: string };

function validateLogin(values: { email: string; password: string }): FieldErrors {
  const errors: FieldErrors = {};
  const email = values.email.trim();

  if (!email) {
    errors.email = 'Enter your email address.';
  } else if (!EMAIL_RE.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!values.password) {
    errors.password = 'Enter your password.';
  }

  return errors;
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative my-5" aria-hidden="true">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-card px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {children}
        </span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const authEnabled = useIsAuthEnabled();
  const auth = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const busy = submitting || googlePending;

  const handleGoogleSignIn = async () => {
    if (!auth || busy) return;
    setFormError(null);
    setGooglePending(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast({ title: 'Success', description: "You've successfully signed in." });
      router.push('/');
    } catch (error: any) {
      const code = error?.code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        toast({ variant: 'destructive', title: 'Sign in failed', description: getFirebaseErrorMessage(code) });
      }
    } finally {
      setGooglePending(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!auth || busy) return;

    setFormError(null);
    const errors = validateLogin({ email, password });
    setFieldErrors(errors);
    if (errors.email) {
      emailRef.current?.focus();
      return;
    }
    if (errors.password) {
      passwordRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      toast({ title: 'Success', description: "You've successfully signed in." });
      router.push('/');
    } catch (error: any) {
      setFormError(getFirebaseErrorMessage(error?.code));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleField = (field: 'email' | 'password') => {
    if (submitting || googlePending) return;
    setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
    setFormError(null);
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <Card className="card-surface w-full max-w-md">
        <CardHeader className="text-center">
          <p className="eyebrow">Account</p>
          <h1 className="text-card-title text-2xl [text-wrap:balance]">Log in to ScoreCast</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Back in the game — your teams, stories and picks, all in one place.
          </p>
        </CardHeader>

        {!authEnabled || !auth ? (
          <AuthNotConfigured mode="login" />
        ) : (
          <CardContent>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={busy}
            >
              {googlePending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Connecting to Google...
                </>
              ) : (
                <>
                  <GoogleIcon className="size-4" aria-hidden="true" />
                  Continue with Google
                </>
              )}
            </Button>

            <Divider>Or continue with email</Divider>

            <form onSubmit={handleEmailSignIn} noValidate aria-busy={submitting}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    ref={emailRef}
                    type="email"
                    name="email"
                    placeholder="striker@example.com"
                    required
                    autoComplete="email"
                    spellCheck={false}
                    value={email}
                    disabled={busy}
                    onChange={(e) => setEmail(e.target.value)}
                    onInput={() => handleGoogleField('email')}
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                    className={cn(
                      'input-surface',
                      fieldErrors.email && 'border-destructive focus-visible:ring-destructive'
                    )}
                  />
                  {fieldErrors.email && (
                    <p id="email-error" className="text-sm text-destructive" role="alert">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    ref={passwordRef}
                    type="password"
                    name="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    disabled={busy}
                    onChange={(e) => setPassword(e.target.value)}
                    onInput={() => handleGoogleField('password')}
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                    className={cn(
                      'input-surface',
                      fieldErrors.password && 'border-destructive focus-visible:ring-destructive'
                    )}
                  />
                  {fieldErrors.password && (
                    <p id="password-error" className="text-sm text-destructive" role="alert">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>
              </div>

              {formError && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm leading-6 text-destructive"
                >
                  {formError}
                </p>
              )}

              <Button type="submit" size="lg" className="mt-6 w-full" disabled={busy}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Signing in...
                  </>
                ) : (
                  'Log in'
                )}
              </Button>
            </form>
          </CardContent>
        )}

        <CardFooter className="justify-center px-6 pb-6 pt-0 text-center text-sm">
          <p className="text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="font-semibold text-primary transition hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
