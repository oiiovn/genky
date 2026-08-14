"use client";

import clsx from "clsx";
import {
  CalendarDays,
  Clock3,
  Timer,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  formatHours,
  formatMoney,
  type TimesheetStats,
} from "@/lib/timesheet";

export function TimesheetStatsCards({ stats }: { stats: TimesheetStats }) {
  const cards = [
    {
      key: "employees",
      label: "Tổng nhân viên",
      value: String(stats.employees),
      delta: stats.employees_delta,
      deltaSuffix: " vs tháng trước",
      icon: Users,
      tone: "bg-violet-50 text-violet-500",
    },
    {
      key: "hours",
      label: "Tổng giờ làm",
      value: formatHours(stats.work_minutes),
      delta: stats.work_hours_delta,
      deltaSuffix: "%",
      icon: Clock3,
      tone: "bg-sky-50 text-sky-500",
    },
    {
      key: "ot",
      label: "Giờ làm thêm",
      value: formatHours(stats.ot_minutes),
      delta: stats.ot_delta,
      deltaSuffix: "%",
      icon: Timer,
      tone: "bg-rose-50 text-rose-500",
    },
    {
      key: "avg",
      label: "Ngày công TB",
      value: stats.avg_work_days.toLocaleString("vi-VN", {
        maximumFractionDigits: 1,
      }),
      delta: stats.avg_days_delta,
      deltaSuffix: "",
      icon: CalendarDays,
      tone: "bg-indigo-50 text-indigo-500",
    },
    {
      key: "cost",
      label: "Chi phí nhân sự ước tính",
      value: formatMoney(stats.estimated_cost),
      delta: stats.cost_delta,
      deltaSuffix: "%",
      icon: Wallet,
      tone: "bg-emerald-50 text-emerald-500",
      wide: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        const positive = card.delta >= 0;
        return (
          <div
            key={card.key}
            className={clsx(
              "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
              card.wide && "sm:col-span-2 xl:col-span-1",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-1 truncate text-xl font-bold text-slate-800">
                  {card.value}
                </p>
                <p
                  className={clsx(
                    "mt-1 inline-flex items-center gap-1 text-xs font-medium",
                    positive ? "text-emerald-500" : "text-rose-500",
                  )}
                >
                  <TrendingUp
                    className={clsx(
                      "h-3 w-3",
                      !positive && "rotate-180",
                    )}
                  />
                  {positive ? "+" : ""}
                  {card.delta}
                  {card.deltaSuffix}
                </p>
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
