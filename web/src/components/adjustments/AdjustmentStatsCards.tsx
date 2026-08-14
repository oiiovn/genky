"use client";

import clsx from "clsx";
import {
  Award,
  Ban,
  FileSpreadsheet,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { formatMoney, type AdjustmentStats } from "@/lib/adjustments";

export function AdjustmentStatsCards({ stats }: { stats: AdjustmentStats }) {
  const cards = [
    {
      key: "reward",
      label: "Tổng thưởng",
      value: formatMoney(stats.reward_total),
      delta: stats.reward_delta,
      icon: Award,
      tone: "bg-emerald-50 text-emerald-500",
      up: true,
    },
    {
      key: "penalty",
      label: "Tổng phạt",
      value: formatMoney(stats.penalty_total),
      delta: stats.penalty_delta,
      icon: Ban,
      tone: "bg-rose-50 text-rose-500",
      up: stats.penalty_delta >= 0,
    },
    {
      key: "total",
      label: "Tổng ghi nhận",
      value: formatMoney(stats.recorded_total),
      delta: stats.recorded_delta,
      icon: FileSpreadsheet,
      tone: "bg-sky-50 text-sky-500",
      up: true,
    },
    {
      key: "rew_emp",
      label: "NV được thưởng",
      value: String(stats.rewarded_employees),
      delta: null as number | null,
      icon: Users,
      tone: "bg-violet-50 text-violet-500",
      up: true,
    },
    {
      key: "pen_emp",
      label: "NV bị phạt",
      value: String(stats.penalized_employees),
      delta: null as number | null,
      icon: Users,
      tone: "bg-amber-50 text-amber-500",
      up: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-1 truncate text-lg font-bold text-slate-800">
                  {card.value}
                </p>
                {card.delta != null ? (
                  <p
                    className={clsx(
                      "mt-1 inline-flex items-center gap-1 text-xs font-medium",
                      card.up ? "text-emerald-500" : "text-rose-500",
                    )}
                  >
                    {card.up ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {card.delta > 0 ? "+" : ""}
                    {card.delta}% so với tháng trước
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">Trong tháng</p>
                )}
              </div>
              <div
                className={clsx(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  card.tone,
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
