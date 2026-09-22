'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { signOut, updateProfile } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { GoogleIcon } from '@/components/icons/google-icon';
import { useAuth, useUser } from '@/firebase';
import { getFirebaseErrorMessage } from '@/lib/firebase-errors';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Loader2, LogOut, Mail, UserCircle, UserRoundCheck } from 'lucide-react';

const DISPLAY_NAME_MAX = 40;

function avatarInitials(user: User) {
  if (user.displayName) {
    return user.displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  }
  return (user.email?.charAt(0) ?? '?').toUpperCase();
}

function getSignInMethod(user: User): { id: string; label: string } {
  const providerIds = user.providerData.map((entry) => entry.providerId);
  if (providerIds.includes('google.com')) return { id: 'google.com', label: 'Google' };
  if (providerIds.includes('password') || providerIds.length === 0) {
    return { id: 'password', label: 'Email' };
  }
  return { id: providerIds[0] ?? 'unknown', label: providerIds[0] ?? 'Unknown' };
}

function isValidPhotoUrl(value: string) {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

type FieldErrors = { displayName?: string; photoUrl?: string };

function ProfileLoadingSkeleton() {
  return (
    <div className="page-shell py-10 sm:py-14">
      <div className="mx-auto w-full max-w-2xl">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="mt-3 h-9 w-56" />
        <Skeleton className="mt-3 h-5 w-full max-w-md" />

        <div className="card-surface mt-8 p-6 sm:p-8">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="flex-1 space-y-2 text-center sm:text-left">
              <Skeleton className="h-6 w-40 max-w-full" />
              <Skeleton className="h-4 w-56 max-w-full" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        </div>

        <div className="card-surface mt-6 p-6 sm:p-8">
          <Skeleton className="h-5 w-40" />
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="mt-2 h-11 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const auth = useAuth();
  const { data: user, isLoading } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const displayNameRef = useRef<HTMLInputElement>(null);
  const photoUrlRef = useRef<HTMLInputElement>(null);

  const redirecting = !isLoading && !user;

  useEffect(() => {
    if (redirecting) {
      router.replace('/login');
    }
  }, [redirecting, router]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? '');
      setPhotoUrl(user.photoURL ?? '');
      setFieldErrors({});
      setFormError(null);
    }
  }, [user?.uid, user?.displayName, user?.photoURL]);

  if (isLoading) {
    return <ProfileLoadingSkeleton />;
  }

  if (!user) {
    return null;
  }

  const method = getSignInMethod(user);
  const initials = avatarInitials(user);
  const previewUrl = photoUrl.trim();

  const clearFieldError = (field: keyof FieldErrors) => {
    if (saving || signingOut) return;
    setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
    setFormError(null);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || saving || signingOut) return;

    setFormError(null);
    const errors: FieldErrors = {};
    const name = displayName.trim();
    const photo = photoUrl.trim();

    if (!name) {
      errors.displayName = 'Enter your display name.';
    } else if (name.length > DISPLAY_NAME_MAX) {
      errors.displayName = `Keep it under ${DISPLAY_NAME_MAX} characters.`;
    }
    if (!isValidPhotoUrl(photo)) {
      errors.photoUrl = 'Enter a valid image URL starting with http:// or https://.';
    }

    setFieldErrors(errors);
    if (errors.displayName) {
      displayNameRef.current?.focus();
      return;
    }
    if (errors.photoUrl) {
      photoUrlRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      await updateProfile(user, { displayName: name, photoURL: photo || null });
      toast({ title: 'Profile updated', description: 'Your changes have been saved.' });
    } catch (error: any) {
      const message = getFirebaseErrorMessage(error?.code);
      setFormError(message);
      toast({ variant: 'destructive', title: 'Update failed', description: message });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth || signingOut || saving) return;
    setSigningOut(true);
    try {
      await signOut(auth);
      toast({ description: 'You have been signed out.' });
      router.push('/');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Unable to sign out',
        description: getFirebaseErrorMessage(error?.code),
      });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="page-shell py-10 sm:py-14">
      <div className="mx-auto w-full max-w-2xl">
        <p className="eyebrow">Account</p>
        <h1 className="mt-2 text-page-title [text-wrap:balance]">Your profile</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
          Manage how you show up on ScoreCast — your identity is stored securely with Firebase
          Authentication.
        </p>

        <Card className="card-surface mt-8 p-6 sm:p-8">
          <CardContent className="p-0">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
              <Avatar className="h-20 w-20 ring-2 ring-primary/20">
                <AvatarImage src={user.photoURL ?? ''} alt={user.displayName ?? 'Profile photo'} />
                <AvatarFallback className="text-xl">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-card-title truncate text-lg sm:text-xl">
                  {user.displayName || 'ScoreCast member'}
                </p>
                <p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p>
                <div className="mt-3 flex items-center justify-center gap-2 sm:justify-start">
                  <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 text-xs">
                    {method.id === 'google.com' ? (
                      <GoogleIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Signed in with {method.label}
                  </Badge>
                  {user.emailVerified && (
                    <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs">
                      <UserRoundCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                      Email verified
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-surface mt-6">
          <CardHeader className="border-b border-border/60 px-6 py-5 sm:px-8">
            <h2 className="text-card-title text-lg">Edit profile</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Update your display name or profile photo. Changes apply across ScoreCast.
            </p>
          </CardHeader>
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSave} noValidate aria-busy={saving}>
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14 shrink-0">
                  <AvatarImage
                    src={previewUrl || user.photoURL || ''}
                    alt="Profile photo preview"
                  />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="display-name">Display name</Label>
                    <Input
                      id="display-name"
                      ref={displayNameRef}
                      name="displayName"
                      type="text"
                      placeholder="Your name"
                      autoComplete="name"
                      maxLength={60}
                      spellCheck={false}
                      value={displayName}
                      disabled={saving || signingOut}
                      onChange={(e) => setDisplayName(e.target.value)}
                      onInput={() => clearFieldError('displayName')}
                      aria-invalid={Boolean(fieldErrors.displayName)}
                      aria-describedby={fieldErrors.displayName ? 'display-name-error' : 'display-name-hint'}
                      className={cn(
                        'input-surface',
                        fieldErrors.displayName && 'border-destructive focus-visible:ring-destructive'
                      )}
                    />
                    {fieldErrors.displayName ? (
                      <p id="display-name-error" className="text-sm text-destructive" role="alert">
                        {fieldErrors.displayName}
                      </p>
                    ) : (
                      <p id="display-name-hint" className="text-xs text-muted-foreground">
                        Up to {DISPLAY_NAME_MAX} characters.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="photo-url">Profile photo URL</Label>
                    <Input
                      id="photo-url"
                      ref={photoUrlRef}
                      name="photoUrl"
                      type="url"
                      inputMode="url"
                      placeholder="https://example.com/your-photo.jpg"
                      autoComplete="off"
                      spellCheck={false}
                      value={photoUrl}
                      disabled={saving || signingOut}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      onInput={() => clearFieldError('photoUrl')}
                      aria-invalid={Boolean(fieldErrors.photoUrl)}
                      aria-describedby={fieldErrors.photoUrl ? 'photo-url-error' : 'photo-url-hint'}
                      className={cn(
                        'input-surface',
                        fieldErrors.photoUrl && 'border-destructive focus-visible:ring-destructive'
                      )}
                    />
                    {fieldErrors.photoUrl ? (
                      <p id="photo-url-error" className="text-sm text-destructive" role="alert">
                        {fieldErrors.photoUrl}
                      </p>
                    ) : (
                      <p id="photo-url-hint" className="text-xs text-muted-foreground">
                        Paste a link to your photo. Leave empty to use your initials.
                      </p>
                    )}
                  </div>
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

              <Button type="submit" size="lg" className="mt-6 w-full sm:w-auto" disabled={saving || signingOut}>
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Saving...
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="card-surface mt-6">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-card-title text-base">Sign out</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Sign out of ScoreCast on this device. You can log back in anytime.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleSignOut}
                disabled={signingOut || saving}
                className="w-full sm:w-auto sm:shrink-0"
              >
                {signingOut ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Signing out...
                  </>
                ) : (
                  <>
                    <LogOut className="size-4" aria-hidden="true" />
                    Sign out
                  </>
                )}
              </Button>
            </div>

            <p className="mt-6 border-t border-border/60 pt-5 text-xs leading-5 text-muted-foreground">
              Want to switch accounts?{' '}
              <Link
                href="/login"
                className="font-semibold text-primary transition hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                Log in as someone else
              </Link>
              . Need a fresh account?{' '}
              <Link
                href="/register"
                className="font-semibold text-primary transition hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                Sign up
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <UserCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Saved articles and AI history are coming soon.
        </p>
      </div>
    </div>
  );
}