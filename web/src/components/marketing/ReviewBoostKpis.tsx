"use client";

import clsx from "clsx";
import { Gift, ShieldCheck, Star, Ticket } from "lucide-react";
import type { ReviewBoostKpi } from "@/lib/review-boost-types";
import { formatReviewCount } from "@/lib/review-boost-demo";

const iconMap = {
  reviews: Star,
  verified: ShieldCheck,
  codes: Ticket,
  redeemed: Gift,
} as const;

const toneMap = {
  reviews: "bg-violet-500",
  verified: "bg-emerald-500",
  codes: "bg-sky-500",
  redeemed: "bg-orange-500",
} as const;

export function ReviewBoostKpis({ items }: { items: ReviewBoostKpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4 xl:gap-4">
      {items.map((kpi) => {
        const Icon = iconMap[kpi.id];
        const up = kpi.deltaPct >= 0;
        return (
          <article
            key={kpi.id}
            className="rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] xl:border-slate-200 xl:p-4 xl:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-slate-500 xl:text-sm">{kpi.label}</p>
                <p className="mt-1 text-xl font-bold tracking-tight text-slate-900 xl:text-2xl">
                  {formatReviewCount(kpi.value)}
                </p>
                <p
                  className={clsx(
                    "mt-1 text-[12px] font-semibold xl:text-sm",
                    up ? "text-emerald-500" : "text-rose-500",
                  )}
                >
                  {up ? "↑" : "↓"} {Math.abs(kpi.deltaPct).toFixed(1)}%
                </p>
                {kpi.sub ? (
                  <p className="mt-1 text-[10px] text-slate-400 xl:text-xs">{kpi.sub}</p>
                ) : null}
              </div>
              <span
                className={clsx(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white xl:h-11 xl:w-11",
                  toneMap[kpi.id],
                )}
              >
                <Icon className="h-4 w-4 xl:h-5 xl:w-5" />
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
