import { Skeleton } from '@/components/ui/skeleton';
import { NewsCardSkeleton } from '@/components/news/news-card-skeleton';

export default function HomeLoading() {
  return (
    <div className="pb-20">
      <section className="page-shell pt-10 sm:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="mt-5 h-14 w-full max-w-xl" />
            <Skeleton className="mt-4 h-24 w-full max-w-xl" />
            <div className="mt-8 flex gap-3">
              <Skeleton className="h-11 w-36 rounded-lg" />
              <Skeleton className="h-11 w-40 rounded-lg" />
            </div>
          </div>
          <Skeleton className="aspect-[4/3] w-full rounded-xl sm:aspect-[16/10] lg:aspect-auto lg:h-[430px]" />
        </div>
        <Skeleton className="mx-auto mt-10 h-12 w-full max-w-3xl rounded-lg sm:mt-12" />
      </section>

      <div className="page-shell mt-10 space-y-14 sm:mt-12 sm:space-y-16">
        <section className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-3">
            <Skeleton className="h-10 w-56" />
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={`home-match-skeleton-${index}`} className="h-20 w-full rounded-lg" />
            ))}
          </div>
          <div>
            <Skeleton className="h-10 w-44" />
            <Skeleton className="mt-3 h-72 w-full rounded-xl" />
          </div>
        </section>

        <section>
          <Skeleton className="h-10 w-48" />
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <NewsCardSkeleton key={`home-news-skeleton-${index}`} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}