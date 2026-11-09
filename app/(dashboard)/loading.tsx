export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Carregando página" className="space-y-5 animate-pulse">
      <span className="sr-only">Carregando página...</span>
      <div className="h-8 w-48 rounded-lg bg-slate-200" />
      <div className="h-4 w-full max-w-md rounded bg-slate-100" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 rounded-2xl bg-slate-100" />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-72 rounded-2xl bg-slate-100" />
        <div className="h-72 rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}
