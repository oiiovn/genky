"use client";

import clsx from "clsx";
import {
  Coins,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { formatMoney, type PayrollStats } from "@/lib/payroll";

export function PayrollStatsCards({ stats }: { stats: PayrollStats }) {
  const cards = [
    {
      key: "emp",
      label: "Tổng nhân viên",
      value: `${stats.employees} Nhân viên`,
      delta: null as number | null,
      icon: Users,
      tone: "bg-violet-50 text-violet-500",
    },
    {
      key: "fund",
      label: "Quỹ lương",
      value: formatMoney(stats.fund),
      delta: stats.fund_delta,
      icon: Wallet,
      tone: "bg-emerald-50 text-emerald-500",
    },
    {
      key: "income",
      label: "Tổng thu nhập",
      value: formatMoney(stats.income),
      delta: stats.income_delta,
      icon: Coins,
      tone: "bg-sky-50 text-sky-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
                    <TrendingUp className="h-3 w-3" />+{card.delta}%
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">Trong bảng lương</p>
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

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">Đã thanh toán</p>
        <div className="mt-2 flex items-center gap-3">
          <div className="relative h-14 w-14 shrink-0">
            <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="4"
              />
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke="#8B5CF6"
                strokeWidth="4"
                strokeDasharray={`${stats.paid_percent} ${100 - stats.paid_percent}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-violet-600">
              {stats.paid_percent.toFixed(0)}%
            </span>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-800">
              {stats.paid_percent.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-400">tổng lương</p>
          </div>
        </div>
      </div>
    </div>
  );
}
