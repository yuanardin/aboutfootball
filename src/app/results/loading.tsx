import { Skeleton } from '@/components/ui/skeleton';

export default function ResultsLoading() {
  return (
    <div className="page-shell py-10 sm:py-14">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-3 h-12 w-72" />
          <Skeleton className="mt-4 h-5 w-full max-w-md" />
        </div>
        <Skeleton className="h-8 w-44 rounded-full" />
      </header>

      <Skeleton className="mt-8 h-16 w-full rounded-xl sm:mt-10" />
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="mt-6 h-20 w-full rounded-lg" />
      ))}
    </div>
  );
}