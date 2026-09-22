import { Skeleton } from '@/components/ui/skeleton';

export default function StandingsLoading() {
  return (
    <div className="page-shell py-10 sm:py-14">
      <section className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-3 h-12 w-72" />
          <Skeleton className="mt-4 h-5 w-full max-w-md" />
        </div>
        <Skeleton className="h-8 w-44 rounded-full" />
      </section>

      <div className="mt-10 space-y-2">
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}