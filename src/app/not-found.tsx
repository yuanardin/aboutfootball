import Link from 'next/link';
import { Home, Newspaper, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="page-shell flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <p className="font-headline text-7xl font-bold tracking-tight text-primary sm:text-8xl">404</p>
      <h1 className="text-page-title mt-3">Page not found</h1>
      <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has moved. Double-check the link, or head
        back to the action.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/">
            <Home className="h-4 w-4" aria-hidden="true" />
            Back to home
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/news">
            <Newspaper className="h-4 w-4" aria-hidden="true" />
            Browse news
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/results">
            <Search className="h-4 w-4" aria-hidden="true" />
            Check results
          </Link>
        </Button>
      </div>
    </div>
  );
}