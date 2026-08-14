export function PageLoadingSkeleton() {
  return (
    <div className="flex min-h-screen animate-pulse bg-[#F3F4F6]">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-5 lg:block">
        <div className="h-10 w-32 rounded-xl bg-slate-200" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="h-10 rounded-xl bg-slate-100" />
          ))}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 lg:px-7">
          <div>
            <div className="h-5 w-40 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-64 rounded bg-slate-100" />
          </div>
          <div className="h-10 w-10 rounded-full bg-slate-200" />
        </header>

        <main className="p-5 lg:p-6">
          <div className="h-7 w-48 rounded bg-slate-200" />
          <div className="mt-2 h-4 w-72 rounded bg-slate-100" />

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-28 rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="h-14 border-b border-slate-100 bg-slate-50/60" />
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="h-16 border-b border-slate-100 last:border-0"
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
