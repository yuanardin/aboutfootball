import { CircleAlert, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ErrorState({
  onRetry,
  title = 'Something went wrong',
  description = "We couldn't load the latest data.",
}: {
  onRetry?: () => void;
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-8 text-center">
      <CircleAlert className="h-6 w-6 text-destructive" />
      <h3 className="mt-3 font-headline text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-5">
          <RefreshCw />
          Try again
        </Button>
      )}
    </div>
  );
}
