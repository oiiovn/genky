export default function StaffLoading() {
  return (
    <div className="min-h-dvh animate-pulse bg-[#0B1220] px-4 pb-24 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] text-white">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-4 w-24 rounded bg-white/10" />
            <div className="mt-2 h-7 w-44 rounded bg-white/15" />
          </div>
          <div className="h-11 w-11 rounded-full bg-white/10" />
        </div>

        <div className="mt-7 h-44 rounded-3xl bg-white/10" />
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="h-28 rounded-2xl bg-white/10" />
          <div className="h-28 rounded-2xl bg-white/10" />
        </div>
        <div className="mt-5 space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-16 rounded-2xl bg-white/10" />
          ))}
        </div>
      </div>

      <div className="fixed inset-x-3 bottom-3 mx-auto h-16 max-w-lg rounded-2xl bg-white/10" />
    </div>
  );
}
