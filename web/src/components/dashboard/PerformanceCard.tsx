"use client";

import type { DashboardData } from "@/types/dashboard";

export function PerformanceCard({
  data,
}: {
  data: DashboardData["performance"];
}) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (data.overall / 100) * c;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-slate-800">
        Hiệu suất nhân sự
      </h2>

      <div className="flex items-center gap-5">
        <div className="relative h-36 w-36 shrink-0">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke="#EEF2FF"
              strokeWidth="12"
            />
            <circle
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke="url(#perfGrad)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={offset}
            />
            <defs>
              <linearGradient id="perfGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6366F1" />
                <stop offset="100%" stopColor="#A855F7" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-slate-800">
              {data.overall}%
            </span>
            <span className="text-[11px] text-slate-400">Hiệu suất chung</span>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-3">
          {data.metrics.map((metric) => (
            <li key={metric.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-slate-500">{metric.label}</span>
                <span className="font-semibold text-slate-700">
                  {metric.value}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${metric.value}%`,
                    backgroundColor: metric.color,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
