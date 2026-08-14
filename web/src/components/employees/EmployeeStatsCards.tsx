"use client";

import clsx from "clsx";
import {
  UserMinus,
  UserCheck,
  Users,
  Umbrella,
} from "lucide-react";

export type EmployeeStats = {
  total: number;
  active: number;
  resigned: number;
  leave: number;
};

export function EmployeeStatsCards({ stats }: { stats: EmployeeStats }) {
  const activePct =
    stats.total > 0 ? ((stats.active / stats.total) * 100).toFixed(1) : "0";
  const resignedPct =
    stats.total > 0 ? ((stats.resigned / stats.total) * 100).toFixed(1) : "0";
  const leavePct =
    stats.total > 0 ? ((stats.leave / stats.total) * 100).toFixed(1) : "0";

  const cards = [
    {
      label: "Tổng nhân viên",
      value: stats.total,
      hint: "Tất cả hồ sơ",
      icon: Users,
      tone: "bg-indigo-50 text-indigo-500",
    },
    {
      label: "Đang làm việc",
      value: stats.active,
      hint: `${activePct}% tổng số`,
      icon: UserCheck,
      tone: "bg-emerald-50 text-emerald-500",
    },
    {
      label: "Nghỉ việc",
      value: stats.resigned,
      hint: `${resignedPct}% tổng số`,
      icon: UserMinus,
      tone: "bg-rose-50 text-rose-500",
    },
    {
      label: "Nghỉ phép",
      value: stats.leave,
      hint: `${leavePct}% tổng số`,
      icon: Umbrella,
      tone: "bg-amber-50 text-amber-500",
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
