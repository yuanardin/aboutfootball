export default function ArticleLoading() {
  return (
    <div className="page-shell py-12">
      <div className="h-5 w-28 animate-pulse rounded-full bg-secondary" />
      <div className="mt-5 h-12 w-full max-w-3xl animate-pulse rounded-xl bg-secondary" />
      <div className="mt-4 h-5 w-full max-w-xl animate-pulse rounded bg-secondary" />
      <div className="mt-8 h-[320px] animate-pulse rounded-xl bg-secondary" />
      <div className="mt-8 h-28 animate-pulse rounded-xl bg-secondary" />
    </div>
  );
}
