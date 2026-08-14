"use client";

import clsx from "clsx";
import { Clock, Users, UserRound, DoorOpen } from "lucide-react";
import type { ShiftSummary } from "@/lib/shifts-api";

export function ShiftStatsCards({ stats }: { stats: ShiftSummary }) {
  const cards = [
    {
      label: "Tổng số ca",
      value: stats.total,
      hint: "Trong tổ chức / chi nhánh",
      icon: Clock,
      tone: "bg-indigo-50 text-indigo-500",
    },
    {
      label: "Ca đang hoạt động",
      value: stats.active,
      hint: `${stats.active_percent}% tổng số ca`,
      icon: UserRound,
      tone: "bg-emerald-50 text-emerald-500",
    },
    {
      label: "Nhân viên theo ca hôm nay",
      value: stats.employees_today,
      hint: `${stats.ongoing_shifts} ca đang diễn ra`,
      icon: Users,
      tone: "bg-amber-50 text-amber-500",
    },
    {
      label: "Ca trống hôm nay",
      value: stats.open_slots,
      hint: `Cần phân cho ${stats.open_slots} vị trí`,
      icon: DoorOpen,
      tone: "bg-sky-50 text-sky-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-slate-400">{card.hint}</p>
              </div>
              <div
                className={clsx(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
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
