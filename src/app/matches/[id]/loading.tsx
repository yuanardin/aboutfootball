import { Skeleton } from '@/components/ui/skeleton';

export default function MatchDetailLoading() {
  return (
    <div className="page-shell min-w-0 py-10 sm:py-14">
      <Skeleton className="h-5 w-28" />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Skeleton className="h-7 w-44 rounded-full" />
        <Skeleton className="h-7 w-28 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-10 w-full max-w-xl" />
      <Skeleton className="mt-2 h-5 w-64 max-w-full" />

      <div className="card-surface mt-6 p-5 sm:p-8">
        <div className="flex justify-center">
          <Skeleton className="h-6 w-16 rounded-md" />
        </div>
        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-6">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-5 w-24 max-w-full" />
          </div>
          <Skeleton className="mx-auto mt-2 h-12 w-28" />
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-5 w-24 max-w-full" />
          </div>
        </div>
      </div>

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card-surface min-w-0 p-5 sm:p-6">
          <Skeleton className="h-7 w-48" />
          <div className="mt-4 space-y-2.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-5 w-full" />
            ))}
          </div>
        </div>
        <div className="card-surface min-w-0 p-5 sm:p-6">
          <Skeleton className="h-7 w-32" />
          <div className="mt-4 space-y-2.5">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
