"use client";

import clsx from "clsx";
import { Gift, Package, ShieldCheck, Star } from "lucide-react";
import type { ReviewBoostKpi } from "@/lib/review-boost-types";
import { formatReviewCount } from "@/lib/review-boost-demo";

const iconMap = {
  reviews: Star,
  verified: ShieldCheck,
  codes: Gift,
  redeemed: Package,
} as const;

const toneMap = {
  reviews: "bg-blue-500",
  verified: "bg-emerald-500",
  codes: "bg-amber-500",
  redeemed: "bg-sky-500",
} as const;

export function ReviewBoostKpis({ items }: { items: ReviewBoostKpi[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((kpi) => {
        const Icon = iconMap[kpi.id];
        return (
          <article
            key={kpi.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">{kpi.label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  {formatReviewCount(kpi.value)}
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-500">
                  ↑ {kpi.deltaPct.toFixed(1)}%
                </p>
                {kpi.sub ? (
                  <p className="mt-1 text-xs text-slate-400">{kpi.sub}</p>
                ) : null}
              </div>
              <span
                className={clsx(
                  "flex h-11 w-11 items-center justify-center rounded-xl text-white",
                  toneMap[kpi.id],
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
