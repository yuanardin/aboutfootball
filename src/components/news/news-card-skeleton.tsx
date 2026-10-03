import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function NewsCardSkeleton({ featured = false }: { featured?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn('card-surface overflow-hidden', featured && 'md:grid md:grid-cols-[1.18fr_1fr]')}
    >
      <Skeleton className={featured ? 'aspect-[16/10] w-full rounded-none md:min-h-full' : 'aspect-[16/9] w-full rounded-none'} />
      <div className={cn('space-y-3', featured ? 'p-6 sm:p-8' : 'p-5')}>
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}