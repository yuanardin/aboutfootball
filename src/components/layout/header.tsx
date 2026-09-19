'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Bookmark,
  Bot,
  History,
  ListOrdered,
  LogOut,
  Menu,
  Newspaper,
  Settings,
  UserCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Logo } from '../icons/logo';
import { useAuth } from '@/firebase';
import { useUser } from '@/firebase/auth/use-user';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/news', label: 'News', icon: Newspaper },
  { href: '/results', label: 'Results', icon: BarChart3 },
  { href: '/standings', label: 'Standings', icon: ListOrdered },
  { href: '/summarizer', label: 'AI Summarizer', icon: Bot },
];

function isActive(href: string, pathname: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function Header() {
  const auth = useAuth();
  const { data: user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      toast({ description: 'You have been signed out.' });
      router.push('/');
    } catch {
      toast({ variant: 'destructive', title: 'Unable to sign out', description: 'Please try again.' });
    }
  };

  const handleUnavailable = (feature: string) =>
    toast({
      title: `${feature} is coming soon`,
      description: 'This area will be available when account storage is connected.',
    });

  const DesktopNav = () => (
    <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
      {navLinks.map((link) => {
        const active = isActive(link.href, pathname);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'text-foreground after:absolute after:-bottom-[23px] after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <Icon className={cn('h-4 w-4', active && 'text-primary')} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );

  const MobileNav = () => (
    <nav className="flex flex-col gap-1" aria-label="Primary navigation">
      {navLinks.map((link) => {
        const active = isActive(link.href, pathname);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="page-shell flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="ScoreCast home"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <Logo className="h-5 w-5" />
          </span>
          <span className="font-headline text-lg font-bold tracking-tight">
            Score<span className="text-primary">Cast</span>
          </span>
        </Link>

        <DesktopNav />

        <div className="flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" aria-label="Open profile menu">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.photoURL ?? ''} alt={user.displayName ?? 'User'} />
                    <AvatarFallback>
                      {user.displayName?.charAt(0) ?? user.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="truncate text-sm">{user.displayName || 'ScoreCast member'}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleUnavailable('Profile')}>
                  <UserCircle className="mr-2 h-4 w-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleUnavailable('Saved articles')}>
                  <Bookmark className="mr-2 h-4 w-4" /> Saved articles
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleUnavailable('AI history')}>
                  <History className="mr-2 h-4 w-4" /> AI history
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleUnavailable('Preferences')}>
                  <Settings className="mr-2 h-4 w-4" /> Preferences
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild className="hidden sm:inline-flex">
                <Link href="/register">Join ScoreCast</Link>
              </Button>
            </>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] border-border bg-background p-5">
              <Link href="/" className="mb-8 flex items-center gap-2.5" aria-label="ScoreCast home">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
                  <Logo className="h-5 w-5" />
                </span>
                <span className="font-headline text-lg font-bold tracking-tight">ScoreCast</span>
              </Link>
              <MobileNav />
              <div className="mt-7 border-t border-border pt-5 sm:hidden">
                <Button asChild className="w-full">
                  <Link href="/register">Join ScoreCast</Link>
                </Button>
                <Button asChild variant="ghost" className="mt-2 w-full">
                  <Link href="/login">Log in</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
