export default function NewsLoading() {
  return (
    <div className="page-shell pb-20 pt-10 sm:pt-14">
      <div className="h-5 w-28 animate-pulse rounded-full bg-secondary" />
      <div className="mt-5 h-12 w-64 animate-pulse rounded-xl bg-secondary" />
      <div className="mt-4 h-5 w-full max-w-xl animate-pulse rounded bg-secondary" />
      <div className="mt-8 h-12 w-full max-w-xl animate-pulse rounded-xl bg-secondary" />
      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-80 animate-pulse rounded-xl bg-secondary" />
        ))}
      </div>
    </div>
  );
}
