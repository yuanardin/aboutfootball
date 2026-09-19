import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function NewsCardSkeleton({ featured = false }: { featured?: boolean }) {
  return (
    <div className={cn('card-surface overflow-hidden', featured && 'md:grid md:grid-cols-[1.18fr_1fr]')}>
      <Skeleton className={featured ? 'aspect-[16/10] w-full md:min-h-full' : 'aspect-[16/9] w-full'} />
      <div className="space-y-3 p-5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}