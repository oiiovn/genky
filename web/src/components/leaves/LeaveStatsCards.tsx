"use client";

import clsx from "clsx";
import { CheckCircle2, Clock, Umbrella, XCircle } from "lucide-react";
import type { LeaveStats } from "@/lib/leave-api";

export function LeaveStatsCards({ stats }: { stats: LeaveStats }) {
  const cards = [
    {
      label: "Tổng đơn",
      value: stats.total,
      hint: "Tất cả yêu cầu",
      icon: Umbrella,
      tone: "bg-indigo-50 text-indigo-500",
    },
    {
      label: "Chờ duyệt",
      value: stats.pending,
      hint: "Cần xử lý",
      icon: Clock,
      tone: "bg-amber-50 text-amber-500",
    },
    {
      label: "Đã duyệt",
      value: stats.approved,
      hint: "Được nghỉ",
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-500",
    },
    {
      label: "Từ chối",
      value: stats.rejected,
      hint: "Không duyệt",
      icon: XCircle,
      tone: "bg-rose-50 text-rose-500",
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
